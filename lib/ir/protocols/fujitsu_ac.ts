import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Fujitsu A/C: LSB-first, 14 63 00 10 10 prefix. Settings go in a 16-byte long message (15 on ARDB1/ARJW2);
// power off is a 7-byte short message (6 on ARDB1/ARJW2) carrying command 0x02.
const timing: Timing = {
  hdrMark: 3324,
  hdrSpace: 1574,
  bitMark: 448,
  oneSpace: 1182,
  zeroSpace: 390,
  footerMark: 448,
  gap: 8100,
};

const PREFIX = [0x14, 0x63, 0x00, 0x10, 0x10];
const CMD_OFF = 0x02;
const SWING_V = 1;
const SWING_H = 2;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
  ["quiet", 4],
] as const);

type Model = "arrah2e" | "ardb1" | "arreb1e" | "arjw2" | "arry4" | "arrew4e";

const shortModel = (m: Model) => m === "ardb1" || m === "arjw2";

function build(s: ClimateState, variant = "arrah2e") {
  const model = variant as Model;
  const long = shortModel(model) ? 15 : 16;
  const b = new Uint8Array(long);
  b.set(PREFIX);
  if (!s.power) {
    b[5] = CMD_OFF;
    if (shortModel(model)) return b.slice(0, 6);
    b[6] = ~b[5] & 0xff;
    return b.slice(0, 7);
  }
  b[5] = shortModel(model) ? 0xfc : 0xfe;
  b[6] = long - 7;
  b[7] = model === "arrew4e" ? 0x31 : 0x30;
  setBit(b, 8, 0, true);
  const t = clamp(s.temp, 16, 30);
  setBits(b, 8, 2, 6, Math.trunc(model === "arrew4e" ? (t - 8) * 2 : (t - 16) * 4));
  setBits(b, 9, 0, 3, mode.toRaw(s.mode));
  setBits(b, 10, 0, 3, fan.toRaw(s.fan));
  let swing = (s.swingV !== "off" ? SWING_V : 0) | (s.swingH !== "off" ? SWING_H : 0);
  if (["ardb1", "arreb1e", "arry4"].includes(model) && swing > SWING_V) swing = SWING_V;
  if (shortModel(model)) swing = 0;
  setBits(b, 10, 4, 2, swing);
  if (["arreb1e", "arrah2e", "arry4"].includes(model)) setBit(b, 14, 5, true);
  b[long - 1] = shortModel(model) ? (0x9b - sumBytes(b, 0, long - 1)) & 0xff : -sumBytes(b, 7, long - 1) & 0xff;
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  if (b.length <= 7) return b[5] === CMD_OFF ? { power: false } : {};
  const t = getBits(b, 8, 2, 6);
  const swing = getBits(b, 10, 4, 2);
  return {
    power: getBit(b, 8, 0),
    mode: mode.fromRaw(getBits(b, 9, 0, 3)),
    temp: b[7] === 0x31 ? t / 2 + 8 : Math.floor(t / 4) + 16,
    fan: fan.fromRaw(getBits(b, 10, 0, 3)),
    swingV: swing & SWING_V ? "auto" : "off",
    swingH: swing & SWING_H ? "auto" : "off",
  };
}

function valid(b: Uint8Array) {
  if (!PREFIX.every((v, i) => b[i] === v)) return false;
  switch (b.length) {
    case 6:
      return true;
    case 7:
      return b[6] === (~b[5] & 0xff);
    case 15:
      return sumBytes(b) === 0x9b;
    case 16:
      return sumBytes(b, 7) === 0;
    default:
      return false;
  }
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.frame(bytes, timing);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.header(timing)) continue;
    const bytes: number[] = [];
    for (;;) {
      const at = r.i;
      const v = r.bits(8, timing);
      if (v === null) {
        r.i = at;
        break;
      }
      bytes.push(Number(v));
    }
    const b = Uint8Array.from(bytes);
    if (r.footer(timing) && valid(b)) return b;
  }
  return null;
}

export const fujitsuAc: AcProtocol = {
  id: "fujitsu_ac",
  name: "Fujitsu A/C",
  frequency: 38000,
  bits: 128,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Fujitsu.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "quiet", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  variants: [
    {
      id: "arrah2e",
      label: "AR-RAH2E / AR-RAE1E / AR-RAC1E / AR-RCE1E / AR-RAH2U / AR-REG1U / AR-RCL1E",
      note: "Default. A/C: ASYG30LFCA, ASHG09LLCA, AOHG09LLC, AGTV14LAC. Vertical and horizontal swing.",
    },
    {
      id: "ardb1",
      label: "AR-DB1 / AR-DL10 / AR-JW17 / AR-JW19",
      note: "A/C: AST9RSGCW, ASU30C1. 15-byte message with its own checksum, no swing; 6-byte off.",
    },
    {
      id: "arreb1e",
      label: "AR-REB1E / AR-RAH1U / AR-REB4E",
      note: "A/C: ASYG7LMCA, ASU12RLF. Vertical swing only; using AR-RAH2E instead can lock up these units.",
    },
    { id: "arjw2", label: "AR-JW2 / AR-DL3", note: "As AR-DB1: 15-byte message, swing cleared." },
    { id: "arry4", label: "AR-RY4", note: "A/C: ASTB09LBC. Vertical swing only." },
    {
      id: "arrew4e",
      label: "AR-REW4E / AR-REW1E",
      note: "A/C: ASYG09KETA-B, ASTG09K, ASTG18K. Protocol byte 0x31, half-degree temperature encoding.",
    },
  ],
  build,
  parse,
  modulate,
  demodulate,
};

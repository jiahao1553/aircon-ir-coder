import { getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Argo Ulisse. WREM2 is 12 bytes with no footer. WREM3 AC control is 6 bytes with a footer.
// Room temperature stays at the 25°C reset value. iFeel, timer and config messages are not built.
const timing: Timing = {
  hdrMark: 6400,
  hdrSpace: 3300,
  bitMark: 400,
  oneSpace: 2200,
  zeroSpace: 900,
  footerMark: 400,
  gap: 100000,
};

const flap = table([
  ["auto", 0],
  ["highest", 1],
  ["high", 2],
  ["upper_middle", 3],
  ["middle", 4],
  ["low", 5],
  ["lowest", 6],
  ["swing", 7],
] as const);

const mode2 = table([
  ["cool", 0],
  ["dry", 1],
  ["auto", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const mode3 = table([
  ["cool", 1],
  ["dry", 2],
  ["heat", 3],
  ["fan_only", 4],
  ["auto", 5],
] as const);

const fan3 = table([
  ["auto", 0],
  ["min", 1],
  ["low", 2],
  ["medium", 3],
  ["medium_high", 4],
  ["high", 5],
  ["max", 6],
] as const);

function wrem2Fan(name: string) {
  if (name === "min" || name === "low") return 1;
  if (name === "medium" || name === "medium_high") return 2;
  if (name === "high" || name === "max") return 3;
  return 0;
}

const fan2 = table([
  ["auto", 0],
  ["min", 1],
  ["medium", 2],
  ["max", 3],
] as const);

function wrem2(s: ClimateState) {
  const b = new Uint8Array(12);
  b[0] = 0xac;
  b[1] = 0xf5;
  setBits(b, 2, 3, 3, mode2.toRaw(s.mode));
  setBits(b, 2, 6, 5, clamp(Math.round(s.temp), 10, 32) - 4);
  setBits(b, 3, 3, 2, wrem2Fan(s.fan));
  setBits(b, 3, 5, 5, 21);
  setBits(b, 4, 2, 3, flap.toRaw(s.swingV));
  setBit(b, 9, 2, s.sleep);
  setBit(b, 9, 3, s.turbo);
  setBit(b, 9, 5, s.power);
  const sum = (sumBytes(b, 0, 10) + 2) & 0xff;
  b[10] = ((sum & 0x3f) << 2) | 0x02;
  b[11] = sum >> 6;
  return b;
}

function wrem3(s: ClimateState) {
  const b = new Uint8Array(6);
  b[0] = 0x0b;
  setBits(b, 1, 0, 5, 21);
  setBits(b, 1, 5, 3, mode3.toRaw(s.mode));
  setBits(b, 2, 0, 5, clamp(Math.round(s.temp), 10, 32) - 4);
  setBits(b, 2, 5, 3, fan3.toRaw(s.fan));
  setBits(b, 3, 0, 3, flap.toRaw(s.swingV));
  setBit(b, 3, 3, s.power);
  setBit(b, 3, 5, s.sleep);
  setBit(b, 3, 6, s.econo);
  setBit(b, 3, 7, s.turbo);
  b[4] = 0xc0 | (s.light ? 0x02 : 0);
  b[5] = sumBytes(b, 0, 5);
  return b;
}

function parse2(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 9, 5, 1) === 1,
    mode: mode2.fromRaw(getBits(b, 2, 3, 3)),
    temp: getBits(b, 2, 6, 5) + 4,
    fan: fan2.fromRaw(getBits(b, 3, 3, 2)),
    swingV: flap.fromRaw(getBits(b, 4, 2, 3)),
    swingH: "off",
    turbo: getBits(b, 9, 3, 1) === 1,
    sleep: getBits(b, 9, 2, 1) === 1,
    econo: false,
    light: false,
  };
}

function parse3(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 3, 3, 1) === 1,
    mode: mode3.fromRaw(getBits(b, 1, 5, 3)),
    temp: getBits(b, 2, 0, 5) + 4,
    fan: fan3.fromRaw(getBits(b, 2, 5, 3)),
    swingV: flap.fromRaw(getBits(b, 3, 0, 3)),
    swingH: "off",
    turbo: getBits(b, 3, 7, 1) === 1,
    sleep: getBits(b, 3, 5, 1) === 1,
    econo: getBits(b, 3, 6, 1) === 1,
    light: getBits(b, 4, 1, 1) === 1,
  };
}

function checksum2(b: Uint8Array) {
  const sum = (b[10] >> 2) | ((b[11] & 0x03) << 6);
  return b[0] === 0xac && b[1] === 0xf5 && (b[10] & 0x03) === 0x02 && sum === ((sumBytes(b, 0, 10) + 2) & 0xff);
}

function checksum3(b: Uint8Array) {
  return (b[0] & 0x0f) === 0x0b && b[5] === sumBytes(b, 0, 5) && (b[4] & 0xfc) === 0xc0;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  w.bytes(bytes, timing);
  if (bytes.length < 12) w.footer(timing);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  const r = new PulseReader(pulses);
  if (!r.header(timing)) return null;
  const mark = r.i;
  const short = r.bytes(6, timing);
  if (short && r.footer(timing) && checksum3(short)) return short;
  r.i = mark;
  const long = r.bytes(12, timing);
  return long && checksum2(long) ? long : null;
}

export const argo: AcProtocol = {
  id: "argo",
  name: "Argo",
  frequency: 38000,
  bits: 96,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Argo.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["auto", "highest", "high", "upper_middle", "middle", "low", "lowest", "swing"],
    swingH: ["off"],
    temp: { min: 10, max: 32, step: 1 },
    features: ["turbo", "sleep"],
  },
  variants: [
    { id: "wrem2", label: "WREM2", note: "Ulisse 13 DCI, 12 bytes, no footer. Four fan speeds." },
    {
      id: "wrem3",
      label: "WREM3",
      note: "Ulisse Eco, 6-byte AC control with a footer. Also low, medium-high and high fan, econo and light. iFeel, timer and config messages are not encoded.",
    },
  ],
  build: (s, variant) => (variant === "wrem3" ? wrem3(s) : wrem2(s)),
  parse: (b) => (b.length >= 12 ? parse2(b) : parse3(b)),
  modulate,
  demodulate,
};

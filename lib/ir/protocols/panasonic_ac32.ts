import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Panasonic A/C 32-bit: the 32-bit value as 4 little-endian bytes. On air: two sections (bytes 2-3, then 0-1),
// each sent as two blocks of the bytes doubled (b, b, c, c), then a header + mark section footer.
const timing: Timing = {
  hdrMark: 3543,
  hdrSpace: 3450,
  bitMark: 920,
  oneSpace: 2575,
  zeroSpace: 828,
  footerMark: 920,
  gap: 13946,
};

const KNOWN_GOOD = [0xfc, 0x36, 0xf1, 0x0a];

const mode = table([
  ["auto", 6],
  ["cool", 2],
  ["dry", 3],
  ["heat", 4],
  ["fan_only", 1],
] as const);

const fan = table([
  ["auto", 0xf],
  ["min", 2],
  ["low", 3],
  ["medium", 4],
  ["high", 5],
  ["max", 6],
] as const);

const swingV = table([
  ["auto", 7],
  ["highest", 1],
  ["high", 2],
  ["middle", 3],
  ["low", 4],
  ["lowest", 5],
] as const);

function build(s: ClimateState) {
  const b = Uint8Array.from(KNOWN_GOOD);
  // Bit 3 of byte 3 clear = "toggle power"; set = keep the current power state.
  setBit(b, 3, 3, s.power);
  setBits(b, 3, 0, 3, mode.toRaw(s.mode));
  setBits(b, 2, 0, 4, clamp(Math.round(s.temp), 16, 30) - 15);
  setBits(b, 2, 4, 4, fan.toRaw(s.fan));
  setBits(b, 0, 4, 3, swingV.toRaw(s.swingV));
  setBit(b, 0, 3, s.swingH !== "off");
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 3, 3),
    mode: mode.fromRaw(getBits(b, 3, 0, 3)),
    temp: getBits(b, 2, 0, 4) + 15,
    fan: fan.fromRaw(getBits(b, 2, 4, 4)),
    swingV: swingV.fromRaw(getBits(b, 0, 4, 3)),
    swingH: getBit(b, 0, 3) ? "auto" : "off",
  };
}

const header = { ...timing, footerMark: 0, gap: 0 };

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  for (const [lo, hi] of [
    [bytes[2], bytes[3]],
    [bytes[0], bytes[1]],
  ]) {
    for (let block = 0; block < 2; block++) {
      w.header(timing);
      w.bytes([lo, lo, hi, hi], timing);
    }
    w.header(timing);
    w.footer(timing);
  }
  return w.pulses;
}

function readSection(r: PulseReader) {
  const blocks: Uint8Array[] = [];
  for (let block = 0; block < 2; block++) {
    const b = r.header(header) ? r.bytes(4, timing) : null;
    if (!b || b[0] !== b[1] || b[2] !== b[3]) return null;
    blocks.push(b);
  }
  if (blocks[0].join() !== blocks[1].join() || !r.header(header) || !r.footer(timing)) return null;
  return [blocks[0][0], blocks[0][2]];
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const high = readSection(r);
    const low = high && readSection(r);
    if (low && low[1] === 0x36) return Uint8Array.from([...low, ...high]);
  }
  return null;
}

export const panasonicAc32: AcProtocol = {
  id: "panasonic_ac32",
  name: "Panasonic A/C 32-bit",
  frequency: 36700,
  bits: 32,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Panasonic.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["auto", "off"],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  powerToggle: true,
  build,
  parse,
  modulate,
  demodulate,
};

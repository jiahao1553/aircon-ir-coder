import { getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Bosch CL3000i / Durastar RG10: 18 bytes, MSB first, three 6-byte sections.
// Section 2 repeats section 1. Odd bytes are the inverse of the even byte before them.
// Power off is a separate 12-byte message. Quiet forces the fan to auto.
const timing: Timing = {
  hdrMark: 4366,
  hdrSpace: 4415,
  bitMark: 456,
  oneSpace: 1645,
  zeroSpace: 610,
  footerMark: 456,
  gap: 5235,
  msbFirst: true,
};

const OFF = [0xb2, 0x4d, 0x7b, 0x84, 0xe0, 0x1f, 0xb2, 0x4d, 0x7b, 0x84, 0xe0, 0x1f];
const DEFAULT = [
  0xb2, 0x4d, 0x1f, 0xe0, 0xc8, 0x37, 0xb2, 0x4d, 0x1f, 0xe0, 0xc8, 0x37, 0xd5, 0x65, 0x00, 0x00, 0x00, 0x3a,
];

const CELSIUS = [0b000010, 0b000000, 0b000100, 0b001100, 0b001000, 0b011000, 0b011100, 0b010100, 0b010000, 0b110000, 0b110100, 0b100100, 0b100000, 0b101000, 0b101100];

const mode = table([
  ["auto", 0b101],
  ["cool", 0b000],
  ["dry", 0b011],
  ["fan_only", 0b010],
  ["heat", 0b110],
] as const);

const fan = table([
  ["auto", 0b101110011],
  ["min", 0b111001010],
  ["low", 0b100010100],
  ["medium", 0b010011110],
  ["high", 0b001101000],
  ["max", 0b001110010],
] as const);

const AUTO0 = 0b000110011;

function applyFan(b: Uint8Array, speed: number) {
  const hi = speed >> 6;
  const lo = speed & 0x3f;
  setBits(b, 2, 5, 3, hi);
  setBits(b, 8, 5, 3, hi);
  setBits(b, 13, 1, 6, lo);
}

function applyTemp(b: Uint8Array, code: number) {
  setBits(b, 4, 4, 4, code >> 2);
  setBits(b, 10, 4, 4, code >> 2);
  setBit(b, 15, 4, ((code >> 1) & 1) === 1);
  setBit(b, 14, 5, (code & 1) === 1);
}

function applyMode(b: Uint8Array, m: number) {
  setBits(b, 4, 2, 2, m >> 1);
  setBits(b, 10, 2, 2, m >> 1);
  setBit(b, 13, 0, (m & 1) === 1);
}

function invert(b: Uint8Array) {
  for (let i = 0; i <= 10; i += 2) b[i + 1] = (~b[i]) & 0xff;
}

function fanCode(b: Uint8Array) {
  return (getBits(b, 2, 5, 3) << 6) | getBits(b, 13, 1, 6);
}

function tempCode(b: Uint8Array) {
  return (getBits(b, 4, 4, 4) << 2) | (getBits(b, 15, 4, 1) << 1) | getBits(b, 14, 5, 1);
}

function build(s: ClimateState) {
  if (!s.power) return Uint8Array.from(OFF);
  const b = Uint8Array.from(DEFAULT);
  const m = mode.toRaw(s.mode);
  applyTemp(b, CELSIUS[clamp(Math.round(s.temp), 16, 30) - 16]);
  applyFan(b, m === 0b101 || m === 0b011 ? AUTO0 : fan.toRaw(s.fan));
  applyMode(b, m);
  setBit(b, 14, 7, s.quiet);
  if (s.quiet) applyFan(b, fan.toRaw("auto"));
  invert(b);
  b[17] = sumBytes(b, 12, 17);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  if (b.length < 18) return { power: false, swingV: "off", swingH: "off", quiet: false };
  const code = tempCode(b);
  const idx = CELSIUS.indexOf(code);
  const speed = fanCode(b);
  return {
    power: true,
    mode: mode.fromRaw((getBits(b, 4, 2, 2) << 1) | getBits(b, 13, 0, 1)),
    temp: idx < 0 ? 25 : idx + 16,
    fan: speed === AUTO0 ? "auto" : fan.fromRaw(speed),
    swingV: "off",
    swingH: "off",
    quiet: getBits(b, 14, 7, 1) === 1,
  };
}

function same(a: ArrayLike<number>, b: ArrayLike<number>) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function valid(b: Uint8Array) {
  if (b.length === 12) return same(b, OFF);
  if (b.length !== 18 || b[0] !== 0xb2 || b[12] !== 0xd5 || b[17] !== sumBytes(b, 12, 17)) return false;
  for (let i = 0; i <= 10; i += 2) if (b[i + 1] !== ((~b[i]) & 0xff)) return false;
  return true;
}

function read(pulses: number[], start: number) {
  const r = new PulseReader(pulses);
  r.i = start;
  const parts: Uint8Array[] = [];
  while (parts.length < 3) {
    const mark = r.i;
    const part = r.frame(6, timing);
    if (!part) {
      r.i = mark;
      break;
    }
    parts.push(part);
  }
  if (parts.length < 2) return null;
  const b = new Uint8Array(parts.length * 6);
  parts.forEach((p, i) => b.set(p, i * 6));
  return valid(b) ? { b, end: r.i } : null;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  const n = bytes.length / 6;
  for (let s = 0; s < n; s++) w.frame(bytes.subarray(s * 6, s * 6 + 6), timing);
  w.space(100000);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let i = 0; i + 1 < pulses.length; i += 2) {
    const hit = read(pulses, i);
    if (hit) return hit.b;
  }
  return null;
}

export const bosch144: AcProtocol = {
  id: "bosch144",
  name: "Bosch 144",
  frequency: 38000,
  bits: 144,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Bosch.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["quiet"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

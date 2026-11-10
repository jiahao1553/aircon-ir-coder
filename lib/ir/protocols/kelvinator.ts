import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 16 bytes as two 8-byte sections. Each section is 4 command bytes, a 0b010 mark, then 4 data bytes.
const timing: Timing = {
  hdrMark: 9010,
  hdrSpace: 4505,
  bitMark: 680,
  oneSpace: 1530,
  zeroSpace: 510,
  footerMark: 680,
  gap: 19975,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["min", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
  ["max", 5],
] as const);

const swingV = table([
  ["off", 0],
  ["auto", 1],
  ["highest", 2],
  ["upper_middle", 3],
  ["middle", 4],
  ["low", 5],
  ["lowest", 6],
] as const);

const AUTO_V = new Set([1, 7, 9, 11]);
const FIXED_V = new Set([2, 3, 4, 5, 6]);

function blockSum(b: Uint8Array, base: number) {
  let sum = 10;
  for (let i = 0; i < 4; i++) sum += b[base + i] & 0xf;
  for (let i = 4; i < 7; i++) sum += b[base + i] >> 4;
  return sum & 0xf;
}

function valid(b: Uint8Array) {
  return b.length === 16 && (b[3] & 0xf0) === 0x50 && (b[11] & 0xf0) === 0x70 && blockSum(b, 0) === b[7] >> 4 && blockSum(b, 8) === b[15] >> 4;
}

function build(s: ClimateState) {
  const b = new Uint8Array(16);
  b[3] = 0x50;
  b[11] = 0x70;
  if (s.mode === "auto" || s.mode === "dry") setBits(b, 1, 0, 4, 25 - 16);
  setBits(b, 0, 0, 3, mode.toRaw(s.mode));
  setBit(b, 0, 3, s.power);
  setBits(b, 1, 0, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  const speed = fan.toRaw(s.fan);
  setBits(b, 0, 4, 2, Math.min(3, speed));
  setBits(b, 14, 4, 3, speed);
  let vane = swingV.toRaw(s.swingV);
  if (!AUTO_V.has(vane) && !FIXED_V.has(vane)) vane = 0;
  setBits(b, 4, 0, 4, vane);
  const horizontal = s.swingH === "swing" || s.swingH === "auto";
  setBit(b, 4, 4, horizontal);
  setBit(b, 0, 6, horizontal || (vane & 1) === 1);
  setBit(b, 12, 7, s.quiet);
  setBit(b, 2, 5, s.light);
  setBit(b, 2, 7, (s.mode === "cool" || s.mode === "dry") && !!s.clean);
  setBit(b, 2, 4, s.turbo);
  b[8] = b[0];
  b[9] = b[1];
  b[10] = b[2];
  setBits(b, 7, 4, 4, blockSum(b, 0));
  setBits(b, 15, 4, 4, blockSum(b, 8));
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 0, 3),
    mode: mode.fromRaw(getBits(b, 0, 0, 3)),
    temp: getBits(b, 1, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 14, 4, 3)),
    swingV: swingV.fromRaw(getBits(b, 4, 0, 4)),
    swingH: getBit(b, 4, 4) ? "swing" : "off",
    quiet: getBit(b, 12, 7),
    light: getBit(b, 2, 5),
    clean: getBit(b, 2, 7),
    turbo: getBit(b, 2, 4),
  };
}

function writeSection(w: PulseWriter, bytes: Uint8Array, at: number) {
  w.header(timing);
  w.bytes(bytes.subarray(at, at + 4), timing);
  w.bits(0b010, 3, timing);
  w.mark(timing.bitMark);
  w.space(timing.gap);
  w.bytes(bytes.subarray(at + 4, at + 8), timing);
  w.mark(timing.bitMark);
  w.space(timing.gap * 2);
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  writeSection(w, bytes, 0);
  writeSection(w, bytes, 8);
  return w.pulses;
}

function readSection(r: PulseReader) {
  if (!r.header(timing)) return null;
  const cmd = r.bytes(4, timing);
  if (!cmd || r.bits(3, timing) !== 2n || !r.mark(timing.bitMark) || !r.gap(timing.gap)) return null;
  const data = r.bytes(4, timing);
  if (!data || !r.mark(timing.bitMark) || !r.gap(timing.gap * 2)) return null;
  const out = new Uint8Array(8);
  out.set(cmd);
  out.set(data, 4);
  return out;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const a = readSection(r);
    const c = a && readSection(r);
    if (!a || !c) continue;
    const b = new Uint8Array(16);
    b.set(a);
    b.set(c, 8);
    if (valid(b)) return b;
  }
  return null;
}

export const kelvinator: AcProtocol = {
  id: "kelvinator",
  name: "Kelvinator",
  frequency: 38000,
  bits: 128,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Kelvinator.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto", "highest", "upper_middle", "middle", "low", "lowest"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["quiet", "turbo", "light", "clean"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

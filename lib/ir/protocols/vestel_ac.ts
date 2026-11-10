import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Fan } from "../core/types";

// Vestel BIOX: 56 bits LSB-first, stored little-endian in 7 bytes.
// Checksum is 0xFF minus (popcount of bits 20–63, plus 2). Bit 55 stays set.
const timing: Timing = {
  hdrMark: 3110,
  hdrSpace: 9066,
  bitMark: 520,
  oneSpace: 1535,
  zeroSpace: 480,
  footerMark: 520,
  gap: 100000,
};

const DEFAULT = 0x0f00d9001fef201n;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 1],
  ["low", 5],
  ["medium", 9],
  ["high", 0xb],
] as const);

function field(value: bigint, offset: number, width: number) {
  return Number((value >> BigInt(offset)) & ((1n << BigInt(width)) - 1n));
}

function write(value: bigint, offset: number, width: number, raw: number) {
  const mask = (1n << BigInt(width)) - 1n;
  return (value & ~(mask << BigInt(offset))) | (BigInt(raw & Number(mask)) << BigInt(offset));
}

function checksum(state: bigint) {
  let n = 2;
  let v = (state >> 20n) & ((1n << 44n) - 1n);
  while (v) {
    n += Number(v & 1n);
    v >>= 1n;
  }
  return (0xff - n) & 0xff;
}

function toBytes(state: bigint) {
  const b = new Uint8Array(7);
  for (let i = 0; i < 7; i++) b[i] = Number((state >> BigInt(i * 8)) & 0xffn);
  return b;
}

function toWord(b: Uint8Array) {
  let v = 0n;
  for (let i = 0; i < 7; i++) v |= BigInt(b[i] ?? 0) << BigInt(i * 8);
  return v;
}

function fanFrom(raw: number): Fan {
  if (raw === 5) return "low";
  if (raw === 9) return "medium";
  if (raw === 0xb) return "high";
  return "auto";
}

function build(s: ClimateState) {
  let state = DEFAULT;
  state = write(state, 44, 3, mode.toRaw(s.mode));
  state = write(state, 36, 4, clamp(Math.round(s.temp), 18, 30) - 16);
  state = write(state, 40, 4, fan.toRaw(s.fan));
  state = write(state, 20, 4, s.swingV === "off" ? 0xf : 0xa);
  state = write(state, 24, 4, s.turbo ? 7 : s.sleep ? 3 : 1);
  state = write(state, 52, 2, s.power ? 0b11 : 0);
  state = write(state, 54, 1, 1);
  state = write(state, 12, 8, checksum(state));
  return toBytes(state);
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const state = toWord(b);
  const turboSleep = field(state, 24, 4);
  return {
    power: field(state, 52, 2) !== 0,
    mode: mode.fromRaw(field(state, 44, 3)),
    temp: field(state, 36, 4) + 16,
    fan: fanFrom(field(state, 40, 4)),
    swingV: field(state, 20, 4) === 0xa ? "auto" : "off",
    swingH: "off",
    turbo: turboSleep === 7,
    sleep: turboSleep === 3,
  };
}

function valid(b: Uint8Array) {
  const state = toWord(b);
  return field(state, 0, 12) === 0x201 && field(state, 12, 8) === checksum(state);
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
    const b = r.frame(7, timing);
    if (b && valid(b)) return b;
  }
  return null;
}

export const vestelAc: AcProtocol = {
  id: "vestel_ac",
  name: "Vestel BIOX",
  frequency: 38000,
  bits: 56,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Vestel.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 18, max: 30, step: 1 },
    features: ["turbo", "sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

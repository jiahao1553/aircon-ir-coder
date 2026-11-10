import { countBits, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// EcoClim HYSFR-P348: 56 bits, MSB first, sent as three identical sections and one footer.
// Bit 3 is even parity over the whole frame. The low 3 bits are fixed at 0b010.
// Sleep and recycle are operating modes with no separate setting, so they are not offered.
const timing: Timing = {
  hdrMark: 5730,
  hdrSpace: 1935,
  bitMark: 440,
  oneSpace: 1739,
  zeroSpace: 637,
  footerMark: 0,
  gap: 0,
  msbFirst: true,
};

const DEFAULT = 0x11063000ffff0an;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 4],
  ["heat", 5],
] as const);

const fan = table([
  ["auto", 3],
  ["min", 0],
  ["medium", 1],
  ["max", 2],
] as const);

function le(value: bigint) {
  const b = new Uint8Array(7);
  for (let i = 0; i < 7; i++) b[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  return b;
}

function u56(b: Uint8Array) {
  let v = 0n;
  for (let i = 0; i < 7; i++) v |= BigInt(b[i] ?? 0) << BigInt(i * 8);
  return v & ((1n << 56n) - 1n);
}

function parity(b: Uint8Array) {
  const c = new Uint8Array(b);
  setBit(c, 0, 3, false);
  return countBits(c) & 1;
}

function build(s: ClimateState) {
  const b = le(DEFAULT);
  const temp = clamp(Math.round(s.temp), 5, 36);
  setBits(b, 4, 4, 2, fan.toRaw(s.fan));
  setBit(b, 4, 6, s.power);
  setBits(b, 5, 0, 5, temp - 5);
  setBits(b, 5, 5, 3, mode.toRaw(s.mode));
  setBits(b, 6, 0, 5, temp - 5);
  setBit(b, 0, 3, parity(b) === 1);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 4, 6, 1) === 1,
    mode: mode.fromRaw(getBits(b, 5, 5, 3)),
    temp: getBits(b, 5, 0, 5) + 5,
    fan: fan.fromRaw(getBits(b, 4, 4, 2)),
    swingV: "off",
    swingH: "off",
  };
}

function valid(b: Uint8Array) {
  return getBits(b, 0, 0, 3) === 0b010 && (getBits(b, 0, 3, 1) === 1) === (parity(b) === 1);
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  const v = u56(bytes);
  for (let s = 0; s < 3; s++) {
    w.header(timing);
    w.bits(v, 56, timing);
  }
  w.mark(7820);
  w.space(100000);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  const r = new PulseReader(pulses);
  const parts: bigint[] = [];
  for (let s = 0; s < 3; s++) {
    if (!r.header(timing)) return null;
    const v = r.bits(56, timing);
    if (v === null) return null;
    parts.push(v);
  }
  if (!r.mark(7820)) return null;
  if (parts[0] !== parts[1] || parts[1] !== parts[2]) return null;
  const b = le(parts[0]);
  return valid(b) ? b : null;
}

export const ecoclim: AcProtocol = {
  id: "ecoclim",
  name: "EcoClim",
  frequency: 38000,
  bits: 56,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Ecoclim.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 5, max: 36, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate,
  demodulate,
};

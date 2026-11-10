import { getBits, setBit, setBits } from "../core/bits";
import { PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Airwell RC08W / RC04: 34-bit Manchester, MSB first, IEEE (a 0 is mark then space).
// Stored little-endian in 5 bytes; the top 6 bits of the last byte are unused.
// The message is three header+data copies, then one 3800µs footer mark.
// `power: false` sets the toggle bit (this library's power-toggle frame).
const HALF = 950;
const COPIES = 3;
const KNOWN = 0x140500002n;

const mode = table([
  ["auto", 3],
  ["cool", 1],
  ["heat", 2],
  ["dry", 4],
  ["fan_only", 5],
] as const);

const fan = table([
  ["auto", 3],
  ["low", 0],
  ["medium", 1],
  ["high", 2],
] as const);

function le(value: bigint) {
  const b = new Uint8Array(5);
  for (let i = 0; i < 5; i++) b[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  return b;
}

function u34(b: Uint8Array) {
  let v = 0n;
  for (let i = 0; i < 5; i++) v |= BigInt(b[i] ?? 0) << BigInt(i * 8);
  return v & ((1n << 34n) - 1n);
}

function build(s: ClimateState) {
  const b = le(KNOWN);
  const m = mode.toRaw(s.mode);
  setBits(b, 2, 3, 4, clamp(Math.round(s.temp), 16, 30) - 15);
  setBits(b, 3, 4, 2, m === 4 ? 0 : fan.toRaw(s.fan));
  setBits(b, 3, 6, 3, m);
  setBit(b, 4, 1, !s.power);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: !getBits(b, 4, 1, 1),
    mode: mode.fromRaw(getBits(b, 3, 6, 3)),
    temp: getBits(b, 2, 3, 4) + 15,
    fan: fan.fromRaw(getBits(b, 3, 4, 2)),
    swingV: "off",
    swingH: "off",
  };
}

function halves(us: number) {
  const n = Math.round(us / HALF);
  if (n < 1 || n > 6 || Math.abs(us - n * HALF) > HALF * 0.4 + 160) return 0;
  return n;
}

/** First copy only. Header space may have swallowed the first data half. */
function read34(pulses: number[], start: number) {
  if (halves(pulses[start] ?? 0) !== 3) return null;
  const cells: number[] = [];
  let skip = 3;
  let level = 1;
  for (let i = start + 1; i < pulses.length && cells.length < 68; i++) {
    const n = halves(pulses[i]);
    if (!n) return null;
    for (let k = 0; k < n && cells.length < 68; k++) {
      if (skip) skip--;
      else cells.push(level);
    }
    level ^= 1;
  }
  if (cells.length < 68) return null;
  let v = 0n;
  for (let i = 0; i < 34; i++) {
    const a = cells[i * 2];
    const b = cells[i * 2 + 1];
    if (a === b) return null;
    v = (v << 1n) | BigInt(a);
  }
  return le(v);
}

const timing = { gap: 100000 } as Timing;

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  const v = u34(bytes);
  const bit = (one: boolean) => (one ? (w.space(HALF), w.mark(HALF)) : (w.mark(HALF), w.space(HALF)));
  for (let copy = 0; copy < COPIES; copy++) {
    w.mark(3 * HALF);
    w.space(3 * HALF);
    for (let i = 33; i >= 0; i--) bit(((v >> BigInt(i)) & 1n) === 1n);
  }
  w.mark(4 * HALF);
  w.space(timing.gap);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let i = 0; i + 1 < pulses.length; i += 2) {
    const b = read34(pulses, i);
    const m = b ? getBits(b, 3, 6, 3) : 0;
    if (b && m >= 1 && m <= 5) return b;
  }
  return null;
}

export const airwell: AcProtocol = {
  id: "airwell",
  name: "Airwell",
  frequency: 38000,
  bits: 34,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Airwell.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  powerToggle: true,
  build,
  parse,
  modulate,
  demodulate,
};

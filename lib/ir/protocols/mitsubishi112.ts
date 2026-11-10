import { fromHex, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 14 bytes, LSB-first, signature 23 CB 26 01 00. Temperature is stored as 31 - °C. Quiet is the slowest fan.
const timing: Timing = {
  hdrMark: 3450,
  hdrSpace: 1696,
  bitMark: 450,
  oneSpace: 1250,
  zeroSpace: 385,
  footerMark: 450,
  gap: 100000,
};

const RESET = fromHex("23 CB 26 01 00 24 03 0B 10 00 00 00 30 00");

const mode = table([
  ["auto", 0b111],
  ["cool", 0b011],
  ["dry", 0b010],
  ["heat", 0b001],
] as const);

const fan = table([
  ["max", 0b000],
  ["quiet", 0b010],
  ["low", 0b011],
  ["medium", 0b101],
] as const);

const swingV = table([
  ["auto", 0b111],
  ["highest", 0b001],
  ["high", 0b010],
  ["middle", 0b011],
  ["low", 0b100],
  ["lowest", 0b101],
] as const);

const swingH = table([
  ["auto", 0b1100],
  ["left_max", 0b0001],
  ["left", 0b0010],
  ["middle", 0b0011],
  ["right", 0b0100],
  ["right_max", 0b0101],
  ["wide", 0b1000],
] as const);

function valid(b: Uint8Array) {
  return b[0] === 0x23 && b[1] === 0xcb && b[2] === 0x26 && b[13] === sumBytes(b, 0, 13);
}

function nearer(measured: number, target: number, others: number[]) {
  return others.every((other) => Math.abs(measured - target) < Math.abs(measured - other));
}

function build(s: ClimateState) {
  const b = new Uint8Array(RESET);
  setBit(b, 5, 2, s.power);
  setBits(b, 6, 0, 3, mode.toRaw(s.mode));
  setBits(b, 7, 0, 4, 31 - clamp(Math.round(s.temp), 16, 31));
  setBits(b, 8, 0, 3, fan.toRaw(s.fan));
  setBits(b, 8, 3, 3, swingV.toRaw(s.swingV));
  setBits(b, 12, 2, 4, swingH.toRaw(s.swingH));
  b[13] = sumBytes(b, 0, 13);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: (b[5] & 0x04) !== 0,
    mode: mode.fromRaw(getBits(b, 6, 0, 3)),
    temp: 31 - getBits(b, 7, 0, 4),
    fan: fan.fromRaw(getBits(b, 8, 0, 3)),
    swingV: swingV.fromRaw(getBits(b, 8, 3, 3)),
    swingH: swingH.fromRaw(getBits(b, 12, 2, 4)),
  };
}

const frames = simpleFrames(timing, 14, valid);

export const mitsubishi112: AcProtocol = {
  id: "mitsubishi112",
  name: "Mitsubishi Electric 112-bit",
  frequency: 38000,
  bits: 112,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Mitsubishi.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat"],
    fans: ["quiet", "low", "medium", "max"],
    swingV: ["auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["auto", "left_max", "left", "middle", "right", "right_max", "wide"],
    temp: { min: 16, max: 31, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate: frames.modulate,
  demodulate(pulses) {
    for (let start = 0; start < pulses.length; start += 2) {
      if (!nearer(pulses[start] ?? 0, 3450, [3000, 3600])) continue;
      const r = new PulseReader(pulses);
      r.i = start;
      const b = r.frame(14, timing);
      if (b && valid(b)) return b;
    }
    return null;
  },
};

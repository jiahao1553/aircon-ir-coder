import { getBits, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Rhoss Idrowall 96-bit: 12 bytes LSB-first. Fixed AA / 60 / 54, byte-sum checksum.
// The frame ends with a bit-mark, a zero-space, then another bit-mark and a long gap.
const timing: Timing = {
  hdrMark: 3042,
  hdrSpace: 4248,
  bitMark: 648,
  oneSpace: 1545,
  zeroSpace: 457,
  footerMark: 648,
  gap: 100000,
};

const mode = table([
  ["cool", 0b0010],
  ["heat", 0b0001],
  ["dry", 0b0011],
  ["fan_only", 0b0100],
  ["auto", 0b0101],
] as const);

const fan = table([
  ["auto", 0b00],
  ["min", 0b01],
  ["medium", 0b10],
  ["max", 0b11],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(12);
  b[0] = 0xaa;
  b[2] = 0x60;
  b[6] = 0x54;
  setBits(b, 1, 0, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBits(b, 4, 0, 2, fan.toRaw(s.fan));
  setBits(b, 4, 4, 4, mode.toRaw(s.mode));
  setBits(b, 5, 0, 1, s.swingV === "off" ? 0 : 1);
  setBits(b, 5, 6, 2, s.power ? 0b10 : 0b01);
  b[11] = sumBytes(b, 0, 11);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 5, 6, 2) === 0b10,
    mode: mode.fromRaw(getBits(b, 4, 4, 4)),
    temp: getBits(b, 1, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 4, 0, 2)),
    swingV: getBits(b, 5, 0, 1) ? "auto" : "off",
    swingH: "off",
  };
}

function valid(b: Uint8Array) {
  return b.length >= 12 && b[0] === 0xaa && b[2] === 0x60 && b[6] === 0x54 && b[11] === sumBytes(b, 0, 11);
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  w.bytes(bytes, timing);
  w.mark(timing.bitMark);
  w.space(timing.zeroSpace);
  w.mark(timing.bitMark);
  w.space(timing.gap);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.header(timing)) continue;
    const b = r.bytes(12, timing);
    if (!b || !r.mark(timing.bitMark) || !r.space(timing.zeroSpace) || !r.mark(timing.bitMark) || !r.gap(timing.gap))
      continue;
    if (valid(b)) return b;
  }
  return null;
}

export const rhoss: AcProtocol = {
  id: "rhoss",
  name: "Rhoss Idrowall",
  frequency: 38000,
  bits: 96,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Rhoss.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate,
  demodulate,
};

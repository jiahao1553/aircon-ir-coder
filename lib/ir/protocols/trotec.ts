import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Trotec PAC 3200 / Duux Blizzard: 9 bytes LSB-first. Intro 12 34.
// Checksum is the sum of bytes 2–7. After the frame gap comes another bit-mark and a short gap.
const timing: Timing = {
  hdrMark: 5952,
  hdrSpace: 7364,
  bitMark: 592,
  oneSpace: 1560,
  zeroSpace: 592,
  footerMark: 592,
  gap: 6184,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
] as const);

const fan = table([
  ["medium", 2],
  ["low", 1],
  ["high", 3],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(9);
  b[0] = 0x12;
  b[1] = 0x34;
  setBits(b, 2, 0, 2, mode.toRaw(s.mode));
  setBit(b, 2, 3, s.power);
  setBits(b, 2, 4, 2, fan.toRaw(s.fan));
  setBits(b, 3, 0, 4, clamp(Math.round(s.temp), 18, 32) - 18);
  setBit(b, 3, 7, s.sleep);
  b[8] = sumBytes(b, 2, 8);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 2, 3),
    mode: mode.fromRaw(getBits(b, 2, 0, 2)),
    temp: getBits(b, 3, 0, 4) + 18,
    fan: fan.fromRaw(getBits(b, 2, 4, 2)),
    swingV: "off",
    swingH: "off",
    sleep: getBit(b, 3, 7),
  };
}

function valid(b: Uint8Array) {
  return b.length >= 9 && b[0] === 0x12 && b[1] === 0x34 && b[8] === sumBytes(b, 2, 8);
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.frame(bytes, timing);
  w.mark(timing.bitMark);
  w.space(1500);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const b = r.frame(9, timing);
    if (!b || !r.mark(timing.bitMark) || !r.gap(1500) || !valid(b)) continue;
    return b;
  }
  return null;
}

export const trotec: AcProtocol = {
  id: "trotec",
  name: "Trotec PAC 3200",
  frequency: 36000,
  bits: 72,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Trotec.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "fan_only"],
    fans: ["low", "medium", "high"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 18, max: 32, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

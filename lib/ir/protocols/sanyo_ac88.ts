import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Mode } from "../core/types";

// Sanyo 88-bit: 11 bytes LSB-first, no checksum (lead AA). Sent three times.
// Gaps between copies are 3675 µs; the final gap is extended by 100 ms.
const timing: Timing = {
  hdrMark: 5400,
  hdrSpace: 2000,
  bitMark: 500,
  oneSpace: 1500,
  zeroSpace: 750,
  footerMark: 500,
  gap: 3675,
};

const TEMPLATE = [0xaa, 0x55, 0xa0, 0x16, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x10];

const mode = table([
  ["auto", 0],
  ["cool", 2],
  ["heat", 4],
  ["fan_only", 5],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

function modeFrom(raw: number): Mode {
  if (raw === 1 || raw === 2) return "cool";
  if (raw === 3 || raw === 4) return "heat";
  if (raw === 5) return "fan_only";
  return "auto";
}

function build(s: ClimateState) {
  const b = Uint8Array.from(TEMPLATE);
  setBits(b, 2, 0, 2, fan.toRaw(s.fan));
  setBits(b, 2, 4, 3, mode.toRaw(s.mode));
  setBit(b, 2, 7, s.power);
  setBits(b, 3, 0, 5, clamp(Math.round(s.temp), 10, 30));
  setBit(b, 3, 6, s.swingV !== "off");
  setBit(b, 10, 3, s.turbo);
  setBit(b, 10, 6, s.sleep);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 2, 7),
    mode: modeFrom(getBits(b, 2, 4, 3)),
    temp: getBits(b, 3, 0, 5),
    fan: fan.fromRaw(getBits(b, 2, 0, 2)),
    swingV: getBit(b, 3, 6) ? "auto" : "off",
    swingH: "off",
    turbo: getBit(b, 10, 3),
    sleep: getBit(b, 10, 6),
  };
}

const valid = (b: Uint8Array) => b.length >= 11 && b[0] === 0xaa;

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  for (let i = 0; i < 3; i++) w.frame(bytes, timing);
  w.pulses[w.pulses.length - 1] += 100000;
  return w.pulses;
}

function demodulate(pulses: number[]) {
  let last: Uint8Array | null = null;
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const b = r.frame(11, timing);
    if (b && valid(b)) last = b;
  }
  return last;
}

export const sanyoAc88: AcProtocol = {
  id: "sanyo_ac88",
  name: "Sanyo 88-bit",
  frequency: 38000,
  bits: 88,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Sanyo.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 10, max: 30, step: 1 },
    features: ["turbo", "sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

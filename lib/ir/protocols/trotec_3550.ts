import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Trotec 3550: 9 bytes sent MSB-first. Checksum is the sum of the first eight.
// Celsius is stored in the high nibble of byte 1; Fahrenheit is written alongside it.
const timing: Timing = {
  hdrMark: 12000,
  hdrSpace: 5130,
  bitMark: 550,
  oneSpace: 1950,
  zeroSpace: 500,
  footerMark: 550,
  gap: 100000,
  msbFirst: true,
};

const TEMPLATE = [0x55, 0x60, 0x00, 0x0d, 0x00, 0x00, 0x10, 0x88, 0x5a];

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

function fahrenheit(c: number) {
  return (Math.trunc((c * 9) / 5 + 32) - 59) & 0x1f;
}

function build(s: ClimateState) {
  const b = Uint8Array.from(TEMPLATE);
  const temp = clamp(Math.round(s.temp), 16, 30);
  setBit(b, 1, 0, s.swingV !== "off");
  setBit(b, 1, 1, s.power);
  setBits(b, 1, 4, 4, temp - 16);
  setBits(b, 3, 0, 5, fahrenheit(temp));
  setBits(b, 6, 0, 2, mode.toRaw(s.mode));
  setBits(b, 6, 4, 2, fan.toRaw(s.fan));
  setBit(b, 7, 7, true);
  b[8] = sumBytes(b, 0, 8);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 1, 1),
    mode: mode.fromRaw(getBits(b, 6, 0, 2)),
    temp: getBits(b, 1, 4, 4) + 16,
    fan: fan.fromRaw(getBits(b, 6, 4, 2)),
    swingV: getBit(b, 1, 0) ? "auto" : "off",
    swingH: "off",
  };
}

const valid = (b: Uint8Array) => b.length >= 9 && b[0] === 0x55 && b[8] === sumBytes(b, 0, 8);

const frames = simpleFrames(timing, 9, valid);

export const trotec3550: AcProtocol = {
  id: "trotec_3550",
  name: "Trotec 3550",
  frequency: 38000,
  bits: 72,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Trotec.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "fan_only"],
    fans: ["low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  build,
  parse,
  ...frames,
};

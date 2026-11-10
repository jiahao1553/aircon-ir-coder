import { getBits, setBits, sumNibbles } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Amcor ADR-853H: 8 bytes. Bits are distinguished by mark width. Byte 7 is the nibble sum of bytes 0–6.
const timing: Timing = {
  hdrMark: 8200,
  hdrSpace: 4200,
  bitMark: 600,
  oneMark: 1500,
  zeroMark: 600,
  oneSpace: 600,
  zeroSpace: 1500,
  footerMark: 1900,
  gap: 34300,
};

const mode = table([
  ["auto", 0b101],
  ["cool", 0b001],
  ["heat", 0b010],
  ["fan_only", 0b011],
  ["dry", 0b100],
] as const);

const fan = table([
  ["auto", 0b100],
  ["min", 0b001],
  ["medium", 0b010],
  ["max", 0b011],
] as const);

function checksum(b: Uint8Array) {
  return sumNibbles(b, 0, 7) & 0xff;
}

function build(s: ClimateState) {
  const b = new Uint8Array(8);
  b[0] = 0x01;
  const m = mode.toRaw(s.mode);
  setBits(b, 1, 0, 3, m);
  setBits(b, 1, 4, 3, fan.toRaw(s.fan));
  setBits(b, 6, 6, 2, m === 0b011 ? 0b11 : 0);
  let temp = clamp(Math.round(s.temp), 12, 32);
  let max = false;
  if (s.turbo && m === 0b001) {
    temp = 12;
    max = true;
  } else if (s.turbo && m === 0b010) {
    temp = 32;
    max = true;
  }
  setBits(b, 2, 1, 6, temp);
  setBits(b, 5, 4, 4, s.power ? 0b0011 : 0b1100);
  setBits(b, 6, 0, 2, max ? 0b11 : 0);
  b[7] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 5, 4, 4) === 0b0011,
    mode: mode.fromRaw(getBits(b, 1, 0, 3)),
    temp: getBits(b, 2, 1, 6),
    fan: fan.fromRaw(getBits(b, 1, 4, 3)),
    swingV: "off",
    swingH: "off",
    turbo: getBits(b, 6, 0, 2) === 0b11,
  };
}

const valid = (b: Uint8Array) => b[0] === 0x01 && b[7] === checksum(b);

export const amcor: AcProtocol = {
  id: "amcor",
  name: "Amcor",
  frequency: 38000,
  bits: 64,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Amcor.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 12, max: 32, step: 1 },
    features: ["turbo"],
  },
  build,
  parse,
  ...simpleFrames(timing, 8, valid, 2),
};

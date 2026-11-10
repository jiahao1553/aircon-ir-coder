import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Delonghi PAC A95: 64 bits LSB-first, header 0x53, checksum is the sum of the first 7 bytes.
const timing: Timing = {
  hdrMark: 8984,
  hdrSpace: 4200,
  bitMark: 572,
  oneSpace: 1558,
  zeroSpace: 510,
  footerMark: 572,
  gap: 100000,
};

const mode = table([
  ["auto", 0b100],
  ["cool", 0b000],
  ["dry", 0b001],
  ["fan_only", 0b010],
] as const);

const fan = table([
  ["auto", 0b00],
  ["high", 0b01],
  ["medium", 0b10],
  ["low", 0b11],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(8);
  b[0] = 0x53;
  const m = mode.toRaw(s.mode);
  let speed = fan.toRaw(s.fan);
  if (m === 0b100 || m === 0b001) speed = 0;
  if (m === 0b010 && speed === 0) speed = 0b01;
  setBits(b, 1, 0, 5, clamp(Math.round(s.temp), 18, 32) - 17);
  setBits(b, 1, 5, 2, speed);
  setBit(b, 2, 0, s.power);
  setBits(b, 2, 1, 3, m);
  setBit(b, 2, 4, s.turbo);
  setBit(b, 2, 5, s.sleep);
  b[7] = sumBytes(b, 0, 7);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 2, 0),
    mode: mode.fromRaw(getBits(b, 2, 1, 3)),
    temp: getBits(b, 1, 0, 5) + 17,
    fan: fan.fromRaw(getBits(b, 1, 5, 2)),
    swingV: "off",
    swingH: "off",
    turbo: getBit(b, 2, 4),
    sleep: getBit(b, 2, 5),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x53 && b[7] === sumBytes(b, 0, 7);

export const delonghiAc: AcProtocol = {
  id: "delonghi_ac",
  name: "Delonghi",
  frequency: 38000,
  bits: 64,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Delonghi.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 18, max: 32, step: 1 },
    features: ["turbo", "sleep"],
  },
  build,
  parse,
  ...simpleFrames(timing, 8, valid),
};

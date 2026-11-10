import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Airton RD1A1: 56 bits LSB-first. Header 0x11D3, checksum ((0x7F - sum of the first 6 bytes) ^ 0x2C).
const timing: Timing = {
  hdrMark: 6630,
  hdrSpace: 3350,
  bitMark: 400,
  oneSpace: 1260,
  zeroSpace: 430,
  footerMark: 400,
  gap: 100000,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["min", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
  ["max", 5],
] as const);

function checksum(b: Uint8Array) {
  return ((0x7f - sumBytes(b, 0, 6)) ^ 0x2c) & 0xff;
}

function build(s: ClimateState) {
  const b = new Uint8Array(7);
  b[0] = 0xd3;
  b[1] = 0x11;
  const m = mode.toRaw(s.mode);
  setBits(b, 2, 0, 3, m);
  setBit(b, 2, 3, s.power);
  // Auto locks the setpoint at 31°C. Turbo forces the fan to max.
  const temp = m === 0 ? 31 : clamp(Math.round(s.temp), 16, 31);
  setBits(b, 2, 4, 3, s.turbo ? 5 : fan.toRaw(s.fan));
  setBit(b, 2, 7, s.turbo);
  setBits(b, 3, 0, 4, temp - 16);
  setBit(b, 4, 0, s.swingV !== "off");
  setBit(b, 5, 0, s.econo && m === 1);
  setBit(b, 5, 1, s.sleep && m !== 0 && m !== 3);
  setBit(b, 5, 2, m !== 0 || !s.power);
  setBit(b, 5, 4, m === 4 && s.power);
  setBit(b, 5, 7, s.light);
  b[6] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 2, 3),
    mode: mode.fromRaw(getBits(b, 2, 0, 3)),
    temp: getBits(b, 3, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 2, 4, 3)),
    swingV: getBit(b, 4, 0) ? "auto" : "off",
    swingH: "off",
    turbo: getBit(b, 2, 7),
    light: getBit(b, 5, 7),
    econo: getBit(b, 5, 0),
    sleep: getBit(b, 5, 1),
  };
}

const valid = (b: Uint8Array) => b[0] === 0xd3 && b[1] === 0x11 && b[6] === checksum(b);

export const airton: AcProtocol = {
  id: "airton",
  name: "Airton",
  frequency: 38000,
  bits: 56,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Airton.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 16, max: 31, step: 1 },
    features: ["turbo", "light", "econo", "sleep"],
  },
  build,
  parse,
  ...simpleFrames(timing, 7, valid),
};

import { fromHex, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 17 bytes. Bytes 11-16 are the complements of bytes 5-10. Signature 23 CB 26 21 00.
const timing: Timing = {
  hdrMark: 3324,
  hdrSpace: 1474,
  bitMark: 467,
  oneSpace: 1137,
  zeroSpace: 351,
  footerMark: 467,
  gap: 100000,
};

const RESET = fromHex("23 CB 26 21 00 40 C2 C7 04 00 00 00 00 00 00 00 00");

const mode = table([
  ["auto", 0b011],
  ["cool", 0b001],
  ["heat", 0b010],
  ["dry", 0b101],
  ["fan_only", 0b000],
] as const);

const fan = table([
  ["max", 0b11],
  ["quiet", 0b00],
  ["low", 0b01],
  ["medium", 0b10],
] as const);

const swingV = table([
  ["auto", 0b1100],
  ["highest", 0b0011],
  ["high", 0b0010],
  ["low", 0b0001],
  ["lowest", 0b0000],
] as const);

function seal(b: Uint8Array) {
  for (let i = 0; i < 6; i++) b[11 + i] = ~b[5 + i] & 0xff;
}

function valid(b: Uint8Array) {
  if (b.length < 17 || b[0] !== 0x23 || b[1] !== 0xcb || b[2] !== 0x26) return false;
  for (let i = 0; i < 6; i++) if (b[11 + i] !== (~b[5 + i] & 0xff)) return false;
  return true;
}

function build(s: ClimateState) {
  const b = new Uint8Array(RESET);
  setBit(b, 5, 6, s.power);
  setBits(b, 6, 0, 3, mode.toRaw(s.mode));
  setBits(b, 6, 4, 4, clamp(Math.round(s.temp), 17, 30) - 16);
  setBits(b, 7, 1, 2, fan.toRaw(s.fan));
  setBits(b, 7, 4, 4, swingV.toRaw(s.swingV));
  seal(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: (b[5] & 0x40) !== 0,
    mode: mode.fromRaw(getBits(b, 6, 0, 3)),
    temp: getBits(b, 6, 4, 4) + 16,
    fan: fan.fromRaw(getBits(b, 7, 1, 2)),
    swingV: swingV.fromRaw(getBits(b, 7, 4, 4)),
    swingH: "off",
  };
}

export const mitsubishi136: AcProtocol = {
  id: "mitsubishi136",
  name: "Mitsubishi Electric 136-bit",
  frequency: 38000,
  bits: 136,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Mitsubishi.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["quiet", "low", "medium", "max"],
    swingV: ["auto", "highest", "high", "low", "lowest"],
    swingH: [],
    temp: { min: 17, max: 30, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(timing, 17, valid),
};

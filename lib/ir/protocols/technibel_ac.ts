import { getBit, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Technibel IRO PLUS: 56 bits sent MSB-first. Bytes are in wire order
// (header first, checksum last). Checksum is the two's complement of the
// middle four bytes (mode, fan, temp, timer).
const timing: Timing = {
  hdrMark: 8836,
  hdrSpace: 4380,
  bitMark: 523,
  oneSpace: 1696,
  zeroSpace: 564,
  footerMark: 523,
  gap: 100000,
  msbFirst: true,
};

const mode = table([
  ["cool", 0b0001],
  ["dry", 0b0010],
  ["fan_only", 0b0100],
  ["heat", 0b1000],
] as const);

const fan = table([
  ["low", 0b0001],
  ["medium", 0b0010],
  ["high", 0b0100],
] as const);

function checksum(b: Uint8Array) {
  return (~(b[1] + b[2] + b[3] + b[4]) + 1) & 0xff;
}

function build(s: ClimateState) {
  const b = new Uint8Array(7);
  b[0] = 0x18;
  const m = mode.toRaw(s.mode);
  const speed = m === 0b0010 ? fan.toRaw("low") : fan.toRaw(s.fan);
  setBits(b, 1, 0, 4, m);
  setBit(b, 1, 7, s.power);
  setBits(b, 2, 0, 3, speed);
  setBit(b, 2, 4, s.sleep);
  setBit(b, 2, 5, s.swingV !== "off");
  setBits(b, 3, 0, 7, clamp(Math.round(s.temp), 16, 31));
  b[6] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 1, 7),
    mode: mode.fromRaw(getBits(b, 1, 0, 4)),
    temp: getBits(b, 3, 0, 7),
    fan: fan.fromRaw(getBits(b, 2, 0, 3)),
    swingV: getBit(b, 2, 5) ? "auto" : "off",
    swingH: "off",
    sleep: getBit(b, 2, 4),
  };
}

const valid = (b: Uint8Array) => b.length >= 7 && b[0] === 0x18 && b[6] === checksum(b);

export const technibelAc: AcProtocol = {
  id: "technibel_ac",
  name: "Technibel IRO PLUS",
  frequency: 38000,
  bits: 56,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Technibel.h",
  capabilities: {
    modes: ["cool", "dry", "heat", "fan_only"],
    fans: ["low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 16, max: 31, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  ...simpleFrames(timing, 7, valid),
};

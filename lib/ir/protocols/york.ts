import { getBit, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Fan } from "../core/types";

// York GRYLH2A: 17 bytes LSB-first. Bytes 0–13 feed CRC-16/ARC; byte 14 is 0xEC.
// Dry locks the fan to low, auto locks it to auto, and fan-only has no auto speed.
const timing: Timing = {
  hdrMark: 4887,
  hdrSpace: 2267,
  bitMark: 612,
  oneSpace: 1778,
  zeroSpace: 579,
  footerMark: 612,
  gap: 100000,
};

const PREAMBLE = [0x08, 0x10, 0x07, 0x02, 0x40, 0x08];

const mode = table([
  ["heat", 1],
  ["cool", 2],
  ["dry", 3],
  ["fan_only", 4],
  ["auto", 8],
] as const);

const fan = table([
  ["auto", 8],
  ["low", 1],
  ["medium", 2],
  ["max", 3],
] as const);

function crc16(bytes: Uint8Array) {
  let crc = 0;
  for (let i = 0; i < 14; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc & 0xffff;
}

function lockedFan(native: number, speed: Fan) {
  if (native === 3) return fan.toRaw("low");
  if (native === 8) return fan.toRaw("auto");
  if (native === 4 && (speed === "auto" || fan.toRaw(speed) > 3)) return fan.toRaw("max");
  return fan.toRaw(speed);
}

function build(s: ClimateState) {
  const b = new Uint8Array(17);
  b.set(PREAMBLE);
  b[6] = 0x03;
  const native = mode.toRaw(s.mode);
  setBits(b, 7, 0, 4, lockedFan(native, s.fan));
  setBit(b, 7, 4, s.power);
  setBits(b, 8, 0, 4, native);
  setBits(b, 9, 2, 6, clamp(Math.round(s.temp), 18, 32));
  setBit(b, 13, 0, s.swingV !== "off");
  b[14] = 0xec;
  const crc = crc16(b);
  b[15] = crc & 0xff;
  b[16] = (crc >> 8) & 0xff;
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 7, 4),
    mode: mode.fromRaw(getBits(b, 8, 0, 4)),
    temp: getBits(b, 9, 2, 6),
    fan: fan.fromRaw(getBits(b, 7, 0, 4)),
    swingV: getBit(b, 13, 0) ? "auto" : "off",
    swingH: "off",
  };
}

function valid(b: Uint8Array) {
  if (b.length < 17 || b[14] !== 0xec || b[0] !== 0x08) return false;
  const crc = crc16(b);
  return b[15] === (crc & 0xff) && b[16] === ((crc >> 8) & 0xff);
}

export const york: AcProtocol = {
  id: "york",
  name: "York GRYLH2A",
  frequency: 38000,
  bits: 136,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_York.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "max"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 18, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(timing, 17, valid),
};

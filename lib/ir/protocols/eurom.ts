import { sumNibbles } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Eurom Polar: 12 bytes, MSB first. Bytes 0, 1, 6 and 9 are constants. Byte 11 is
// (nibble sum of bytes 1–10) − (nibble sum of byte 0).
const timing: Timing = {
  hdrMark: 3257,
  hdrSpace: 3187,
  bitMark: 454,
  oneSpace: 1162,
  zeroSpace: 355,
  footerMark: 454,
  gap: 50058,
  msbFirst: true,
};

const mode = table([
  ["cool", 0x01],
  ["heat", 0x04],
  ["dry", 0x72],
  ["fan_only", 0x73],
] as const);

const fan = table([
  ["low", 0x10],
  ["medium", 0x20],
  ["high", 0x40],
] as const);

function bcd(n: number) {
  return ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
}

function modeByte(m: number, celsius: number) {
  if (m === 0x72 || m === 0x73) return m;
  if (celsius >= 32) return m | 0x08;
  return m | ((celsius - 16) << 4);
}

function checksum(b: Uint8Array) {
  return (sumNibbles(b, 1, b.length - 1) - sumNibbles(b, 0, 1)) & 0xff;
}

function build(s: ClimateState) {
  const b = new Uint8Array(12);
  b[0] = 0x18;
  b[1] = 0x27;
  const m = mode.toRaw(s.mode);
  const celsius = clamp(Math.round(s.temp), 16, 32);
  b[2] = modeByte(m, celsius);
  b[3] = (s.power ? 0x80 : 0) | (s.swingV !== "off" ? 0x40 : 0);
  b[4] = 0x00;
  b[5] = (s.sleep ? 0x40 : 0) + bcd(0);
  b[6] = 0x00;
  b[7] = 0x80;
  b[8] = 0x00;
  b[9] = 0x80;
  b[10] = fan.toRaw(s.fan);
  b[11] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const raw = b[2];
  const base = raw & 0x07;
  const m = base === 0x02 || base === 0x03 ? raw : base === 0x04 || (raw & 0x0f) === 0x0c ? 0x04 : 0x01;
  let temp = 16 + (raw >> 4);
  if ((raw & 0x0f) === 0x09 || (raw & 0x0f) === 0x0c) temp = 32;
  if (m === 0x72 || m === 0x73) temp = 16;
  return {
    power: (b[3] & 0x80) !== 0,
    mode: mode.fromRaw(m),
    temp,
    fan: fan.fromRaw(b[10]),
    swingV: b[3] & 0x40 ? "swing" : "off",
    swingH: "off",
    sleep: (b[5] & 0x40) !== 0,
  };
}

const valid = (b: Uint8Array) =>
  b.length === 12 && b[0] === 0x18 && b[1] === 0x27 && b[9] === 0x80 && b[11] === checksum(b);

export const eurom: AcProtocol = {
  id: "eurom",
  name: "Eurom Polar",
  frequency: 38000,
  bits: 96,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Eurom.h",
  capabilities: {
    modes: ["cool", "heat", "dry", "fan_only"],
    fans: ["low", "medium", "high"],
    swingV: ["off", "swing"],
    swingH: ["off"],
    temp: { min: 16, max: 32, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  ...simpleFrames(timing, 12, valid),
};

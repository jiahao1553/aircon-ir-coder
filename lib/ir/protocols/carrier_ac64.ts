import { getBit, getBits, setBit, setBits, sumNibbles } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Carrier 64-bit A/C: one 64-bit little-endian value sent LSB-first. Byte 2's low nibble is the sum of every
// nibble above it.
const timing: Timing = {
  hdrMark: 8940,
  hdrSpace: 4556,
  bitMark: 503,
  oneSpace: 1736,
  zeroSpace: 615,
  footerMark: 503,
  gap: 100000,
};

const RESET = [0x84, 0x55, 0x2a, 0x2c, 0x00, 0x00, 0x90, 0x10];
const SLEEP_OFF_TIMER_HOURS = 2;

const mode = table([
  ["cool", 2],
  ["heat", 1],
  ["fan_only", 3],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

const checksum = (b: Uint8Array) => (sumNibbles(b, 3) + (b[2] >> 4)) & 0xf;

function build(s: ClimateState) {
  const b = Uint8Array.from(RESET);
  setBit(b, 4, 4, s.power);
  setBits(b, 2, 4, 2, mode.toRaw(s.mode));
  setBits(b, 3, 0, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBits(b, 2, 6, 2, fan.toRaw(s.fan));
  setBit(b, 3, 5, s.swingV !== "off");
  if (s.sleep) {
    setBits(b, 7, 4, 4, SLEEP_OFF_TIMER_HOURS);
    setBit(b, 4, 5, false);
    setBit(b, 4, 6, false);
  }
  setBit(b, 4, 7, !!s.sleep);
  setBits(b, 2, 0, 4, checksum(b));
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 4, 4),
    mode: mode.fromRaw(getBits(b, 2, 4, 2)),
    temp: getBits(b, 3, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 2, 6, 2)),
    swingV: getBit(b, 3, 5) ? "auto" : "off",
    sleep: getBit(b, 4, 7),
  };
}

const frames = simpleFrames(timing, 8, (b) => getBits(b, 2, 0, 4) === checksum(b));

export const carrierAc64: AcProtocol = {
  id: "carrier_ac64",
  name: "Carrier A/C (64-bit)",
  frequency: 38000,
  bits: 64,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Carrier.h",
  capabilities: {
    modes: ["cool", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  ...frames,
};

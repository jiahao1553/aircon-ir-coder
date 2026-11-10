import { getBit, getBits, setBit, setBits } from "../core/bits";
import type { Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { ClimateState } from "../core/types";

export const hitachiTiming: Timing = {
  hdrMark: 3300,
  hdrSpace: 1700,
  bitMark: 400,
  oneSpace: 1250,
  zeroSpace: 500,
  footerMark: 400,
  gap: 100000,
};

/** From `start`, every odd byte is the complement of the byte before it. */
export function invertPairs(b: Uint8Array, start = 3) {
  for (let i = start + 1; i < b.length; i += 2) b[i] = ~b[i - 1] & 0xff;
}

export function hasInvertedPairs(b: Uint8Array, start = 3) {
  for (let i = start + 1; i < b.length; i += 2) if (b[i] !== (~b[i - 1] & 0xff)) return false;
  return true;
}

// The 264/344/424-bit remotes share one 53-byte layout; shorter ones send a prefix of it.
export const POWER_MODE_BUTTON = 0x13;
const DRY = 5;
const FAN = 1;

export const mode424 = table([
  ["cool", 3],
  ["heat", 6],
  ["dry", DRY],
  ["fan_only", FAN],
] as const);

export const fan424 = table([
  ["auto", 5],
  ["min", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
  ["max", 6],
] as const);

export function reset424() {
  const b = new Uint8Array(53);
  b.set([0x01, 0x10, 0x00, 0x40, 0x00, 0xff, 0x00, 0xcc]);
  b[27] = 0xe1;
  b[33] = 0x80;
  b[35] = 0x03;
  b[37] = 0x01;
  b[39] = 0x88;
  for (const i of [45, 47, 49, 51]) b[i] = 0xff;
  return b;
}

/** Mode, temp and power as the 424 class sets them; temp is written after mode, so fan mode keeps the requested temp. */
export function setCommon424(b: Uint8Array, s: ClimateState) {
  setBits(b, 25, 0, 4, mode424.toRaw(s.mode));
  setBits(b, 13, 2, 6, clamp(Math.round(s.temp), 16, 32));
  setBit(b, 27, 4, s.power);
  b[11] = POWER_MODE_BUTTON;
}

/** Dry allows only min/low/auto; fan mode has no auto. Min and max also rewrite bytes 9 and 29. */
export function setFan424(b: Uint8Array, s: ClimateState) {
  const mode = mode424.toRaw(s.mode);
  const want = fan424.toRaw(s.fan);
  let speed = want;
  let max = 6;
  if (mode === DRY) max = want === 5 ? 5 : 2;
  else if (mode === FAN && want === 5) speed = 1;
  speed = Math.min(speed, max);
  setBits(b, 25, 4, 4, speed);
  b[9] = speed === 1 ? 0x98 : speed === 6 ? 0xa9 : 0x92;
  b[29] = speed === 6 ? 0x30 : 0x00;
}

export function parseCommon424(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 27, 4),
    mode: mode424.fromRaw(getBits(b, 25, 0, 4)),
    temp: getBits(b, 13, 2, 6),
  };
}

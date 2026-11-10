import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { ClimateState } from "../core/types";

// Every Haier frame is MSB-first behind a 3000/3000 µs pre-header.
const timing: Timing = {
  hdrMark: 3000,
  hdrSpace: 4300,
  bitMark: 520,
  oneSpace: 1650,
  zeroSpace: 650,
  footerMark: 520,
  gap: 150000,
  msbFirst: true,
};
const PRE = 3000;

export function haierFrames(nbytes: number, valid: (b: Uint8Array) => boolean) {
  return {
    modulate(bytes: Uint8Array) {
      const w = new PulseWriter();
      w.mark(PRE);
      w.space(PRE);
      w.frame(bytes, timing);
      return w.pulses;
    },
    demodulate(pulses: number[]) {
      for (let start = 0; start < pulses.length; start += 2) {
        const r = new PulseReader(pulses);
        r.i = start;
        if (!r.mark(PRE) || !r.space(PRE)) continue;
        const b = r.frame(nbytes, timing);
        if (b && valid(b)) return b;
      }
      return null;
    },
  };
}

// Layout shared by the YR-W02 family (YRW02, 160 and 176-bit): the first 14 bytes, ending in a byte-sum.
export const MODEL_A = 0xa6;
export const MODEL_B = 0x59;
const COOL = 1;
const HEAT = 4;
const POWER_BUTTON = 5;

export const yrw02Mode = table([
  ["auto", 0],
  ["cool", COOL],
  ["dry", 2],
  ["heat", HEAT],
  ["fan_only", 6],
] as const);

export const yrw02Fan = table([
  ["auto", 5],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
] as const);

/** Turbo and quiet only exist in cool/heat, and turbo wins over quiet. The button byte is "power". */
export function setYrw02Front(b: Uint8Array, s: ClimateState) {
  const m = yrw02Mode.toRaw(s.mode);
  const coolHeat = m === COOL || m === HEAT;
  setBits(b, 1, 4, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBit(b, 4, 6, s.power);
  setBits(b, 5, 5, 3, yrw02Fan.toRaw(s.fan));
  setBit(b, 6, 6, coolHeat && s.turbo);
  setBit(b, 6, 7, coolHeat && s.quiet && !s.turbo);
  setBits(b, 7, 5, 3, m);
  setBit(b, 8, 7, s.sleep);
  setBits(b, 12, 0, 5, POWER_BUTTON);
}

export function parseYrw02Front(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 4, 6),
    mode: yrw02Mode.fromRaw(getBits(b, 7, 5, 3)),
    temp: getBits(b, 1, 4, 4) + 16,
    fan: yrw02Fan.fromRaw(getBits(b, 5, 5, 3)),
    turbo: getBit(b, 6, 6),
    quiet: getBit(b, 6, 7),
    sleep: getBit(b, 8, 7),
  };
}

export const isHeat = (s: ClimateState) => yrw02Mode.toRaw(s.mode) === HEAT;

const SWING_V_MIDDLE = 2;
const SWING_V_BOTTOM = 3;

export const yrw02SwingV = table([
  ["off", 0],
  ["highest", 1],
  ["middle", SWING_V_MIDDLE],
  ["lowest", SWING_V_BOTTOM],
  ["low", 0xa],
  ["auto", 0xc],
] as const);

export const yrw02SwingH = table([
  ["middle", 0],
  ["left_max", 3],
  ["left", 4],
  ["right", 5],
  ["right_max", 6],
  ["auto", 7],
] as const);

/** The 22-byte 176-bit state; YRW02 sends its first 14 bytes. Health is on in the reset state. */
export function buildHaier176(s: ClimateState, model: number) {
  const b = new Uint8Array(22);
  b[0] = model;
  b[14] = 0xb7;
  setBit(b, 3, 1, true);
  setYrw02Front(b, s);
  // Heat has no middle position and only heat has bottom.
  const heat = isHeat(s);
  let v = yrw02SwingV.toRaw(s.swingV);
  if (heat && v === SWING_V_MIDDLE) v = SWING_V_BOTTOM;
  if (!heat && v === SWING_V_BOTTOM) v = SWING_V_MIDDLE;
  setBits(b, 1, 0, 4, v);
  setBits(b, 2, 5, 3, yrw02SwingH.toRaw(s.swingH));
  const fan = yrw02Fan.toRaw(s.fan);
  setBits(b, 16, 6, 2, fan === yrw02Fan.toRaw("auto") ? 0 : fan);
  b[13] = sumBytes(b, 0, 13);
  b[21] = sumBytes(b, 14, 21);
  return b;
}

export function parseHaier176(b: Uint8Array): Partial<ClimateState> {
  return {
    ...parseYrw02Front(b),
    swingV: yrw02SwingV.fromRaw(getBits(b, 1, 0, 4)),
    swingH: yrw02SwingH.fromRaw(getBits(b, 2, 5, 3)),
  };
}

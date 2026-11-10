import { sumBytes, sumNibbles } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { table } from "../core/table";
import type { ClimateState } from "../core/types";

/** 3-bit mode shared by the ARC4xx byte protocols. */
export const mode3 = table([
  ["auto", 0b000],
  ["dry", 0b010],
  ["cool", 0b011],
  ["heat", 0b100],
  ["fan_only", 0b110],
] as const);

/**
 * Fan nibble on the wire. The setter takes 1–5, auto (0xA) or quiet (0xB)
 * and stores 1–5 as 3–7.
 */
export const fan15 = table([
  ["auto", 0xa],
  ["quiet", 0xb],
  ["min", 3],
  ["low", 4],
  ["medium", 5],
  ["high", 6],
  ["max", 7],
] as const);

/** Swing is a single on/off nibble. On is reported as auto. */
export const swingBool = table([
  ["off", 0x0],
  ["auto", 0xf],
] as const);

export const swingV2 = table([
  ["auto", 0xf],
  ["off", 0xe],
  ["highest", 0x1],
  ["high", 0x2],
  ["upper_middle", 0x3],
  ["middle", 0x4],
  ["low", 0x5],
  ["lowest", 0x6],
] as const);

export const swingH2 = table([
  ["auto", 0xbe],
  ["off", 0xbf],
  ["left_max", 0xa8],
  ["left", 0xa9],
  ["middle", 0xaa],
  ["right", 0xab],
  ["right_max", 0xac],
  ["wide", 0xa3],
] as const);

/** Same positions as swingV2, but off is 0 rather than 0xE. */
export const swingV312 = table([
  ["off", 0x0],
  ["auto", 0xf],
  ["highest", 0x1],
  ["high", 0x2],
  ["upper_middle", 0x3],
  ["middle", 0x4],
  ["low", 0x5],
  ["lowest", 0x6],
] as const);

/**
 * Horizontal swing constants are 8-bit, but the field is 4 bits wide,
 * so the value on the wire is the low nibble.
 */
export const swingH312 = table([
  ["off", 0x0],
  ["auto", 0xf],
  ["wide", 0x3],
  ["left_max", 0x8],
  ["left", 0x9],
  ["middle", 0xa],
  ["right", 0xb],
  ["right_max", 0xc],
] as const);

export const swingV160 = table([
  ["auto", 0xf],
  ["lowest", 0x1],
  ["low", 0x2],
  ["middle", 0x3],
  ["high", 0x4],
  ["highest", 0x5],
] as const);

export const mode128 = table([
  ["auto", 0b1010],
  ["dry", 0b0001],
  ["cool", 0b0010],
  ["fan_only", 0b0100],
  ["heat", 0b1000],
] as const);

export const fan128 = table([
  ["auto", 0b0001],
  ["high", 0b0010],
  ["turbo", 0b0011],
  ["medium", 0b0100],
  ["low", 0b1000],
  ["quiet", 0b1001],
] as const);

export const mode64 = table([
  ["cool", 0b0010],
  ["dry", 0b0001],
  ["fan_only", 0b0100],
  ["heat", 0b1000],
] as const);

/** Quiet, powerful, and econo in the order the common sender applies them. */
export function quietTurboEcono(s: ClimateState) {
  let quiet = !!s.quiet;
  let turbo = !!s.turbo;
  let econo = !!s.econo;
  if (quiet) turbo = false;
  if (s.turbo) {
    quiet = false;
    econo = false;
    turbo = true;
  }
  if (s.econo) {
    econo = true;
    turbo = false;
  }
  return { quiet, turbo, econo };
}

/** Quiet and powerful only; econo is independent (Daikin2 / Daikin312). */
export function quietTurbo(s: ClimateState) {
  let quiet = !!s.quiet;
  let turbo = !!s.turbo;
  if (quiet) turbo = false;
  if (s.turbo) {
    quiet = false;
    turbo = true;
  }
  return { quiet, turbo };
}

export function bcd(n: number) {
  return ((Math.floor(n / 10) % 10) << 4) | (n % 10);
}

export function fromBcd(n: number) {
  return ((n >> 4) & 0xf) * 10 + (n & 0xf);
}

/** Byte-sum checksum at the end of each section. `ends` are the checksum indexes. */
export function seal(bytes: Uint8Array, ends: readonly number[]) {
  let start = 0;
  for (const end of ends) {
    bytes[end] = sumBytes(bytes, start, end);
    start = end + 1;
  }
}

export function sealed(bytes: Uint8Array, ends: readonly number[]) {
  let start = 0;
  for (const end of ends) {
    if (bytes[end] !== sumBytes(bytes, start, end)) return false;
    start = end + 1;
  }
  return true;
}

export interface BitTiming {
  bitMark: number;
  oneSpace: number;
  zeroSpace: number;
}

export interface Frame {
  n: number;
  hdrMark: number;
  hdrSpace: number;
  footerMark: number;
  gap: number;
}

export interface Leader {
  write(w: PulseWriter): void;
  read(r: PulseReader): boolean;
}

function asTiming(bit: BitTiming, frame: Frame): Timing {
  return {
    hdrMark: frame.hdrMark,
    hdrSpace: frame.hdrSpace,
    bitMark: bit.bitMark,
    oneSpace: bit.oneSpace,
    zeroSpace: bit.zeroSpace,
    footerMark: frame.footerMark,
    gap: frame.gap,
  };
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** 5 zero bits, no header, then a footer mark and a gap. */
export function zeroLeader(bit: BitTiming, gap: number): Leader {
  const t: Timing = {
    hdrMark: 0,
    hdrSpace: 0,
    bitMark: bit.bitMark,
    oneSpace: bit.oneSpace,
    zeroSpace: bit.zeroSpace,
    footerMark: bit.bitMark,
    gap,
  };
  return {
    write(w) {
      w.bits(0, 5, t);
      w.footer(t);
    },
    read(r) {
      const start = r.i;
      for (let i = 0; i < 5; i++) {
        if (r.bit(t) !== 0) {
          r.i = start;
          return false;
        }
      }
      if (!r.footer(t)) {
        r.i = start;
        return false;
      }
      return true;
    },
  };
}

/** Repeated mark/space pair sent before the first section. */
export function pairLeader(mark: number, space: number, times: number): Leader {
  return {
    write(w) {
      for (let i = 0; i < times; i++) {
        w.mark(mark);
        w.space(space);
      }
    },
    read(r) {
      const start = r.i;
      for (let i = 0; i < times; i++) {
        if (!r.mark(mark) || !r.space(space)) {
          r.i = start;
          return false;
        }
      }
      return true;
    },
  };
}

export function message(
  bit: BitTiming,
  frames: readonly Frame[],
  valid: (bytes: Uint8Array) => boolean,
  leader?: Leader,
  tail?: (w: PulseWriter) => void,
) {
  const decode = (pulses: number[], useLeader: boolean) => {
    const r = new PulseReader(pulses);
    if (useLeader && leader && !leader.read(r)) return null;
    const parts: Uint8Array[] = [];
    for (const frame of frames) {
      const got = r.frame(frame.n, asTiming(bit, frame));
      if (!got) return null;
      parts.push(got);
    }
    const bytes = concat(parts);
    return valid(bytes) ? bytes : null;
  };

  return {
    modulate(bytes: Uint8Array) {
      const w = new PulseWriter();
      leader?.write(w);
      let offset = 0;
      for (const frame of frames) {
        w.frame(bytes.subarray(offset, offset + frame.n), asTiming(bit, frame));
        offset += frame.n;
      }
      tail?.(w);
      return w.pulses;
    },
    demodulate(pulses: number[]) {
      return decode(pulses, true) ?? (leader ? decode(pulses, false) : null);
    },
  };
}

/** Nibble sum of bytes [start, end) plus an optional seed, masked to a nibble or a byte. */
export function nibbleSum(bytes: ArrayLike<number>, start: number, end: number, seed = 0) {
  return (seed + sumNibbles(bytes, start, end)) & 0xff;
}

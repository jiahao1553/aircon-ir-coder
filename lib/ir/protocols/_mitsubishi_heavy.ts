import { PulseReader, simpleFrames, type Timing } from "../core/pulses";

/** Both Heavy frames: short mark = 1, long mark-space = 0, inverted byte pairs from byte 3. */
export const heavyTiming: Timing = {
  hdrMark: 3140,
  hdrSpace: 1630,
  bitMark: 370,
  oneSpace: 420,
  zeroSpace: 1220,
  footerMark: 370,
  gap: 100000,
};

export function invertPairs(b: Uint8Array, from = 3) {
  for (let i = from; i + 1 < b.length; i += 2) b[i + 1] = ~b[i] & 0xff;
}

export function pairsValid(b: Uint8Array, from = 3) {
  for (let i = from; i + 1 < b.length; i += 2) if (b[i + 1] !== (~b[i] & 0xff)) return false;
  return true;
}

export function heavyFrames(nbytes: number, valid: (b: Uint8Array) => boolean) {
  // A short space is a 1. PulseReader treats the longer space as a 1, so decode with the spaces swapped and invert.
  const read: Timing = { ...heavyTiming, oneSpace: heavyTiming.zeroSpace, zeroSpace: heavyTiming.oneSpace };
  return {
    modulate: simpleFrames(heavyTiming, nbytes, valid).modulate,
    demodulate(pulses: number[]) {
      for (let start = 0; start < pulses.length; start += 2) {
        const r = new PulseReader(pulses);
        r.i = start;
        const raw = r.frame(nbytes, read);
        if (!raw) continue;
        const b = Uint8Array.from(raw, (v) => v ^ 0xff);
        if (valid(b)) return b;
      }
      return null;
    },
  };
}

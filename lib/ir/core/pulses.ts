/** Pulse-distance timing, the scheme nearly every A/C remote uses. All values in µs; 0 means "not sent". */
export interface Timing {
  hdrMark: number;
  hdrSpace: number;
  bitMark: number;
  oneSpace: number;
  zeroSpace: number;
  /** Only for remotes that encode bits in the mark width; defaults to `bitMark`. */
  oneMark?: number;
  zeroMark?: number;
  footerMark: number;
  gap: number;
  msbFirst?: boolean;
}

export class PulseWriter {
  readonly pulses: number[] = [];

  mark(us: number) {
    this.push(us, 0);
  }

  space(us: number) {
    if (this.pulses.length === 0) return;
    this.push(us, 1);
  }

  private push(us: number, parity: number) {
    if (us <= 0) return;
    const p = this.pulses;
    if (p.length % 2 === (parity === 0 ? 1 : 0)) p[p.length - 1] += us;
    else p.push(us);
  }

  bit(one: boolean, t: Timing) {
    this.mark(one ? (t.oneMark ?? t.bitMark) : (t.zeroMark ?? t.bitMark));
    this.space(one ? t.oneSpace : t.zeroSpace);
  }

  /** Writes `nbits` of `value`, MSB or LSB first per timing. */
  bits(value: number | bigint, nbits: number, t: Timing) {
    const v = BigInt(value);
    for (let i = 0; i < nbits; i++) {
      const shift = BigInt(t.msbFirst ? nbits - 1 - i : i);
      this.bit(((v >> shift) & 1n) === 1n, t);
    }
  }

  bytes(bytes: ArrayLike<number>, t: Timing) {
    for (let i = 0; i < bytes.length; i++) this.bits(bytes[i], 8, t);
  }

  header(t: Timing) {
    this.mark(t.hdrMark);
    this.space(t.hdrSpace);
  }

  footer(t: Timing) {
    this.mark(t.footerMark);
    this.space(t.gap);
  }

  /** Header, payload bytes, footer mark, gap. */
  frame(bytes: ArrayLike<number>, t: Timing) {
    this.header(t);
    this.bytes(bytes, t);
    this.footer(t);
  }
}

export class PulseReader {
  i = 0;

  constructor(
    readonly pulses: number[],
    readonly tolerance = 0.35,
    readonly slack = 120,
  ) {}

  get done() {
    return this.i >= this.pulses.length;
  }

  matches(measured: number, expected: number) {
    return Math.abs(measured - expected) <= expected * this.tolerance + this.slack;
  }

  private take(expected: number) {
    if (expected <= 0) return true;
    const v = this.pulses[this.i];
    if (v === undefined || !this.matches(v, expected)) return false;
    this.i++;
    return true;
  }

  mark(us: number) {
    return this.take(us);
  }

  space(us: number) {
    return this.take(us);
  }

  /** Accepts any space at least `us` long, or the end of the capture. */
  gap(us: number) {
    if (this.done) return true;
    const v = this.pulses[this.i];
    if (this.i % 2 === 1 && v >= Math.min(us, 4000) * (1 - this.tolerance)) {
      this.i++;
      return true;
    }
    return us <= 0;
  }

  bit(t: Timing): 0 | 1 | null {
    const m = this.pulses[this.i];
    const s = this.pulses[this.i + 1];
    if (m === undefined) return null;
    const oneMark = t.oneMark ?? t.bitMark;
    const zeroMark = t.zeroMark ?? t.bitMark;
    let one: boolean;
    if (oneMark !== zeroMark) {
      one = Math.abs(m - oneMark) < Math.abs(m - zeroMark);
    } else {
      if (!this.matches(m, t.bitMark)) return null;
      if (s === undefined) return null;
      one = s > (t.oneSpace + t.zeroSpace) / 2;
      const expected = one ? t.oneSpace : t.zeroSpace;
      if (s > expected * (1 + this.tolerance) + this.slack * 4) return null;
    }
    this.i += s === undefined ? 1 : 2;
    return one ? 1 : 0;
  }

  bits(nbits: number, t: Timing): bigint | null {
    let v = 0n;
    for (let i = 0; i < nbits; i++) {
      const b = this.bit(t);
      if (b === null) return null;
      if (t.msbFirst) v = (v << 1n) | BigInt(b);
      else v |= BigInt(b) << BigInt(i);
    }
    return v;
  }

  bytes(n: number, t: Timing): Uint8Array | null {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = this.bits(8, t);
      if (v === null) return null;
      out[i] = Number(v);
    }
    return out;
  }

  header(t: Timing) {
    return this.mark(t.hdrMark) && this.space(t.hdrSpace);
  }

  footer(t: Timing) {
    if (t.footerMark && !this.mark(t.footerMark)) return false;
    return this.gap(t.gap);
  }

  frame(n: number, t: Timing): Uint8Array | null {
    const start = this.i;
    if (!this.header(t)) return this.fail(start);
    const b = this.bytes(n, t);
    if (!b || !this.footer(t)) return this.fail(start);
    return b;
  }

  private fail(start: number) {
    this.i = start;
    return null;
  }
}

/** Common case: one byte frame sent `copies` times. Decodes the first copy that passes `valid`. */
export function simpleFrames(
  t: Timing,
  nbytes: number,
  valid: (b: Uint8Array) => boolean,
  copies = 1,
) {
  return {
    modulate(bytes: Uint8Array) {
      const w = new PulseWriter();
      for (let i = 0; i < copies; i++) w.frame(bytes, t);
      return w.pulses;
    },
    demodulate(pulses: number[]) {
      for (let start = 0; start < pulses.length; start += 2) {
        const r = new PulseReader(pulses);
        r.i = start;
        const b = r.frame(nbytes, t);
        if (b && valid(b)) return b;
      }
      return null;
    },
  };
}

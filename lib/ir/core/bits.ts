/** Reads `width` bits starting at bit `offset` (0 = LSB) of `bytes[byte]`; may run into following bytes. */
export function getBits(bytes: ArrayLike<number>, byte: number, offset: number, width: number) {
  let v = 0;
  for (let i = 0; i < width; i++) {
    const pos = byte * 8 + offset + i;
    if ((bytes[pos >> 3] >> (pos & 7)) & 1) v |= 1 << i;
  }
  return v;
}

export function setBits(bytes: Uint8Array, byte: number, offset: number, width: number, value: number) {
  for (let i = 0; i < width; i++) {
    const pos = byte * 8 + offset + i;
    const mask = 1 << (pos & 7);
    if ((value >> i) & 1) bytes[pos >> 3] |= mask;
    else bytes[pos >> 3] &= ~mask;
  }
}

export function getBit(bytes: ArrayLike<number>, byte: number, offset: number) {
  return getBits(bytes, byte, offset, 1) === 1;
}

export function setBit(bytes: Uint8Array, byte: number, offset: number, on: boolean | undefined) {
  setBits(bytes, byte, offset, 1, on ? 1 : 0);
}

export function reverseBits(value: number, nbits = 8) {
  let out = 0;
  for (let i = 0; i < nbits; i++) if ((value >> i) & 1) out |= 1 << (nbits - 1 - i);
  return out;
}

export function sumBytes(bytes: ArrayLike<number>, start = 0, end = bytes.length) {
  let s = 0;
  for (let i = start; i < end; i++) s += bytes[i];
  return s & 0xff;
}

export function xorBytes(bytes: ArrayLike<number>, start = 0, end = bytes.length) {
  let s = 0;
  for (let i = start; i < end; i++) s ^= bytes[i];
  return s & 0xff;
}

export function sumNibbles(bytes: ArrayLike<number>, start = 0, end = bytes.length) {
  let s = 0;
  for (let i = start; i < end; i++) s += (bytes[i] >> 4) + (bytes[i] & 0xf);
  return s;
}

export function countBits(bytes: ArrayLike<number>, start = 0, end = bytes.length) {
  let s = 0;
  for (let i = start; i < end; i++) for (let v = bytes[i]; v; v >>= 1) s += v & 1;
  return s;
}

export function hex(bytes: ArrayLike<number>) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function fromHex(text: string) {
  return Uint8Array.from(text.trim().split(/[\s,]+/).filter(Boolean), (h) => parseInt(h.replace(/^0x/i, ""), 16));
}

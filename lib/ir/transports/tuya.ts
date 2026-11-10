import { fromBase64, toBase64 } from "./base64";

// Tuya IR stream (UFO-R11, ZS06, Zigbee2MQTT): u16 LE durations in µs, compressed with a
// FastLZ-style scheme, then Base64. Block header h: h >> 5 == 0 is a literal run of (h & 31) + 1
// bytes; otherwise a back-reference of length (h >> 5) + 2 (7 means "read one more length byte")
// at distance ((h & 31) << 8 | next) + 1. Format per https://gist.github.com/svyatogor/7839d00303998a9fa37eb48494dd680f

const WINDOW = 1 << 13;
const MAX_LEN = 256 + 8;

function compress(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  const literals = (from: number, to: number) => {
    for (let i = from; i < to; i += 32) {
      const chunk = data.subarray(i, Math.min(i + 32, to));
      out.push(chunk.length - 1, ...chunk);
    }
  };
  const seen = new Map<number, number[]>();
  const key = (p: number) => (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
  const remember = (p: number) => {
    if (p + 2 >= data.length) return;
    const list = seen.get(key(p));
    if (list) list.push(p);
    else seen.set(key(p), [p]);
  };
  let pos = 0;
  let litStart = 0;
  while (pos < data.length) {
    let bestLen = 0;
    let bestDist = 0;
    const candidates = pos + 2 < data.length ? (seen.get(key(pos)) ?? []) : [];
    const limit = Math.min(MAX_LEN, data.length - pos);
    for (let c = candidates.length - 1; c >= 0 && c >= candidates.length - 64; c--) {
      const from = candidates[c];
      if (pos - from > WINDOW) break;
      let len = 0;
      while (len < limit && data[pos + len] === data[from + len]) len++;
      if (len > bestLen) {
        bestLen = len;
        bestDist = pos - from;
        if (len === limit) break;
      }
    }
    if (bestLen >= 3) {
      for (let k = 0; k < bestLen; k++) remember(pos + k);
      literals(litStart, pos);
      const dist = bestDist - 1;
      const len = bestLen - 2;
      if (len >= 7) out.push((7 << 5) | (dist >> 8), len - 7, dist & 0xff);
      else out.push((len << 5) | (dist >> 8), dist & 0xff);
      pos += bestLen;
      litStart = pos;
    } else {
      remember(pos);
      pos++;
    }
  }
  literals(litStart, pos);
  return Uint8Array.from(out);
}

function decompress(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < input.length) {
    const h = input[i++];
    let len = h >> 5;
    if (len === 0) {
      const n = (h & 31) + 1;
      if (i + n > input.length) throw new Error("Tuya code is truncated.");
      for (let k = 0; k < n; k++) out.push(input[i++]);
      continue;
    }
    if (len === 7) len += input[i++];
    const dist = (((h & 31) << 8) | input[i++]) + 1;
    if (dist > out.length) throw new Error("Tuya code refers back past its start.");
    const from = out.length - dist;
    for (let k = 0; k < len + 2; k++) out.push(out[from + k]);
  }
  return Uint8Array.from(out);
}

export function encodeTuya(pulses: number[]): string {
  const raw = new Uint8Array(pulses.length * 2);
  pulses.forEach((us, k) => {
    const v = Math.min(65535, Math.max(1, Math.round(us)));
    raw[k * 2] = v & 0xff;
    raw[k * 2 + 1] = v >> 8;
  });
  return toBase64(compress(raw));
}

export function decodeTuya(code: string): number[] {
  const raw = decompress(fromBase64(code));
  const out: number[] = [];
  for (let k = 0; k + 1 < raw.length; k += 2) out.push(raw[k] | (raw[k + 1] << 8));
  return out;
}

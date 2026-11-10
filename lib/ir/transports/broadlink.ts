import { fromBase64, toBase64 } from "./base64";

// Broadlink packet: 0x26 (IR), repeat count, u16 LE length, then durations in 8192/269 µs ticks.
// A tick count above 255 is written as 0x00 followed by a u16 big-endian.
const US_PER_TICK = 8192 / 269;

export function pulsesToBroadlinkBytes(pulses: number[]): Uint8Array {
  const body: number[] = [];
  for (const us of pulses) {
    const tick = Math.max(1, Math.round(us / US_PER_TICK));
    if (tick < 256) body.push(tick);
    else body.push(0, (tick >> 8) & 0xff, tick & 0xff);
  }
  if (pulses.length % 2 === 1) body.push(0x00, 0x0d, 0x05);
  const packet = new Uint8Array(4 + body.length);
  packet[0] = 0x26;
  packet[2] = body.length & 0xff;
  packet[3] = body.length >> 8;
  packet.set(body, 4);
  return packet;
}

export function broadlinkBytesToPulses(packet: Uint8Array): number[] {
  if (packet.length < 4 || packet[0] !== 0x26) throw new Error("This is not a Broadlink IR packet.");
  const end = Math.min(packet.length, 4 + (packet[2] | (packet[3] << 8)));
  const out: number[] = [];
  for (let i = 4; i < end; ) {
    if (packet[i] === 0) {
      if (i + 2 >= end) break;
      out.push(((packet[i + 1] << 8) | packet[i + 2]) * US_PER_TICK);
      i += 3;
    } else {
      out.push(packet[i] * US_PER_TICK);
      i += 1;
    }
  }
  return out.map(Math.round);
}

export const encodeBroadlink = (pulses: number[]) => toBase64(pulsesToBroadlinkBytes(pulses));
export const decodeBroadlink = (code: string) => broadlinkBytesToPulses(fromBase64(code));

export const encodeBroadlinkHex = (pulses: number[]) =>
  Array.from(pulsesToBroadlinkBytes(pulses), (b) => b.toString(16).padStart(2, "0")).join("");

export function decodeBroadlinkHex(code: string) {
  const clean = code.replace(/\s+/g, "");
  if (!/^(?:[0-9a-f]{2})+$/i.test(clean)) throw new Error("That text is not hex.");
  return broadlinkBytesToPulses(Uint8Array.from(clean.match(/../g)!, (h) => parseInt(h, 16)));
}

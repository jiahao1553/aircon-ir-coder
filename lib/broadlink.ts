import { checksumOf } from "@/lib/protocol";

/** Broadlink IR ticks. microseconds = tick * 8192 / 269. */
const TICK_NUM = 269;
const TICK_DEN = 8192;

const HDR_MARK = 3500;
const HDR_SPACE = 1700;
const BIT_MARK = 430;
const ONE_SPACE = 1250;
const ZERO_SPACE = 390;
const GAP = 17500;

export function microsecondsToTick(us: number): number {
  return Math.max(1, Math.round((us * TICK_NUM) / TICK_DEN));
}

export function tickToMicroseconds(tick: number): number {
  return (tick * TICK_DEN) / TICK_NUM;
}

export function frameToPulses(bytes: number[]): number[] {
  const pulses: number[] = [];
  for (let copy = 0; copy < 2; copy += 1) {
    pulses.push(HDR_MARK, HDR_SPACE);
    for (const byte of bytes) {
      for (let bit = 0; bit < 8; bit += 1) {
        const one = ((byte >> bit) & 1) === 1;
        pulses.push(BIT_MARK, one ? ONE_SPACE : ZERO_SPACE);
      }
    }
    pulses.push(BIT_MARK, GAP);
  }
  return pulses;
}

export function encodeBroadlink(pulsesUs: number[]): Uint8Array {
  const body: number[] = [];
  for (const us of pulsesUs) {
    const tick = microsecondsToTick(us);
    if (tick < 256) {
      body.push(tick);
    } else {
      body.push(0, (tick >> 8) & 0xff, tick & 0xff);
    }
  }
  const packet = new Uint8Array(4 + body.length);
  packet[0] = 0x26;
  packet[1] = 0x00;
  packet[2] = body.length & 0xff;
  packet[3] = (body.length >> 8) & 0xff;
  packet.set(body, 4);
  return packet;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, "");
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new Error("That text is not Base64.");
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodePulses(packet: Uint8Array): number[] {
  if (packet.length < 4 || packet[0] !== 0x26) {
    throw new Error("This packet is not a Broadlink IR code.");
  }
  const length = packet[2] | (packet[3] << 8);
  if (length < 1 || 4 + length > packet.length + 8) {
    throw new Error("The Broadlink length field does not match the packet.");
  }
  const end = Math.min(packet.length, 4 + length);
  const ticks: number[] = [];
  for (let i = 4; i < end; ) {
    const byte = packet[i];
    if (byte === 0) {
      if (i + 2 >= end) break;
      ticks.push((packet[i + 1] << 8) | packet[i + 2]);
      i += 3;
    } else {
      ticks.push(byte);
      i += 1;
    }
  }
  return ticks.map(tickToMicroseconds);
}

export function pulsesToByteFrames(pulsesUs: number[]): number[][] {
  const frames: number[][] = [];
  let bits: number[] = [];
  const push = () => {
    if (bits.length === 0) return;
    frames.push(bitsToBytes(bits));
    bits = [];
  };
  for (let i = 0; i + 1 < pulsesUs.length; i += 2) {
    const mark = pulsesUs[i];
    const space = pulsesUs[i + 1];
    if (mark > 2000 && space > 1200 && space < 6000) {
      push();
      continue;
    }
    if (space > 6000) {
      push();
      continue;
    }
    bits.push(space > 800 ? 1 : 0);
  }
  push();
  return frames;
}

function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  const usable = Math.floor(bits.length / 8) * 8;
  for (let i = 0; i < usable; i += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value |= bits[i + bit] << bit;
    bytes.push(value);
  }
  return bytes;
}

export function bestFrame(frames: number[][]): number[] | null {
  const full = frames.filter((frame) => frame.length === 18);
  return full.find((frame) => checksumOf(frame) === frame[17]) ?? full[0] ?? null;
}

export function frameToBroadlink(bytes: number[]): string {
  return toBase64(encodeBroadlink(frameToPulses(bytes)));
}

export function broadlinkToFrame(code: string): { frame: number[]; pulses: number[] } {
  const pulses = decodePulses(fromBase64(code));
  const frame = bestFrame(pulsesToByteFrames(pulses));
  if (!frame) {
    throw new Error("No 18-byte Mitsubishi frame was found in this code.");
  }
  return { frame, pulses };
}

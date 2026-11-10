import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Alaska SAC9010QC / Teco: 35 bits LSB-first, no checksum.
// Stored little-endian in 5 bytes; the top 5 bits of the last byte are unused.
// Bits 24–34 are the constant 0x250 from the reset word (bytes 0x50 and 0x02, truncated).
const timing: Timing = {
  hdrMark: 9000,
  hdrSpace: 4440,
  bitMark: 620,
  oneSpace: 1650,
  zeroSpace: 580,
  footerMark: 620,
  gap: 100000,
};

const RESET = 0b01001010000000000000010000000000000n;
const CONSTANT = 0x250n;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

function toBytes(value: bigint) {
  const b = new Uint8Array(5);
  for (let i = 0; i < 5; i++) b[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  return b;
}

function toWord(b: Uint8Array) {
  let v = 0n;
  for (let i = 0; i < 5; i++) v |= BigInt(b[i] ?? 0) << BigInt(i * 8);
  return v & ((1n << 35n) - 1n);
}

function build(s: ClimateState) {
  const b = toBytes(RESET);
  setBits(b, 0, 0, 3, mode.toRaw(s.mode));
  setBit(b, 0, 3, s.power);
  setBits(b, 0, 4, 2, fan.toRaw(s.fan));
  setBit(b, 0, 6, s.swingV !== "off");
  setBit(b, 0, 7, s.sleep);
  setBits(b, 1, 0, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBit(b, 2, 5, s.light);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 0, 3),
    mode: mode.fromRaw(getBits(b, 0, 0, 3)),
    temp: getBits(b, 1, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 0, 4, 2)),
    swingV: getBit(b, 0, 6) ? "auto" : "off",
    swingH: "off",
    sleep: getBit(b, 0, 7),
    light: getBit(b, 2, 5),
  };
}

function validWord(value: bigint) {
  return value >> 24n === CONSTANT;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  w.bits(toWord(bytes), 35, timing);
  w.footer(timing);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.header(timing)) continue;
    const word = r.bits(35, timing);
    if (word === null || !r.footer(timing) || !validWord(word)) continue;
    return toBytes(word);
  }
  return null;
}

export const teco: AcProtocol = {
  id: "teco",
  name: "Teco / Alaska SAC9010QC",
  frequency: 38000,
  bits: 35,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Teco.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["sleep", "light"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 24-bit Coolix word, stored as its 3 data bytes MSB-first (wire order, without the complement bytes).
// Each byte is sent MSB-first and again inverted; the whole frame is repeated once.
const timing: Timing = {
  hdrMark: 17 * 276,
  hdrSpace: 16 * 276,
  bitMark: 2 * 276,
  oneSpace: 6 * 276,
  zeroSpace: 2 * 276,
  footerMark: 2 * 276,
  gap: 19 * 276,
  msbFirst: true,
};

const OFF = 0xb27be0;
const BASE = 0xb21fc8;
const TEMP = [0b0000, 0b0001, 0b0011, 0b0010, 0b0110, 0b0111, 0b0101, 0b0100, 0b1100, 0b1101, 0b1001, 0b1000, 0b1010, 0b1011];

const mode = table([
  ["auto", 0b10],
  ["cool", 0b00],
  ["dry", 0b01],
  ["heat", 0b11],
  ["fan_only", 0b01],
] as const);

const fan = table([
  ["auto", 0b101],
  ["min", 0b100],
  ["medium", 0b010],
  ["max", 0b001],
] as const);

function field(raw: number, shift: number, width: number, value: number) {
  const mask = ((1 << width) - 1) << shift;
  return (raw & ~mask) | ((value << shift) & mask);
}

function pack(raw: number) {
  return Uint8Array.from([(raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff]);
}

function unpack(b: Uint8Array) {
  return ((b[0] << 16) | (b[1] << 8) | b[2]) >>> 0;
}

function tempCode(celsius: number) {
  return TEMP[clamp(Math.round(celsius), 17, 30) - 17];
}

function fromTemp(code: number) {
  const i = TEMP.indexOf(code);
  return i < 0 ? undefined : i + 17;
}

function build(s: ClimateState) {
  if (!s.power) return pack(OFF);
  let raw = BASE;
  const fanOnly = s.mode === "fan_only";
  const native = fanOnly ? "dry" : s.mode;
  raw = field(raw, 2, 2, mode.toRaw(native));
  raw = field(raw, 4, 4, fanOnly ? 0b1110 : tempCode(s.temp));
  let speed = fan.toRaw(s.fan);
  const autoFamily = native === "auto" || native === "dry";
  if (speed === 0b101 && autoFamily) speed = 0;
  if (speed === 0 && !autoFamily) speed = 0b101;
  raw = field(raw, 13, 3, speed);
  return pack(raw);
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const raw = unpack(b);
  if (raw === OFF) return { power: false };
  const native = (raw >> 2) & 0x3;
  const code = (raw >> 4) & 0xf;
  const speed = (raw >> 13) & 0x7;
  const fanOnly = native === 0b01 && code === 0b1110;
  return {
    power: true,
    mode: fanOnly ? "fan_only" : mode.fromRaw(native),
    temp: fanOnly ? undefined : fromTemp(code),
    fan: speed === 0 || speed === 0b101 ? "auto" : fan.fromRaw(speed),
    swingV: "off",
    swingH: "off",
  };
}

function complementsOk(b: Uint8Array) {
  return b.length === 3 && b[0] >> 4 === 0xb;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  const once = (gap: number) => {
    w.header(timing);
    for (const byte of bytes) {
      w.bits(byte, 8, timing);
      w.bits(byte ^ 0xff, 8, timing);
    }
    w.mark(timing.footerMark);
    w.space(gap);
  };
  once(timing.gap);
  once(timing.gap + 100000);
  return w.pulses;
}

function readFrame(r: PulseReader) {
  if (!r.header(timing)) return null;
  const out = new Uint8Array(3);
  for (let i = 0; i < 3; i++) {
    const data = r.bits(8, timing);
    const inv = r.bits(8, timing);
    if (data === null || inv === null || (Number(data) ^ 0xff) !== Number(inv)) return null;
    out[i] = Number(data);
  }
  if (!r.mark(timing.footerMark) || !r.gap(timing.gap)) return null;
  return complementsOk(out) ? out : null;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const b = readFrame(r);
    if (b) return b;
  }
  return null;
}

export const coolix: AcProtocol = {
  id: "coolix",
  name: "Coolix",
  frequency: 38000,
  bits: 24,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Coolix.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: [],
    swingH: [],
    temp: { min: 17, max: 30, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate,
  demodulate,
};

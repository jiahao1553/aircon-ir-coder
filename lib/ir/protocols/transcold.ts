import { getBits, reverseBits, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Mode } from "../core/types";

// Transcold M1-F-NO-6: 24-bit state. Each byte is sent MSB-first, then its complement.
// Payload bytes are the three data bytes in wire order (not the complements).
// Power-off and swing are whole-frame commands, not fields of the climate word.
const timing: Timing = {
  hdrMark: 5944,
  hdrSpace: 7563,
  bitMark: 555,
  oneSpace: 3556,
  zeroSpace: 1526,
  footerMark: 555,
  gap: 100000,
  msbFirst: true,
};

const OFF = [0xef, 0x79, 0x54];
const SWING = [0xe7, 0x61, 0x54];

const mode = table([
  ["cool", 0b0110],
  ["heat", 0b1010],
  ["dry", 0b1100],
  ["auto", 0b1110],
  ["fan_only", 0b0010],
] as const);

const fan = table([
  ["auto", 0b1111],
  ["min", 0b1001],
  ["medium", 0b1101],
  ["max", 0b1011],
] as const);

const FAN_AUTO0 = 0b0110;

function encodeTemp(celsius: number) {
  const code = clamp(Math.round(celsius), 18, 30) - 18 + 1;
  return reverseBits((~code) & 0xf, 4);
}

function decodeTemp(raw: number) {
  return reverseBits((~raw) & 0xf, 4) + 18 - 1;
}

function same(a: Uint8Array, b: number[]) {
  return a.length >= 3 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function build(s: ClimateState) {
  if (!s.power) return Uint8Array.from(OFF);
  if (s.swingV === "swing") return Uint8Array.from(SWING);
  const b = Uint8Array.from([0xe9, 0x65, 0x54]);
  let native = mode.toRaw(s.mode);
  const dryish = native === 0b1110 || native === 0b1100;
  let speed = dryish ? FAN_AUTO0 : fan.toRaw("auto");
  let temp = encodeTemp(s.temp);
  if (native === 0b0010) {
    native = 0b1100;
    temp = 0b1111;
  }
  const asked = fan.toRaw(s.fan);
  if (dryish && asked === 0b1111) speed = FAN_AUTO0;
  else if (!dryish && asked === FAN_AUTO0) speed = 0b1111;
  else speed = asked;
  setBits(b, 0, 0, 4, speed);
  setBits(b, 1, 0, 4, temp);
  setBits(b, 1, 4, 4, native);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  if (same(b, OFF)) return { power: false, swingV: "off", swingH: "off" };
  if (same(b, SWING)) return { power: true, swingV: "swing", swingH: "off" };
  const tempRaw = getBits(b, 1, 0, 4);
  const native = getBits(b, 1, 4, 4);
  const fanOnly = native === 0b1100 && tempRaw === 0b1111;
  const modeName: Mode | undefined = fanOnly ? "fan_only" : mode.fromRaw(native);
  return {
    power: true,
    mode: modeName,
    temp: fanOnly ? undefined : decodeTemp(tempRaw),
    fan: fan.fromRaw(getBits(b, 0, 0, 4)) ?? (getBits(b, 0, 0, 4) === FAN_AUTO0 ? "auto" : undefined),
    swingV: "off",
    swingH: "off",
  };
}

function readByte(r: PulseReader) {
  const v = r.bits(8, timing);
  return v === null ? null : Number(v);
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.header(timing)) continue;
    const out = new Uint8Array(3);
    let ok = true;
    for (let i = 0; i < 3; i++) {
      const data = readByte(r);
      const flip = readByte(r);
      if (data === null || flip === null || flip !== ((~data) & 0xff)) {
        ok = false;
        break;
      }
      out[i] = data;
    }
    if (!ok || !r.mark(timing.bitMark) || !r.space(timing.hdrSpace) || !r.mark(timing.bitMark) || !r.gap(timing.gap))
      continue;
    if (out[2] === 0x54) return out;
  }
  return null;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  for (let i = 0; i < 3; i++) {
    w.bits(bytes[i] ?? 0, 8, timing);
    w.bits((~(bytes[i] ?? 0)) & 0xff, 8, timing);
  }
  w.mark(timing.bitMark);
  w.space(timing.hdrSpace);
  w.mark(timing.bitMark);
  w.space(timing.gap);
  return w.pulses;
}

export const transcold: AcProtocol = {
  id: "transcold",
  name: "Transcold M1-F-NO-6",
  frequency: 38000,
  bits: 24,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Transcold.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["off", "swing"],
    swingH: ["off"],
    temp: { min: 18, max: 30, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate,
  demodulate,
};

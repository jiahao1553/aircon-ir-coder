import { getBit, getBits, setBit, setBits, xorBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Fan } from "../core/types";

// Hisense AST-09UW4RVETG00A and Kelon DG11R2-01 / RCH-R0Y3.
// 21 bytes LSB-first in three sections (6 with a header, then 8, then 7).
// Same checksums as Whirlpool DG11J1. Byte 18 bits 3 and 5 are the model;
// bit 4 is absolute power. The byte-2 power bit is raised on every command.
const bit: Timing = {
  hdrMark: 0,
  hdrSpace: 0,
  bitMark: 560,
  oneSpace: 1680,
  zeroSpace: 600,
  footerMark: 560,
  gap: 8000,
};

const head: Timing = { ...bit, hdrMark: 9000, hdrSpace: 4600 };
const tail: Timing = { ...bit, gap: 200000 };

const mode = table([
  ["heat", 0],
  ["auto", 1],
  ["cool", 2],
  ["dry", 3],
  ["fan_only", 4],
] as const);

// Low 2 bits are byte 2, the high bit is byte 16 bit 1.
const fanWire: Record<Fan, [number, number]> = {
  auto: [0, 0],
  quiet: [0, 0],
  min: [0b11, 0],
  low: [0b11, 1],
  medium: [0b10, 0],
  medium_high: [0b10, 0],
  high: [0b01, 1],
  max: [0b01, 0],
  turbo: [0b01, 0],
};

const fanFromWire = new Map<string, Fan>([
  ["0,0", "auto"],
  ["3,0", "min"],
  ["3,1", "low"],
  ["2,0", "medium"],
  ["1,1", "high"],
  ["1,0", "max"],
]);

const MODEL = 0x28;

function checksum(b: Uint8Array) {
  b[13] = xorBytes(b, 2, 12);
  b[20] = xorBytes(b, 14, 20);
}

function build(s: ClimateState) {
  const b = new Uint8Array(21);
  b[0] = 0x83;
  b[1] = 0x06;
  b[6] = 0x80;
  b[18] = MODEL;
  const temp = clamp(Math.round(s.temp), 16, 30);
  const [speed, fan2] = fanWire[s.sleep ? "low" : s.fan];
  setBits(b, 2, 0, 2, speed);
  setBit(b, 2, 2, true);
  setBit(b, 2, 3, s.sleep);
  setBit(b, 2, 7, s.swingV !== "off");
  setBits(b, 3, 0, 3, mode.toRaw(s.mode));
  setBits(b, 3, 4, 4, temp - 16);
  setBit(b, 5, 4, s.turbo);
  setBit(b, 5, 7, s.turbo);
  setBit(b, 6, 5, s.light === false);
  setBit(b, 8, 6, s.swingV !== "off");
  b[15] = s.turbo ? 0x04 : 0x01;
  setBit(b, 16, 1, fan2 === 1);
  setBit(b, 18, 4, s.power);
  checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const wire = `${getBits(b, 2, 0, 2)},${getBit(b, 16, 1) ? 1 : 0}`;
  return {
    power: getBit(b, 18, 4),
    mode: mode.fromRaw(getBits(b, 3, 0, 3)),
    temp: getBits(b, 3, 4, 4) + 16,
    fan: fanFromWire.get(wire) ?? "auto",
    swingV: getBit(b, 2, 7) && getBit(b, 8, 6) ? "swing" : "off",
    swingH: "off",
    turbo: getBit(b, 5, 4) && getBit(b, 5, 7),
    sleep: getBit(b, 2, 3),
    light: !getBit(b, 6, 5),
  };
}

function valid(b: Uint8Array) {
  return (
    b.length >= 21 &&
    b[0] === 0x83 &&
    b[1] === 0x06 &&
    (b[18] & MODEL) === MODEL &&
    b[13] === xorBytes(b, 2, 12) &&
    b[20] === xorBytes(b, 14, 20)
  );
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.frame(bytes.subarray(0, 6), head);
  w.frame(bytes.subarray(6, 14), bit);
  w.frame(bytes.subarray(14, 21), tail);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const a = r.frame(6, head);
    const mid = a && r.frame(8, bit);
    const c = mid && r.frame(7, tail);
    if (!a || !mid || !c) continue;
    const out = new Uint8Array(21);
    out.set(a, 0);
    out.set(mid, 6);
    out.set(c, 14);
    if (valid(out)) return out;
  }
  return null;
}

export const kelon168: AcProtocol = {
  id: "kelon168",
  name: "Hisense",
  frequency: 38000,
  bits: 168,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Kelon.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off", "swing"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "light", "sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

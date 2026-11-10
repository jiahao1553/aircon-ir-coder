import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Corona AR-01: three 7-byte sections. Each section is header, label, data, inverted data.
// With the timers off the remote sends the message twice: power-button clear, then set.
// The bytes returned by build() are the second of those, with the button set.
const timing: Timing = {
  hdrMark: 3500,
  hdrSpace: 1680,
  bitMark: 450,
  oneSpace: 1270,
  zeroSpace: 420,
  footerMark: 450,
  gap: 10800,
};

const mode = table([
  ["heat", 0],
  ["dry", 1],
  ["cool", 2],
  ["fan_only", 3],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

const labels = [0x3d, 0x6d, 0xcd];

function section(label: number, data0: number, data1: number) {
  return Uint8Array.of(0x28, 0x61, label, data0, (~data0) & 0xff, data1, (~data1) & 0xff);
}

function button(bytes: Uint8Array, on: boolean) {
  const b = new Uint8Array(bytes);
  setBit(b, 5, 5, on);
  b[6] = (~b[5]) & 0xff;
  return b;
}

function build(s: ClimateState) {
  const data0 = 0x10 | fan.toRaw(s.fan) | (s.econo ? 0x08 : 0) | (s.swingV !== "off" ? 0x40 : 0);
  const data1 = (clamp(Math.round(s.temp), 17, 30) - 16) | (s.power ? 0x10 : 0) | (mode.toRaw(s.mode) << 6);
  const b = new Uint8Array(21);
  b.set(section(labels[0], data0, data1 | 0x20));
  b.set(section(labels[1], 0xff, 0xff), 7);
  b.set(section(labels[2], 0xff, 0xff), 14);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 5, 4),
    mode: mode.fromRaw(getBits(b, 5, 6, 2)),
    temp: getBits(b, 5, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 3, 0, 2)),
    swingV: getBit(b, 3, 6) ? "swing" : "off",
    swingH: "off",
    econo: getBit(b, 3, 3),
  };
}

function valid(b: Uint8Array) {
  if (b.length !== 21) return false;
  for (let s = 0; s < 3; s++) {
    const o = s * 7;
    if (b[o] !== 0x28 || b[o + 1] !== 0x61 || b[o + 2] !== labels[s]) return false;
    if (b[o + 4] !== ((~b[o + 3]) & 0xff) || b[o + 6] !== ((~b[o + 5]) & 0xff)) return false;
  }
  return true;
}

function readMessage(pulses: number[], start: number) {
  const r = new PulseReader(pulses);
  r.i = start;
  const b = new Uint8Array(21);
  for (let s = 0; s < 3; s++) {
    const part = r.frame(7, timing);
    if (!part) return null;
    b.set(part, s * 7);
  }
  return valid(b) ? { b, end: r.i } : null;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  for (const on of [false, true]) {
    const msg = button(bytes, on);
    for (let s = 0; s < 3; s++) w.frame(msg.subarray(s * 7, s * 7 + 7), timing);
  }
  return w.pulses;
}

function demodulate(pulses: number[]) {
  let last: Uint8Array | null = null;
  for (let i = 0; i + 1 < pulses.length; ) {
    const hit = readMessage(pulses, i);
    if (hit) {
      last = hit.b;
      i = Math.max(hit.end, i + 2);
    } else i += 2;
  }
  return last;
}

export const coronaAc: AcProtocol = {
  id: "corona_ac",
  name: "Corona",
  frequency: 38000,
  bits: 168,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Corona.h",
  capabilities: {
    modes: ["cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "swing"],
    swingH: ["off"],
    temp: { min: 17, max: 30, step: 1 },
    features: ["econo"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

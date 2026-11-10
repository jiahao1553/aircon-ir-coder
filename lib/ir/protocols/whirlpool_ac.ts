import { getBit, getBits, setBit, setBits, xorBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Whirlpool DG11J1-3A / DG11J1-91: 21 bytes LSB-first in three sections
// (6 bytes with header, 8 bytes, 7 bytes). Two XOR checksums. The power bit is a toggle.
const bit: Timing = {
  hdrMark: 0,
  hdrSpace: 0,
  bitMark: 597,
  oneSpace: 1649,
  zeroSpace: 533,
  footerMark: 597,
  gap: 7920,
};

const head: Timing = { ...bit, hdrMark: 8950, hdrSpace: 4484 };
const tail: Timing = { ...bit, gap: 100000 };

const mode = table([
  ["auto", 1],
  ["heat", 0],
  ["cool", 2],
  ["dry", 3],
  ["fan_only", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
] as const);

function checksum(b: Uint8Array) {
  b[13] = xorBytes(b, 2, 12);
  b[20] = xorBytes(b, 14, 20);
}

function build(s: ClimateState, variant = "dg11j13a") {
  const j191 = variant === "dg11j191";
  const b = new Uint8Array(21);
  b[0] = 0x83;
  b[1] = 0x06;
  b[6] = 0x80;
  const offset = j191 ? -2 : 0;
  const lo = 18 + offset;
  const hi = 32 + offset;
  let native = mode.toRaw(s.mode);
  let temp = clamp(Math.round(s.temp), lo, hi);
  let speed = fan.toRaw(s.fan);
  if (s.sleep) speed = fan.toRaw("low");
  if (s.turbo) {
    speed = fan.toRaw("high");
    if (native === 0) temp = hi;
    else {
      native = mode.toRaw("cool");
      temp = lo;
    }
  }
  setBits(b, 2, 0, 2, speed);
  setBit(b, 2, 2, s.power);
  setBit(b, 2, 3, s.sleep);
  setBit(b, 2, 7, s.swingV !== "off");
  setBits(b, 3, 0, 3, native);
  setBits(b, 3, 4, 4, temp - lo);
  setBit(b, 5, 4, s.turbo);
  setBit(b, 5, 7, s.turbo);
  setBit(b, 6, 5, s.light === false);
  setBit(b, 8, 6, s.swingV !== "off");
  b[15] = s.turbo ? 0x04 : 0x01;
  setBit(b, 18, 3, j191);
  checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const j191 = getBit(b, 18, 3);
  return {
    power: getBit(b, 2, 2),
    mode: mode.fromRaw(getBits(b, 3, 0, 3)),
    temp: getBits(b, 3, 4, 4) + 18 + (j191 ? -2 : 0),
    fan: fan.fromRaw(getBits(b, 2, 0, 2)),
    swingV: getBit(b, 2, 7) && getBit(b, 8, 6) ? "auto" : "off",
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
    (b[18] & 0x28) !== 0x28 &&
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
    const b = a && r.frame(8, bit);
    const c = b && r.frame(7, tail);
    if (!a || !b || !c) continue;
    const out = new Uint8Array(21);
    out.set(a, 0);
    out.set(b, 6);
    out.set(c, 14);
    if (valid(out)) return out;
  }
  return null;
}

export const whirlpoolAc: AcProtocol = {
  id: "whirlpool_ac",
  name: "Whirlpool DG11J1",
  frequency: 38000,
  bits: 168,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Whirlpool.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off"],
    temp: { min: 18, max: 32, step: 1 },
    features: ["turbo", "light", "sleep"],
  },
  variants: [
    { id: "dg11j13a", label: "DG11J1-3A", note: "18–32°C. Power is a toggle bit, not an absolute on/off." },
    { id: "dg11j191", label: "DG11J1-91", note: "16–30°C. Same toggle bit; the model flag is set." },
  ],
  powerToggle: true,
  build,
  parse,
  modulate,
  demodulate,
};

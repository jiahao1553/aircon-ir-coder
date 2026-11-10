import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseWriter, simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Neoclima NS-09AHTI / Soleus TTWM1: 12 bytes LSB-first. Byte 10 is 0xA5.
// Checksum is the sum of bytes 0–10. The frame ends with the header space, then an extra mark and gap.
const timing: Timing = {
  hdrMark: 6112,
  hdrSpace: 7391,
  bitMark: 537,
  oneSpace: 1651,
  zeroSpace: 571,
  footerMark: 537,
  gap: 7391,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xa5, 0]);
  const m = mode.toRaw(s.mode);
  setBits(b, 9, 5, 3, m);
  setBits(b, 9, 0, 5, clamp(Math.round(s.temp), 16, 32) - 16);
  setBits(b, 7, 5, 2, m === 2 ? 3 : fan.toRaw(s.fan));
  setBits(b, 7, 2, 2, s.swingV === "off" ? 0b10 : 0b01);
  setBit(b, 7, 4, s.swingH === "off");
  setBit(b, 3, 3, s.turbo);
  setBit(b, 3, 4, s.econo);
  setBit(b, 3, 0, s.light);
  setBit(b, 7, 0, s.sleep);
  setBit(b, 7, 1, s.power);
  b[11] = sumBytes(b, 0, 11);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 7, 1),
    mode: mode.fromRaw(getBits(b, 9, 5, 3)),
    temp: getBits(b, 9, 0, 5) + 16,
    fan: fan.fromRaw(getBits(b, 7, 5, 2)),
    swingV: getBits(b, 7, 2, 2) === 0b01 ? "auto" : "off",
    swingH: getBit(b, 7, 4) ? "off" : "auto",
    turbo: getBit(b, 3, 3),
    econo: getBit(b, 3, 4),
    light: getBit(b, 3, 0),
    sleep: getBit(b, 7, 0),
  };
}

const valid = (b: Uint8Array) => b[10] === 0xa5 && b[11] === sumBytes(b, 0, 11);
const frames = simpleFrames(timing, 12, valid);

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.frame(bytes, timing);
  w.mark(timing.bitMark);
  w.space(100000);
  return w.pulses;
}

export const neoclima: AcProtocol = {
  id: "neoclima",
  name: "Neoclima",
  frequency: 38000,
  bits: 96,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Neoclima.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 16, max: 32, step: 1 },
    features: ["turbo", "econo", "light", "sleep"],
  },
  build,
  parse,
  modulate,
  demodulate: frames.demodulate,
};

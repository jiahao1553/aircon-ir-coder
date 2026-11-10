import { getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Goodweather ZH/JT-03: 48-bit payload. Each byte is sent LSB-first followed by its inverse.
// There is no checksum; byte 5 is the constant 0xD5. A 1-bit has the short space.
const timing: Timing = {
  hdrMark: 6820,
  hdrSpace: 6820,
  bitMark: 580,
  oneSpace: 580,
  zeroSpace: 1860,
  footerMark: 580,
  gap: 100000,
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

const swing = table([
  ["off", 0b10],
  ["auto", 0b01],
  ["swing", 0b00],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(6);
  b[5] = 0xd5;
  setBit(b, 1, 0, s.light);
  setBit(b, 1, 3, s.turbo);
  setBits(b, 3, 5, 2, fan.toRaw(s.fan));
  setBits(b, 3, 2, 2, swing.toRaw(s.swingV));
  setBit(b, 3, 1, s.power);
  setBit(b, 3, 0, s.sleep);
  setBits(b, 4, 0, 4, clamp(Math.round(s.temp), 16, 31) - 16);
  setBits(b, 4, 5, 3, mode.toRaw(s.mode));
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 3, 1),
    mode: mode.fromRaw(getBits(b, 4, 5, 3)),
    temp: getBits(b, 4, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 3, 5, 2)),
    swingV: swing.fromRaw(getBits(b, 3, 2, 2)),
    swingH: "off",
    turbo: getBit(b, 1, 3),
    light: getBit(b, 1, 0),
    sleep: getBit(b, 3, 0),
  };
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  for (let i = 0; i < 6; i++) {
    w.bits(bytes[i] ?? 0, 8, timing);
    w.bits((~(bytes[i] ?? 0)) & 0xff, 8, timing);
  }
  w.mark(timing.bitMark);
  w.space(timing.hdrSpace);
  w.mark(timing.bitMark);
  w.space(timing.gap);
  return w.pulses;
}

/** A 1-bit is the short space, so the shared reader (which treats the long space as 1) cannot be used. */
function readByte(r: PulseReader) {
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const m = r.pulses[r.i];
    const s = r.pulses[r.i + 1];
    if (m === undefined || s === undefined || !r.matches(m, timing.bitMark)) return null;
    const one = s < (timing.oneSpace + timing.zeroSpace) / 2;
    r.i += 2;
    if (one) v |= 1 << i;
  }
  return v;
}

function demodulate(pulses: number[]) {
  const r = new PulseReader(pulses);
  if (!r.header(timing)) return null;
  const b = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    const v = readByte(r);
    const inv = readByte(r);
    if (v === null || inv === null || (v ^ inv) !== 0xff) return null;
    b[i] = v;
  }
  if (!r.mark(timing.bitMark) || !r.space(timing.hdrSpace) || !r.mark(timing.bitMark) || b[5] !== 0xd5) return null;
  return b;
}

export const goodweather: AcProtocol = {
  id: "goodweather",
  name: "Goodweather",
  frequency: 38000,
  bits: 48,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Goodweather.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto", "swing"],
    swingH: ["off"],
    temp: { min: 16, max: 31, step: 1 },
    features: ["turbo", "light", "sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

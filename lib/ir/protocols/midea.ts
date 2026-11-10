import { getBit, getBits, reverseBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 48-bit Midea word, LSB-first: byte 0 is the checksum. Sent MSB-first, then the whole frame inverted.
const timing: Timing = {
  hdrMark: 4480,
  hdrSpace: 4480,
  bitMark: 560,
  oneSpace: 1680,
  zeroSpace: 560,
  footerMark: 560,
  gap: 5600,
  msbFirst: true,
};

const BASE = Uint8Array.from([0x62, 0xff, 0xff, 0x6f, 0x82, 0xa1]);

const mode = table([
  ["auto", 2],
  ["cool", 0],
  ["dry", 1],
  ["heat", 3],
  ["fan_only", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

function checksum(b: Uint8Array) {
  let sum = 0;
  for (let i = 1; i < 6; i++) sum += reverseBits(b[i]);
  return reverseBits((0x100 - (sum & 0xff)) & 0xff);
}

function valid(b: Uint8Array) {
  return b.length === 6 && b[5] >> 3 === 0b10100 && b[0] === checksum(b);
}

function build(s: ClimateState) {
  const b = new Uint8Array(BASE);
  setBit(b, 3, 5, false);
  setBits(b, 3, 0, 5, clamp(Math.round(s.temp), 17, 30) - 17);
  setBits(b, 4, 0, 3, mode.toRaw(s.mode));
  setBits(b, 4, 3, 2, fan.toRaw(s.fan));
  setBit(b, 4, 6, s.sleep);
  setBit(b, 4, 7, s.power);
  b[0] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const celsius = !getBit(b, 3, 5);
  const raw = getBits(b, 3, 0, 5);
  const temp = celsius ? raw + 17 : Math.round(((raw + 62 - 32) * 5) / 9);
  return {
    power: getBit(b, 4, 7),
    mode: mode.fromRaw(getBits(b, 4, 0, 3)),
    temp,
    fan: fan.fromRaw(getBits(b, 4, 3, 2)),
    swingV: "off",
    swingH: "off",
    sleep: getBit(b, 4, 6),
  };
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  const phase = (invert: boolean, gap: number) => {
    w.header(timing);
    for (let i = bytes.length - 1; i >= 0; i--) w.bits(invert ? bytes[i] ^ 0xff : bytes[i], 8, timing);
    w.mark(timing.footerMark);
    w.space(gap);
  };
  phase(false, timing.gap);
  phase(true, timing.gap + 100000);
  return w.pulses;
}

function readPhase(r: PulseReader) {
  if (!r.header(timing)) return null;
  const msb = r.bytes(6, timing);
  if (!msb || !r.mark(timing.footerMark) || !r.gap(timing.gap)) return null;
  return msb;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const msb = readPhase(r);
    const inv = msb && readPhase(r);
    if (!msb || !inv) continue;
    if (msb.some((v, i) => v !== (inv[i] ^ 0xff))) continue;
    const b = Uint8Array.from(msb).reverse();
    if (valid(b)) return b;
  }
  return null;
}

export const midea: AcProtocol = {
  id: "midea",
  name: "Midea",
  frequency: 38000,
  bits: 48,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Midea.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: [],
    swingH: [],
    temp: { min: 17, max: 30, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

import { getBits, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Fan, Mode } from "../core/types";

// Truma Aventa: 56 bits LSB-first, mark-width bits, a 20 ms leader, then the header.
// Stored little-endian. Checksum is 5 plus the first six bytes. Off forces the mode field to fan.
const timing: Timing = {
  hdrMark: 1800,
  hdrSpace: 630,
  bitMark: 600,
  oneMark: 600,
  zeroMark: 1200,
  oneSpace: 630,
  zeroSpace: 630,
  footerMark: 600,
  gap: 100000,
};

const LEADER = [20200, 1000];

const mode = table([
  ["auto", 0],
  ["cool", 2],
  ["fan_only", 3],
] as const);

const fan = table([
  ["high", 4],
  ["quiet", 3],
  ["medium", 5],
  ["low", 6],
] as const);

function checksum(b: Uint8Array) {
  let sum = 5;
  for (let i = 0; i < 6; i++) sum += b[i];
  return sum & 0xff;
}

function build(s: ClimateState) {
  const b = Uint8Array.from([0x81, 0xe7, 0xe6, 0xff, 0xff, 0xff, 0x00]);
  const native = mode.toRaw(s.mode);
  const quiet = (s.fan === "quiet" || s.quiet) && native === 2 && s.power;
  const speed: Fan = quiet ? "quiet" : s.fan === "quiet" ? "high" : s.fan;
  setBits(b, 1, 0, 2, s.power ? native : 3);
  setBits(b, 1, 2, 1, s.power ? 0 : 1);
  setBits(b, 1, 3, 3, fan.toRaw(speed));
  setBits(b, 1, 6, 2, 0b11);
  setBits(b, 2, 0, 5, clamp(Math.round(s.temp), 16, 31) - 10);
  setBits(b, 2, 5, 3, 0b111);
  b[6] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const speed = fan.fromRaw(getBits(b, 1, 3, 3));
  const native = getBits(b, 1, 0, 2);
  const power = getBits(b, 1, 2, 1) === 0;
  const modeName: Mode | undefined = power ? mode.fromRaw(native) : "fan_only";
  return {
    power,
    mode: modeName,
    temp: getBits(b, 2, 0, 5) + 10,
    fan: speed,
    swingV: "off",
    swingH: "off",
    quiet: speed === "quiet",
  };
}

function valid(b: Uint8Array) {
  return b.length >= 7 && b[0] === 0x81 && b[3] === 0xff && b[4] === 0xff && b[5] === 0xff && b[6] === checksum(b);
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.mark(LEADER[0]);
  w.space(LEADER[1]);
  w.frame(bytes, timing);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.mark(LEADER[0]) || !r.space(LEADER[1])) continue;
    const b = r.frame(7, timing);
    if (b && valid(b)) return b;
  }
  return null;
}

export const truma: AcProtocol = {
  id: "truma",
  name: "Truma Aventa",
  frequency: 38000,
  bits: 56,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Truma.h",
  capabilities: {
    modes: ["auto", "cool", "fan_only"],
    fans: ["quiet", "low", "medium", "high"],
    swingV: ["off"],
    swingH: ["off"],
    temp: { min: 16, max: 31, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate,
  demodulate,
};

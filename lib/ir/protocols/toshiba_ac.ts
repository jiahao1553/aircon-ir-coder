import { getBits, setBit, setBits, xorBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Toshiba A/C: MSB-first frames of 7 (swing only), 9 (normal) or 10 (turbo/econo) bytes; byte 2's low nibble is
// length - 6, bytes 1 and 3 invert bytes 0 and 2, last byte XORs the rest. Each frame is sent twice. The payload
// is the settings frame followed by the 7-byte swing frame the remote sends after it.
const timing: Timing = {
  hdrMark: 4400,
  hdrSpace: 4300,
  bitMark: 580,
  oneSpace: 1600,
  zeroSpace: 490,
  footerMark: 580,
  gap: 7400,
  msbFirst: true,
};

const OFF = 7;
const SWING_ON = 1;
const SWING_OFF = 2;
const TURBO = 1;
const ECONO = 3;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["heat", 3],
  ["fan_only", 4],
] as const);

/** Raw fan field; the remote skips value 1. */
const fan = table([
  ["auto", 0],
  ["min", 2],
  ["low", 3],
  ["medium", 4],
  ["high", 5],
  ["max", 6],
] as const);

function finish(b: Uint8Array, length: number) {
  setBits(b, 2, 0, 4, length - 6);
  setBit(b, 4, 5, length === 7);
  setBit(b, 4, 3, length === 10);
  b[1] = ~b[0] & 0xff;
  b[3] = ~b[2] & 0xff;
  const out = b.slice(0, length);
  out[length - 1] = xorBytes(out, 0, length - 1);
  return out;
}

function build(s: ClimateState, variant = "remote_a") {
  const b = Uint8Array.from([0xf2, 0x0d, 0x03, 0xfc, 0x01, 0, 0, 0, 0, 0]);
  setBits(b, 2, 4, 4, variant === "remote_b" ? 1 : 0);
  let length = 9;
  setBits(b, 6, 0, 3, mode.toRaw(s.mode));
  setBits(b, 5, 4, 4, clamp(Math.round(s.temp), 17, 30) - 17);
  setBits(b, 6, 5, 3, fan.toRaw(s.fan));
  if (s.turbo) {
    b[8] = TURBO;
    length = 10;
  }
  if (s.econo) {
    b[8] = ECONO;
    length = 10;
  }
  if (!s.power) {
    setBits(b, 6, 0, 3, OFF);
    length = 9;
  }
  const main = finish(Uint8Array.from(b), length);
  setBits(b, 5, 4, 4, 0);
  setBits(b, 5, 0, 3, s.swingV === "off" ? SWING_OFF : SWING_ON);
  return Uint8Array.from([...main, ...finish(b, 7)]);
}

const frameLength = (b: Uint8Array, at = 0) => (b[at + 2] & 0xf) + 6;

function parse(b: Uint8Array): Partial<ClimateState> {
  const out: Partial<ClimateState> = {};
  let at = 0;
  if (frameLength(b) !== 7) {
    const n = frameLength(b);
    const m = getBits(b, 6, 0, 3);
    out.power = m !== OFF;
    if (m !== OFF) out.mode = mode.fromRaw(m);
    out.temp = getBits(b, 5, 4, 4) + 17;
    out.fan = fan.fromRaw(getBits(b, 6, 5, 3));
    out.turbo = n === 10 && b[8] === TURBO;
    out.econo = n === 10 && b[8] === ECONO;
    at = n;
  }
  if (at < b.length) out.swingV = getBits(b, at + 5, 0, 3) === SWING_OFF ? "off" : "auto";
  return out;
}

function validFrame(f: Uint8Array) {
  return (
    f.length >= 7 &&
    f[0] === 0xf2 &&
    f[1] === (~f[0] & 0xff) &&
    f[3] === (~f[2] & 0xff) &&
    frameLength(f) === f.length &&
    f[f.length - 1] === xorBytes(f, 0, f.length - 1)
  );
}

function readFrame(r: PulseReader) {
  const start = r.i;
  if (!r.header(timing)) return null;
  const bytes: number[] = [];
  for (;;) {
    const at = r.i;
    const v = r.bits(8, timing);
    if (v === null) {
      r.i = at;
      break;
    }
    bytes.push(Number(v));
  }
  const f = Uint8Array.from(bytes);
  if (!r.footer(timing) || !validFrame(f)) {
    r.i = start;
    return null;
  }
  return f;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  for (let at = 0; at < bytes.length; ) {
    const f = bytes.subarray(at, at + frameLength(bytes, at));
    w.frame(f, timing);
    w.frame(f, timing);
    at += f.length;
  }
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const frames: Uint8Array[] = [];
    for (let f = readFrame(r); f; f = readFrame(r)) {
      const last = frames[frames.length - 1];
      if (!last || last.join() !== f.join()) frames.push(f);
    }
    if (!frames.length) continue;
    const [first, second] = frames;
    if (first.length !== 7 && second?.length === 7) return Uint8Array.from([...first, ...second]);
    return first;
  }
  return null;
}

export const toshibaAc: AcProtocol = {
  id: "toshiba_ac",
  name: "Toshiba A/C",
  frequency: 38000,
  bits: 72,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Toshiba.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 17, max: 30, step: 1 },
    features: ["turbo", "econo"],
  },
  variants: [
    {
      id: "remote_a",
      label: "Remote A (WH-UB03NJ, WH-TA01JE, WH-TG01NE; RAS-B13N3KV2, RAS-2558V, Carrier 42NQV)",
      note: "Default model nibble 0.",
    },
    { id: "remote_b", label: "Remote B", note: "Model nibble 1 in byte 2; otherwise identical." },
  ],
  build,
  parse,
  modulate,
  demodulate,
};

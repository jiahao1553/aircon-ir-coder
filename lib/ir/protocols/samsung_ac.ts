import { countBits, getBit, getBits, setBit, setBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Samsung A/C: 7-byte LSB-first sections, each with a popcount checksum. `build` always emits the 21-byte
// extended form (settings section + power/timer section) that the remote sends when power changes; 14-byte
// standard captures are accepted by `demodulate`/`parse` too.
const section: Timing = {
  hdrMark: 3086,
  hdrSpace: 8864,
  bitMark: 586,
  oneSpace: 1432,
  zeroSpace: 436,
  footerMark: 586,
  gap: 2886,
};
const HDR_MARK = 690;
const HDR_SPACE = 17844;
const MESSAGE_GAP = 100000;

const RESET = [0x02, 0x92, 0x0f, 0x00, 0x00, 0x00, 0xf0];
const EXTENDED_MIDDLE = [0x01, 0xd2, 0x0f, 0x00, 0x00, 0x00, 0x00];
const RESET_SETTINGS = [0x01, 0x02, 0xae, 0x71, 0x00, 0x15, 0xf0];

const SWING_V = 0b010;
const SWING_H = 0b011;
const SWING_BOTH = 0b100;
const SWING_OFF = 0b111;
const POWERFUL = 0b011;
const BREEZE = 0b101;
const ECONO = 0b111;
const FAN_AUTO2 = 6;
const FAN_TURBO = 7;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 2],
  ["medium", 4],
  ["high", 5],
  ["max", FAN_TURBO],
] as const);

function sectionChecksum(b: Uint8Array, s: number) {
  const n = countBits(b, s, s + 1) + countBits([b[s + 1] & 0xf]) + countBits([b[s + 2] >> 4]) + countBits(b, s + 3, s + 7);
  return (n ^ 0xff) & 0xff;
}

function fixChecksums(b: Uint8Array) {
  for (let s = 0; s + 7 <= b.length; s += 7) {
    const sum = sectionChecksum(b, s);
    setBits(b, s + 1, 4, 4, sum & 0xf);
    setBits(b, s + 2, 0, 4, sum >> 4);
  }
}

/** Mirrors the remote's setter rules on the settings section starting at byte `o`. */
function settings(b: Uint8Array, o: number) {
  const get = {
    swing: () => getBits(b, o + 2, 4, 3),
    special: () => getBits(b, o + 3, 1, 3),
    fan: () => getBits(b, o + 5, 1, 3),
    mode: () => getBits(b, o + 5, 4, 3),
  };
  const swingVOn = () => [SWING_V, SWING_BOTH].includes(get.swing());
  const swingHOn = () => [SWING_H, SWING_BOTH].includes(get.swing());
  const powerful = () => get.special() === POWERFUL && get.fan() === FAN_TURBO;
  const breeze = () => get.special() === BREEZE && get.fan() === 0 && !swingVOn();
  const econo = () => get.special() === ECONO && get.fan() === 0 && swingVOn();
  const ops = {
    ...get,
    swingVOn,
    swingHOn,
    powerful,
    econo,
    setMode(m: number) {
      setBits(b, o + 5, 4, 3, m);
      if (m === 0) setBits(b, o + 5, 1, 3, FAN_AUTO2);
      else if (get.fan() === FAN_AUTO2) setBits(b, o + 5, 1, 3, 0);
    },
    setFan(speed: number) {
      if ((speed === FAN_AUTO2) !== (get.mode() === 0)) return;
      setBits(b, o + 5, 1, 3, speed);
    },
    setSwingV(on: boolean) {
      const h = swingHOn();
      setBits(b, o + 2, 4, 3, on ? (h ? SWING_BOTH : SWING_V) : h ? SWING_H : SWING_OFF);
    },
    setSwingH(on: boolean) {
      const v = swingVOn();
      setBits(b, o + 2, 4, 3, on ? (v ? SWING_BOTH : SWING_H) : v ? SWING_V : SWING_OFF);
    },
    setQuiet(on: boolean) {
      setBit(b, 5, 5, on);
      if (on) {
        ops.setFan(0);
        ops.setPowerful(false);
      }
    },
    setPowerful(on: boolean) {
      const off = breeze() || econo() ? get.special() : 0;
      setBits(b, o + 3, 1, 3, on ? POWERFUL : off);
      if (on) {
        ops.setFan(FAN_TURBO);
        ops.setQuiet(false);
      }
    },
    setEcono(on: boolean) {
      const off = breeze() || powerful() ? get.special() : 0;
      setBits(b, o + 3, 1, 3, on ? ECONO : off);
      if (on) {
        ops.setFan(0);
        ops.setSwingV(true);
      }
    },
  };
  return ops;
}

function build(s: ClimateState) {
  const b = Uint8Array.from([...RESET, ...EXTENDED_MIDDLE, ...RESET_SETTINGS]);
  const o = 14;
  const a = settings(b, o);
  const power = s.power ? 0b11 : 0;
  setBits(b, 6, 4, 2, power);
  setBits(b, o + 6, 4, 2, power);
  a.setMode(mode.toRaw(s.mode));
  setBits(b, o + 4, 4, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  a.setFan(fan.toRaw(s.fan));
  a.setSwingV(s.swingV !== "off");
  a.setSwingH(s.swingH !== "off");
  if (s.quiet !== undefined) a.setQuiet(s.quiet);
  if (s.turbo !== undefined) a.setPowerful(s.turbo);
  if (s.light !== undefined) setBit(b, o + 3, 4, s.light);
  if (s.econo !== undefined) a.setEcono(s.econo);
  if (s.clean !== undefined) {
    setBit(b, o + 3, 7, s.clean);
    setBit(b, o + 4, 1, s.clean);
  }
  if (s.beep !== undefined) setBit(b, o + 6, 2, s.beep);
  a.setMode(mode.toRaw(s.mode));
  fixChecksums(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const o = b.length - 7;
  const a = settings(Uint8Array.from(b), o);
  const f = a.fan();
  return {
    power: getBits(b, 6, 4, 2) === 0b11 && getBits(b, o + 6, 4, 2) === 0b11,
    mode: mode.fromRaw(a.mode()),
    temp: getBits(b, o + 4, 4, 4) + 16,
    fan: f === FAN_AUTO2 ? "auto" : fan.fromRaw(f),
    swingV: a.swingVOn() ? "auto" : "off",
    swingH: a.swingHOn() ? "auto" : "off",
    quiet: getBit(b, 5, 5),
    turbo: a.powerful(),
    econo: a.econo(),
    light: getBit(b, o + 3, 4),
    clean: getBit(b, o + 3, 7) && getBit(b, o + 4, 1),
    beep: getBit(b, o + 6, 2),
  };
}

function valid(b: Uint8Array) {
  for (let s = 0; s < b.length; s += 7) {
    if (b[s] !== (s === 0 ? 0x02 : 0x01)) return false;
    if (((getBits(b, s + 2, 0, 4) << 4) | getBits(b, s + 1, 4, 4)) !== sectionChecksum(b, s)) return false;
  }
  return true;
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.mark(HDR_MARK);
  w.space(HDR_SPACE);
  for (let s = 0; s < bytes.length; s += 7) w.frame(bytes.subarray(s, s + 7), section);
  w.space(MESSAGE_GAP - section.gap);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    if (!r.mark(HDR_MARK) || !r.space(HDR_SPACE)) continue;
    const parts: number[] = [];
    for (let n = 0; n < 3; n++) {
      const part = r.frame(7, section);
      if (!part) break;
      parts.push(...part);
    }
    const truncated = parts.length < 21 && r.mark(section.hdrMark);
    const b = Uint8Array.from(parts);
    if (b.length >= 14 && !truncated && valid(b)) return b;
  }
  return null;
}

export const samsungAc: AcProtocol = {
  id: "samsung_ac",
  name: "Samsung A/C",
  frequency: 38000,
  bits: 168,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Samsung.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["quiet", "turbo", "econo", "light", "clean", "beep"],
  },
  build,
  parse,
  modulate,
  demodulate,
};

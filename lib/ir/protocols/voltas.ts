import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Voltas window A/C: 10 bytes MSB-first, no header, checksum is the inverted byte sum.
// 122LZF keeps the horizontal-swing "no change" pattern; other units send a swing-change word.
const timing: Timing = {
  hdrMark: 0,
  hdrSpace: 0,
  bitMark: 1026,
  oneSpace: 2553,
  zeroSpace: 554,
  footerMark: 1026,
  gap: 100000,
  msbFirst: true,
};

const TEMPLATE = [0x33, 0x28, 0x00, 0x17, 0x3b, 0x3b, 0x3b, 0x11, 0x00, 0x00];
const SWING_CHANGE = 0b1111100;
const SWING_NONE = 0b0011001;

const mode = table([
  ["cool", 0b1000],
  ["heat", 0b0010],
  ["dry", 0b0100],
  ["fan_only", 0b0001],
] as const);

const fan = table([
  ["auto", 0b111],
  ["high", 0b001],
  ["medium", 0b010],
  ["low", 0b100],
] as const);

function build(s: ClimateState, variant = "122lzf") {
  const b = Uint8Array.from(TEMPLATE);
  const native = mode.toRaw(s.mode);
  const speed = native === 0b0001 && (s.fan === "auto" || fan.toRaw(s.fan) === 0b111) ? fan.toRaw("high") : fan.toRaw(s.fan);
  setBits(b, 1, 0, 4, native);
  setBits(b, 1, 5, 3, speed);
  setBits(b, 3, 0, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBit(b, 2, 7, s.power);
  setBits(b, 2, 0, 3, s.swingV === "off" ? 0 : 0b111);
  const cool = native === 0b1000;
  setBit(b, 2, 5, cool && s.turbo);
  setBit(b, 2, 6, cool && s.sleep);
  setBit(b, 3, 6, cool && s.econo);
  setBit(b, 8, 5, s.light);
  if (variant === "122lzf") {
    setBits(b, 0, 1, 7, SWING_NONE);
    setBit(b, 0, 0, true);
  } else {
    setBits(b, 0, 1, 7, SWING_CHANGE);
    setBit(b, 0, 0, s.swingH !== "off");
  }
  b[9] = (~sumBytes(b, 0, 9)) & 0xff;
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const change = getBits(b, 0, 1, 7) === SWING_CHANGE;
  return {
    power: getBit(b, 2, 7),
    mode: mode.fromRaw(getBits(b, 1, 0, 4)),
    temp: getBits(b, 3, 0, 4) + 16,
    fan: fan.fromRaw(getBits(b, 1, 5, 3)),
    swingV: getBits(b, 2, 0, 3) === 0b111 ? "auto" : "off",
    swingH: !change || !getBit(b, 0, 0) ? "off" : "auto",
    turbo: getBit(b, 2, 5),
    sleep: getBit(b, 2, 6),
    econo: getBit(b, 3, 6),
    light: getBit(b, 8, 5),
  };
}

const valid = (b: Uint8Array) => b.length >= 10 && b[9] === ((~sumBytes(b, 0, 9)) & 0xff);

const frames = simpleFrames(timing, 10, valid);

export const voltas: AcProtocol = {
  id: "voltas",
  name: "Voltas 122LZF",
  frequency: 38000,
  bits: 80,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Voltas.h",
  capabilities: {
    modes: ["cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "econo", "light", "sleep"],
  },
  variants: [
    { id: "122lzf", label: "122LZF", note: "No horizontal swing; the swing-change bits stay at the no-change pattern." },
    { id: "swing", label: "Swing model", note: "Horizontal swing sets the change bits." },
  ],
  build,
  parse,
  ...frames,
};

import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Mitsubishi Electric 144-bit: 18 bytes LSB-first, signature 23 CB 26 01 00, byte-sum checksum, sent twice.
const timing: Timing = {
  hdrMark: 3400,
  hdrSpace: 1750,
  bitMark: 450,
  oneSpace: 1300,
  zeroSpace: 420,
  footerMark: 440,
  gap: 15500,
};

const SIGNATURE = [0x23, 0xcb, 0x26, 0x01, 0x00];

const mode = table([
  ["auto", 0b100],
  ["cool", 0b011],
  ["dry", 0b010],
  ["heat", 0b001],
  ["fan_only", 0b111],
] as const);

/** Low nibble of byte 8 written alongside each mode. */
const modeNibble = { auto: 0, cool: 6, dry: 2, heat: 0, fan_only: 7 } as const;

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["max", 4],
  ["quiet", 5],
] as const);

const vane = table([
  ["auto", 0],
  ["highest", 1],
  ["high", 2],
  ["middle", 3],
  ["low", 4],
  ["lowest", 5],
  ["swing", 7],
] as const);

const wideVane = table([
  ["middle", 3],
  ["left_max", 1],
  ["left", 2],
  ["right", 4],
  ["right_max", 5],
  ["wide", 6],
  ["auto", 8],
] as const);

function build(s: ClimateState, variant = "standard") {
  const b = new Uint8Array(18);
  b.set(SIGNATURE);
  const m = s.mode;
  const temp = clamp(s.temp, 16, 31);
  setBit(b, 5, 5, s.power);
  setBits(b, 6, 3, 3, mode.toRaw(m));
  b[8] = modeNibble[m] ?? 0;
  setBits(b, 8, 4, 4, wideVane.toRaw(s.swingH));
  setBits(b, 9, 0, 3, fan.toRaw(s.fan));
  setBits(b, 9, 3, 3, vane.toRaw(s.swingV));
  setBit(b, 9, 6, true);

  if (variant === "msxy") {
    const flat = m === "dry" || m === "fan_only";
    setBits(b, 7, 0, 4, flat ? 8 : Math.floor(temp) - 16);
    if (m === "fan_only") b[8] = 0x30;
    if ((m === "cool" && (temp === 16 || temp === 31)) || (flat && s.fan === "auto")) {
      setBit(b, 9, 6, false);
      setBit(b, 9, 7, true);
    }
  } else {
    setBits(b, 7, 0, 4, Math.floor(temp) - 16);
    setBit(b, 7, 4, temp % 1 !== 0);
    if (variant === "standard") setBit(b, 9, 7, s.fan === "auto");
  }
  b[17] = sumBytes(b, 0, 17);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 5, 5),
    mode: mode.fromRaw(getBits(b, 6, 3, 3)),
    temp: getBits(b, 7, 0, 4) + 16 + (getBit(b, 7, 4) ? 0.5 : 0),
    fan: fan.fromRaw(getBits(b, 9, 0, 3)),
    swingV: vane.fromRaw(getBits(b, 9, 3, 3)),
    swingH: wideVane.fromRaw(getBits(b, 8, 4, 4)),
  };
}

const valid = (b: Uint8Array) => SIGNATURE.every((v, i) => b[i] === v) && b[17] === sumBytes(b, 0, 17);

export const mitsubishiAc: AcProtocol = {
  id: "mitsubishi_ac",
  name: "Mitsubishi Electric 144-bit",
  frequency: 38000,
  bits: 144,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Mitsubishi.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "low", "medium", "high", "max"],
    swingV: ["auto", "swing", "highest", "high", "middle", "low", "lowest"],
    swingH: ["middle", "auto", "left_max", "left", "right", "right_max", "wide"],
    temp: { min: 16, max: 31, step: 0.5 },
    features: [],
  },
  variants: [
    { id: "standard", label: "MSZ remotes", note: "Sets the fan-auto flag when the fan is on auto." },
    { id: "mr_slim", label: "Mr. Slim", note: "Same layout, but auto fan leaves the fan-auto flag clear." },
    {
      id: "msxy",
      label: "MSXY-FP",
      note: "Whole degrees; dry and fan send 24°C; the flag moves at 16/31°C and on auto fan outside cool.",
    },
  ],
  build,
  parse,
  ...simpleFrames(timing, 18, valid, 2),
};

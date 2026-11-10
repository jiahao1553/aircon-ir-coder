import { getBit, getBits, setBit, setBits, sumNibbles } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Mirage 120-bit. KKG9 (Maxell KKG9A-C1) keeps the reset template, including the unused 0x0C bytes.
// KKG29 (Tronitechnik KKG29A-C1) is a separate layout in the same 15 bytes. Checksum is the nibble sum.
const timing: Timing = {
  hdrMark: 8360,
  hdrSpace: 4248,
  bitMark: 554,
  oneSpace: 1592,
  zeroSpace: 545,
  footerMark: 554,
  gap: 100000,
};

const RESET = [0x56, 0x6c, 0x00, 0x00, 0x20, 0x1a, 0x00, 0x00, 0x0c, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x42];

const mode = table([
  ["heat", 1],
  ["cool", 2],
  ["dry", 3],
  ["fan_only", 5],
] as const);

const fan9 = table([
  ["auto", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
] as const);

const fan29 = table([
  ["auto", 0],
  ["high", 1],
  ["low", 2],
  ["medium", 3],
] as const);

const swing = table([
  ["off", 0],
  ["lowest", 3],
  ["low", 5],
  ["middle", 7],
  ["high", 9],
  ["highest", 11],
  ["auto", 13],
] as const);

function finish(b: Uint8Array) {
  b[14] = sumNibbles(b, 0, 14) & 0xff;
  return b;
}

function kkg29(b: Uint8Array) {
  if (getBit(b, 6, 6) || getBit(b, 6, 1) || getBit(b, 6, 3) || getBit(b, 7, 6) || getBit(b, 7, 7) || getBit(b, 4, 2) || getBit(b, 4, 3))
    return true;
  if (b[12] || b[11] || getBits(b, 10, 0, 5) || getBits(b, 11, 0, 6) || getBits(b, 8, 0, 5) || getBits(b, 9, 0, 6)) return false;
  return true;
}

function build(s: ClimateState, variant = "kkg9ac1") {
  const cool = mode.toRaw(s.mode) === 2;
  const temp = clamp(Math.round(s.temp), 16, 32);
  if (variant === "kkg29ac1") {
    const b = new Uint8Array(15);
    b[0] = 0x56;
    b[1] = temp + 0x5c;
    setBits(b, 4, 0, 2, fan29.toRaw(s.fan));
    setBits(b, 4, 4, 3, mode.toRaw(s.mode));
    setBit(b, 5, 0, s.swingH !== "off");
    setBit(b, 5, 1, s.swingV !== "off");
    setBit(b, 5, 2, s.light);
    setBits(b, 5, 6, 2, s.power ? 0 : 3);
    setBit(b, 3, 0, s.quiet);
    setBit(b, 6, 3, s.sleep);
    setBit(b, 8, 7, s.turbo && cool);
    return finish(b);
  }
  const b = Uint8Array.from(RESET);
  b[1] = temp + 0x5c;
  setBits(b, 4, 0, 2, fan9.toRaw(s.fan));
  setBits(b, 4, 4, 4, mode.toRaw(s.mode));
  setBits(b, 5, 1, 7, (swing.toRaw(s.swingV) + (s.power ? 0 : 0x5f)) & 0x7f);
  setBit(b, 3, 3, s.light);
  setBit(b, 6, 7, s.sleep);
  setBit(b, 7, 3, s.turbo && cool);
  return finish(b);
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const v29 = kkg29(b);
  if (v29) {
    return {
      power: getBits(b, 5, 6, 2) === 0,
      mode: mode.fromRaw(getBits(b, 4, 4, 3)),
      temp: b[1] - 0x5c,
      fan: fan29.fromRaw(getBits(b, 4, 0, 2)),
      swingV: getBit(b, 5, 1) ? "auto" : "off",
      swingH: getBit(b, 5, 0) ? "auto" : "off",
      turbo: getBit(b, 8, 7),
      sleep: getBit(b, 6, 3),
      light: getBit(b, 5, 2),
      quiet: getBit(b, 3, 0),
    };
  }
  const pos = getBits(b, 5, 1, 7);
  const on = pos < 0x5f;
  return {
    power: on,
    mode: mode.fromRaw(getBits(b, 4, 4, 4)),
    temp: b[1] - 0x5c,
    fan: fan9.fromRaw(getBits(b, 4, 0, 2)),
    swingV: swing.fromRaw(on ? pos : pos - 0x5f),
    swingH: "off",
    turbo: getBit(b, 7, 3),
    sleep: getBit(b, 6, 7),
    light: getBit(b, 3, 3),
    quiet: false,
  };
}

const valid = (b: Uint8Array) => b[0] === 0x56 && b[14] === (sumNibbles(b, 0, 14) & 0xff);

export const mirage: AcProtocol = {
  id: "mirage",
  name: "Mirage",
  frequency: 38000,
  bits: 120,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Mirage.h",
  capabilities: {
    modes: ["cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off"],
    temp: { min: 16, max: 32, step: 1 },
    features: ["turbo", "light", "sleep"],
  },
  variants: [
    { id: "kkg9ac1", label: "KKG9A-C1", note: "Maxell MX-CH18CF. Swing is a vane position. Power off adds 0x5F to that position." },
    {
      id: "kkg29ac1",
      label: "KKG29A-C1",
      note: "Tronitechnik Reykir 9000. Swing is on/off, plus horizontal swing and quiet. Clock and timers are not encoded.",
    },
  ],
  build,
  parse,
  ...simpleFrames(timing, 15, valid),
};

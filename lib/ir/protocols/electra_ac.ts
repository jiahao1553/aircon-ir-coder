import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 13 bytes, LSB-first. Byte 0 is 0xC3. Byte 12 is the byte sum. Light-on is 0x15, or 0x19 on some remotes.
const timing: Timing = {
  hdrMark: 9166,
  hdrSpace: 4470,
  bitMark: 646,
  oneSpace: 1647,
  zeroSpace: 547,
  footerMark: 646,
  gap: 100000,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["heat", 4],
  ["fan_only", 6],
] as const);

const fan = table([
  ["auto", 0b101],
  ["low", 0b011],
  ["medium", 0b010],
  ["high", 0b001],
] as const);

function checksum(b: Uint8Array) {
  return sumBytes(b, 0, 12);
}

function valid(b: Uint8Array) {
  return b.length === 13 && b[0] === 0xc3 && b[12] === checksum(b);
}

function build(s: ClimateState, variant = "standard") {
  const b = new Uint8Array(13);
  b[0] = 0xc3;
  setBits(b, 1, 0, 3, s.swingV === "off" ? 0b111 : 0);
  setBits(b, 1, 3, 5, clamp(Math.round(s.temp), 16, 32) - 8);
  setBits(b, 2, 5, 3, s.swingH === "off" ? 0b111 : 0);
  setBits(b, 4, 5, 3, fan.toRaw(s.fan));
  setBit(b, 5, 6, s.turbo);
  setBit(b, 5, 7, s.quiet);
  setBits(b, 6, 5, 3, mode.toRaw(s.mode));
  setBit(b, 9, 2, s.clean);
  setBit(b, 9, 5, s.power);
  b[11] = s.light ? (variant === "alt" ? 0x19 : 0x15) : variant === "off05" ? 0x05 : 0x08;
  b[12] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 9, 5),
    mode: mode.fromRaw(getBits(b, 6, 5, 3)),
    temp: getBits(b, 1, 3, 5) + 8,
    fan: fan.fromRaw(getBits(b, 4, 5, 3)),
    swingV: getBits(b, 1, 0, 3) === 0 ? "swing" : "off",
    swingH: getBits(b, 2, 5, 3) === 0 ? "swing" : "off",
    clean: getBit(b, 9, 2),
    light: (b[11] & 0x11) === 0x11,
    turbo: getBit(b, 5, 6),
    quiet: getBit(b, 5, 7),
  };
}

export const electraAc: AcProtocol = {
  id: "electra_ac",
  name: "Electra / AUX",
  frequency: 38000,
  bits: 104,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Electra.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "swing"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 32, step: 1 },
    features: ["turbo", "quiet", "clean", "light"],
  },
  variants: [
    { id: "standard", label: "YKR-M/003E", note: "Light-on byte is 0x15, the value the reference setter writes." },
    { id: "alt", label: "Light on 0x19", note: "Some YKR captures use 0x19 for light-on instead of 0x15." },
    { id: "off05", label: "Light off 0x05", note: "The other documented light-off byte. The setter writes 0x08." },
  ],
  build,
  parse,
  ...simpleFrames(timing, 13, valid),
};

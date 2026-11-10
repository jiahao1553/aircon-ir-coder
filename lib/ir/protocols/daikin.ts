import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, quietTurboEcono, seal, sealed, swingBool, zeroLeader } from "./_daikin";

// ARC433** / M Series / FTXM-M. 35 bytes, 5-bit leader, three sections.
const bit = { bitMark: 428, oneSpace: 1280, zeroSpace: 428 };
const section = { hdrMark: 3650, hdrSpace: 1623, footerMark: 428, gap: 428 + 29000 };

function template() {
  return fromHex(`
    11 DA 27 00 C5 00 00 00
    11 DA 27 00 42 00 00 00
    11 DA 27 00 00 49 1E 00
    B0 00 00 06 60 00 00 C0
    00 00 00
  `);
}

function build(s: ClimateState) {
  const b = template();
  const { quiet, turbo, econo } = quietTurboEcono(s);
  b[21] = 0x08 | (s.power ? 1 : 0) | (mode3.toRaw(s.mode) << 4);
  b[22] = Math.round(clamp(s.temp, 10, 32) * 2);
  b[24] = swingBool.toRaw(s.swingV) | (fan15.toRaw(s.fan) << 4);
  setBits(b, 25, 0, 4, swingBool.toRaw(s.swingH));
  setBit(b, 29, 5, quiet);
  setBit(b, 29, 0, turbo);
  setBit(b, 32, 2, econo);
  setBit(b, 33, 1, s.clean);
  seal(b, [7, 15, 34]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 21, 0),
    mode: mode3.fromRaw(getBits(b, 21, 4, 3)),
    temp: b[22] / 2,
    fan: fan15.fromRaw(getBits(b, 24, 4, 4)),
    swingV: swingBool.fromRaw(getBits(b, 24, 0, 4)),
    swingH: swingBool.fromRaw(getBits(b, 25, 0, 4)),
    quiet: getBit(b, 29, 5),
    turbo: getBit(b, 29, 0),
    econo: getBit(b, 32, 2),
    clean: getBit(b, 33, 1),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[8] === 0x11 && b[16] === 0x11 && sealed(b, [7, 15, 34]);

export const daikin: AcProtocol = {
  id: "daikin",
  name: "Daikin 280-bit",
  frequency: 38000,
  bits: 280,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 10, max: 32, step: 0.5 },
    features: ["turbo", "quiet", "econo", "clean"],
  },
  build,
  parse,
  ...message(bit, [
    { n: 8, ...section },
    { n: 8, ...section },
    { n: 19, ...section },
  ], valid, zeroLeader(bit, section.gap)),
};

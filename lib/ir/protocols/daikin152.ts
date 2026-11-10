import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, quietTurboEcono, seal, sealed, swingBool, zeroLeader } from "./_daikin";

// ARC480A5. 5-bit leader, one 19-byte section. Heat floors at 10°C; every other mode at 18°C.
const bit = { bitMark: 433, oneSpace: 1529, zeroSpace: 433 };
const frame = { n: 19, hdrMark: 3492, hdrSpace: 1718, footerMark: 433, gap: 25182 };

function build(s: ClimateState) {
  const b = fromHex("11 DA 27 00 00 00 00 00 00 00 00 00 00 00 00 C5 00 00 00");
  const mode = mode3.toRaw(s.mode);
  const { quiet, turbo, econo } = quietTurboEcono(s);
  const temp = Math.round(clamp(s.temp, mode === 0b100 ? 10 : 18, 32));
  b[5] = (s.power ? 1 : 0) | (mode << 4);
  setBits(b, 6, 1, 7, temp);
  b[8] = swingBool.toRaw(s.swingV) | (fan15.toRaw(s.fan) << 4);
  setBit(b, 13, 0, turbo);
  setBit(b, 13, 5, quiet);
  setBit(b, 16, 2, econo);
  seal(b, [18]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 5, 0),
    mode: mode3.fromRaw(getBits(b, 5, 4, 3)),
    temp: getBits(b, 6, 1, 7),
    fan: fan15.fromRaw(getBits(b, 8, 4, 4)),
    swingV: swingBool.fromRaw(getBits(b, 8, 0, 4)),
    quiet: getBit(b, 13, 5),
    turbo: getBit(b, 13, 0),
    econo: getBit(b, 16, 2),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[15] === 0xc5 && sealed(b, [18]);

export const daikin152: AcProtocol = {
  id: "daikin152",
  name: "Daikin 152-bit",
  frequency: 38000,
  bits: 152,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 10, max: 32, step: 1 },
    features: ["turbo", "quiet", "econo"],
  },
  build,
  parse,
  ...message(bit, [frame], valid, zeroLeader(bit, frame.gap)),
};

import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, seal, sealed, swingBool } from "./_daikin";

// ARC433B69 / ARC484A4 / FTQ60TV16U2. Quiet is sent as the quiet fan speed.
const bit = { bitMark: 420, oneSpace: 1300, zeroSpace: 450 };
const section = { hdrMark: 3440, hdrSpace: 1750, footerMark: 420, gap: 29650 };

function build(s: ClimateState) {
  const b = fromHex("11 DA 27 F0 00 00 00 00 11 DA 27 00 00 00 00 00 00 00 00 00 00 00 00 C0 00 00 00");
  let fan = fan15.toRaw(s.fan);
  if (s.turbo && fan === 0xb) fan = 0xa;
  const temp = Math.round(clamp(s.temp, 10, 32));
  b[13] = (s.power ? 1 : 0) | (mode3.toRaw(s.mode) << 4);
  setBits(b, 14, 1, 6, temp);
  b[16] = swingBool.toRaw(s.swingV) | (fan << 4);
  setBits(b, 17, 0, 4, swingBool.toRaw(s.swingH));
  setBit(b, 21, 0, s.turbo);
  seal(b, [7, 26]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 13, 0),
    mode: mode3.fromRaw(getBits(b, 13, 4, 3)),
    temp: getBits(b, 14, 1, 6),
    fan: fan15.fromRaw(getBits(b, 16, 4, 4)),
    swingV: swingBool.fromRaw(getBits(b, 16, 0, 4)),
    swingH: swingBool.fromRaw(getBits(b, 17, 0, 4)),
    turbo: getBit(b, 21, 0),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[8] === 0x11 && sealed(b, [7, 26]);

export const daikin216: AcProtocol = {
  id: "daikin216",
  name: "Daikin 216-bit",
  frequency: 38000,
  bits: 216,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto"],
    swingH: ["off", "auto"],
    temp: { min: 10, max: 32, step: 1 },
    features: ["turbo"],
  },
  build,
  parse,
  ...message(bit, [
    { n: 8, ...section },
    { n: 19, ...section },
  ], valid),
};

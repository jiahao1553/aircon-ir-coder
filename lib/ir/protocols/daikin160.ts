import { fromHex, getBit, getBits, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, seal, sealed, swingV160 } from "./_daikin";

// ARC423A5 / FTE12HV2S. Temperature is stored as degrees minus 10.
const bit = { bitMark: 342, oneSpace: 1786, zeroSpace: 700 };
const section = { hdrMark: 5000, hdrSpace: 2145, footerMark: 342, gap: 29650 };

function build(s: ClimateState) {
  const b = fromHex("11 DA 27 F0 0D 00 00 11 DA 27 00 D3 30 11 00 00 1E 0A 08 00");
  const temp = Math.round(clamp(s.temp, 10, 32));
  b[12] = (s.power ? 1 : 0) | (mode3.toRaw(s.mode) << 4);
  setBits(b, 13, 4, 4, swingV160.toRaw(s.swingV));
  setBits(b, 16, 1, 6, temp - 10);
  setBits(b, 17, 0, 4, fan15.toRaw(s.fan));
  seal(b, [6, 19]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 12, 0),
    mode: mode3.fromRaw(getBits(b, 12, 4, 3)),
    temp: getBits(b, 16, 1, 6) + 10,
    fan: fan15.fromRaw(getBits(b, 17, 0, 4)),
    swingV: swingV160.fromRaw(getBits(b, 13, 4, 4)),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[7] === 0x11 && sealed(b, [6, 19]);

export const daikin160: AcProtocol = {
  id: "daikin160",
  name: "Daikin 160-bit",
  frequency: 38000,
  bits: 160,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["auto", "lowest", "low", "middle", "high", "highest"],
    swingH: [],
    temp: { min: 10, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  ...message(bit, [
    { n: 7, ...section },
    { n: 13, ...section },
  ], valid),
};

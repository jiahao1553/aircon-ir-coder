import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { haierFrames, isHeat, MODEL_A, parseYrw02Front, setYrw02Front, yrw02Fan, yrw02Mode } from "./_haier";

// Haier 160-bit (KFR-26GW/83@UI-Ge): the YR-W02 frame plus a 6-byte tail with its own byte-sum.
const swingV = table([
  ["auto", 0xc],
  ["off", 0],
  ["highest", 1],
  ["high", 4],
  ["middle", 6],
  ["low", 8],
  ["lowest", 3],
  ["highest", 2],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(20);
  b[0] = MODEL_A;
  b[14] = 0xb5;
  setYrw02Front(b, s);
  setBits(b, 1, 0, 4, swingV.toRaw(s.swingV));
  setBit(b, 4, 7, isHeat(s));
  setBit(b, 10, 4, s.clean);
  setBit(b, 15, 6, s.clean);
  const fan = yrw02Fan.toRaw(s.fan);
  setBits(b, 16, 5, 3, fan === yrw02Fan.toRaw("auto") ? 0 : fan);
  b[13] = sumBytes(b, 0, 13);
  b[19] = sumBytes(b, 14, 19);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    ...parseYrw02Front(b),
    swingV: swingV.fromRaw(getBits(b, 1, 0, 4)),
    clean: getBit(b, 10, 4) && getBit(b, 15, 6),
  };
}

const valid = (b: Uint8Array) => b[13] === sumBytes(b, 0, 13) && b[19] === sumBytes(b, 14, 19);

export const haierAc160: AcProtocol = {
  id: "haier_ac160",
  name: "Haier 160-bit",
  frequency: 38000,
  bits: 160,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Haier.h",
  capabilities: {
    modes: yrw02Mode.keys,
    fans: yrw02Fan.keys,
    swingV: ["auto", "off", "highest", "high", "middle", "low", "lowest"],
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "quiet", "sleep", "clean"],
  },
  build,
  parse,
  ...haierFrames(20, valid),
};

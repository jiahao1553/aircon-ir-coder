import { getBit, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames } from "../core/pulses";
import { table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import {
  fan424,
  hasInvertedPairs,
  hitachiTiming,
  invertPairs,
  mode424,
  parseCommon424,
  reset424,
  setCommon424,
  setFan424,
} from "./_hitachi";

// Hitachi 344-bit (RAS-22NK): the first 43 bytes of the 424-bit layout, plus swing state bits.
const swingH = table([
  ["middle", 3],
  ["auto", 0],
  ["right_max", 1],
  ["right", 2],
  ["left", 4],
  ["left_max", 5],
] as const);

function build(s: ClimateState) {
  const b = reset424().slice(0, 43);
  b[37] = 0;
  b[39] = 0;
  setCommon424(b, s);
  setFan424(b, s);
  setBit(b, 37, 5, s.swingV === "swing");
  setBits(b, 35, 0, 3, swingH.toRaw(s.swingH));
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    ...parseCommon424(b),
    fan: fan424.fromRaw(getBits(b, 25, 4, 4)),
    swingV: getBit(b, 37, 5) ? "swing" : "off",
    swingH: swingH.fromRaw(getBits(b, 35, 0, 3)),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x01 && b[1] === 0x10 && hasInvertedPairs(b);

export const hitachiAc344: AcProtocol = {
  id: "hitachi_ac344",
  name: "Hitachi 344-bit",
  frequency: 38000,
  bits: 344,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: mode424.keys,
    fans: fan424.keys,
    swingV: ["off", "swing"],
    swingH: swingH.keys,
    temp: { min: 16, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(hitachiTiming, 43, valid),
};

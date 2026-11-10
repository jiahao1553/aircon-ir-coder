import { getBits, setBits } from "../core/bits";
import { simpleFrames } from "../core/pulses";
import { table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { hasInvertedPairs, hitachiTiming, invertPairs, mode424, parseCommon424, reset424, setCommon424 } from "./_hitachi";

// Hitachi 264-bit (RAR-2P2): the first 33 bytes of the 424-bit layout with its own fan table.
const fan = table([
  ["auto", 5],
  ["low", 1],
  ["medium", 3],
  ["high", 4],
] as const);

function build(s: ClimateState) {
  const b = reset424().slice(0, 33);
  b[9] = 0x92;
  b[27] = 0xc1;
  setCommon424(b, s);
  setBits(b, 25, 4, 4, fan.toRaw(s.fan));
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return { ...parseCommon424(b), fan: fan.fromRaw(getBits(b, 25, 4, 4)) };
}

const valid = (b: Uint8Array) => b[0] === 0x01 && b[1] === 0x10 && hasInvertedPairs(b);

export const hitachiAc264: AcProtocol = {
  id: "hitachi_ac264",
  name: "Hitachi 264-bit",
  frequency: 38000,
  bits: 264,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: mode424.keys,
    fans: fan.keys,
    swingV: [],
    swingH: [],
    temp: { min: 16, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(hitachiTiming, 33, valid),
};

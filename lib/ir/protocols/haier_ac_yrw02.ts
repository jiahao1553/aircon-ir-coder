import { sumBytes } from "../core/bits";
import type { AcProtocol, ClimateState } from "../core/types";
import {
  buildHaier176,
  haierFrames,
  MODEL_A,
  parseHaier176,
  yrw02Fan,
  yrw02Mode,
  yrw02SwingH,
  yrw02SwingV,
} from "./_haier";

// Haier YR-W02 remote: 14 bytes, first byte A6, byte-sum checksum.
const build = (s: ClimateState) => buildHaier176(s, MODEL_A).slice(0, 14);

const valid = (b: Uint8Array) => b[0] === MODEL_A && b[13] === sumBytes(b, 0, 13);

export const haierAcYrw02: AcProtocol = {
  id: "haier_ac_yrw02",
  name: "Haier YR-W02",
  frequency: 38000,
  bits: 112,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Haier.h",
  capabilities: {
    modes: yrw02Mode.keys,
    fans: yrw02Fan.keys,
    swingV: yrw02SwingV.keys,
    swingH: yrw02SwingH.keys,
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "quiet", "sleep"],
  },
  build,
  parse: parseHaier176,
  ...haierFrames(14, valid),
};

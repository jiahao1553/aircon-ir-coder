import { sumBytes } from "../core/bits";
import type { AcProtocol, ClimateState } from "../core/types";
import {
  buildHaier176,
  haierFrames,
  MODEL_A,
  MODEL_B,
  parseHaier176,
  yrw02Fan,
  yrw02Mode,
  yrw02SwingH,
  yrw02SwingV,
} from "./_haier";

// Haier 176-bit (V9014557 remote): the YR-W02 frame plus an 8-byte tail with its own byte-sum.
const build = (s: ClimateState, variant = "a") => buildHaier176(s, variant === "b" ? MODEL_B : MODEL_A);

const valid = (b: Uint8Array) =>
  (b[0] === MODEL_A || b[0] === MODEL_B) && b[13] === sumBytes(b, 0, 13) && b[21] === sumBytes(b, 14, 21);

export const haierAc176: AcProtocol = {
  id: "haier_ac176",
  name: "Haier 176-bit",
  frequency: 38000,
  bits: 176,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Haier.h",
  capabilities: {
    modes: yrw02Mode.keys,
    fans: yrw02Fan.keys,
    swingV: yrw02SwingV.keys,
    swingH: yrw02SwingH.keys,
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "quiet", "sleep"],
  },
  variants: [
    { id: "a", label: "V9014557 (A)", note: "Remote set to model A: first byte A6 (the library default)." },
    { id: "b", label: "V9014557 (B)", note: "Remote set to model B: first byte 59." },
  ],
  build,
  parse: parseHaier176,
  ...haierFrames(22, valid),
};

import { getBit, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { hasInvertedPairs, hitachiTiming, invertPairs } from "./_hitachi";

// Hitachi 296-bit (RAR-3U3): 37 bytes LSB-first; bytes 3+ are value/complement pairs.
const AUTO = 7;
const AUTO_TEMP = 1;

const mode = table([
  ["auto", AUTO],
  ["cool", 3],
  ["dry", 5],
  ["heat", 6],
  ["cool", 4], // "dry cool"
  ["dry", 9], // "auto dehumidifying"
] as const);

const fan = table([
  ["auto", 5],
  ["quiet", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(37);
  b.set([0x01, 0x10, 0x00, 0x40, 0x00, 0xff, 0x00, 0xcc, 0x00, 0x92, 0x00, 0x43]);
  b[27] = 0xf1;
  b[35] = 0x03;
  const m = mode.toRaw(s.mode);
  setBits(b, 25, 0, 4, m);
  setBits(b, 13, 2, 5, m === AUTO ? AUTO_TEMP : clamp(Math.round(s.temp), 16, 31));
  setBits(b, 25, 4, 3, fan.toRaw(s.fan));
  setBit(b, 27, 4, s.power);
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const m = mode.fromRaw(getBits(b, 25, 0, 4));
  return {
    power: getBit(b, 27, 4),
    mode: m,
    ...(m === "auto" ? {} : { temp: getBits(b, 13, 2, 5) }),
    fan: fan.fromRaw(getBits(b, 25, 4, 3)),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x01 && b[1] === 0x10 && hasInvertedPairs(b);

export const hitachiAc296: AcProtocol = {
  id: "hitachi_ac296",
  name: "Hitachi 296-bit",
  frequency: 38000,
  bits: 296,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat"],
    fans: fan.keys,
    swingV: [],
    swingH: [],
    temp: { min: 16, max: 31, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(hitachiTiming, 37, valid),
};

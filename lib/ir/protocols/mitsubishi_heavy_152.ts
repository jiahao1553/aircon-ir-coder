import { getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { heavyFrames, invertPairs, pairsValid } from "./_mitsubishi_heavy";

// 19 bytes. ZMS signature. Data bytes sit on the odd indexes from 5; the following byte is the complement.
const SIG = [0xad, 0x51, 0x3c, 0xe5, 0x1a];

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["max", 4],
  ["turbo", 8],
] as const);

const swingV = table([
  ["auto", 0],
  ["highest", 1],
  ["high", 2],
  ["middle", 3],
  ["low", 4],
  ["lowest", 5],
  ["off", 6],
] as const);

const swingH = table([
  ["auto", 0],
  ["left_max", 1],
  ["left", 2],
  ["middle", 3],
  ["right", 4],
  ["right_max", 5],
  ["off", 8],
] as const);

function valid(b: Uint8Array) {
  return b.length === 19 && SIG.every((v, i) => b[i] === v) && pairsValid(b);
}

function build(s: ClimateState) {
  const b = new Uint8Array(19);
  b.set(SIG);
  setBits(b, 5, 0, 3, mode.toRaw(s.mode));
  setBit(b, 5, 3, s.power);
  setBit(b, 5, 5, s.clean);
  setBits(b, 7, 0, 4, clamp(Math.round(s.temp), 17, 31) - 17);
  setBits(b, 9, 0, 4, s.econo ? 6 : fan.toRaw(s.fan));
  setBits(b, 11, 5, 3, swingV.toRaw(s.swingV));
  setBits(b, 13, 0, 4, swingH.toRaw(s.swingH));
  setBit(b, 15, 6, s.sleep);
  setBit(b, 15, 7, s.quiet);
  b[17] = 0x80;
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const speed = b[9] & 0xf;
  return {
    power: getBit(b, 5, 3),
    mode: mode.fromRaw(getBits(b, 5, 0, 3)),
    temp: getBits(b, 7, 0, 4) + 17,
    fan: speed === 6 ? undefined : fan.fromRaw(speed),
    swingV: swingV.fromRaw(getBits(b, 11, 5, 3)),
    swingH: swingH.fromRaw(getBits(b, 13, 0, 4)),
    clean: getBit(b, 5, 5),
    sleep: getBit(b, 15, 6),
    quiet: getBit(b, 15, 7),
    econo: speed === 6,
    turbo: speed === 8,
  };
}

export const mitsubishiHeavy152: AcProtocol = {
  id: "mitsubishi_heavy_152",
  name: "Mitsubishi Heavy 152-bit",
  frequency: 38000,
  bits: 152,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_MitsubishiHeavy.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high", "max", "turbo"],
    swingV: ["off", "auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off", "auto", "left_max", "left", "middle", "right", "right_max"],
    temp: { min: 17, max: 31, step: 1 },
    features: ["clean", "sleep", "quiet", "econo"],
  },
  build,
  parse,
  ...heavyFrames(19, valid),
};

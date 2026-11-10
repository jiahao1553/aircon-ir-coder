import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { haierFrames } from "./_haier";

// Haier 72-bit (HSU07-HEA03 remote): 9 bytes, prefix A5, byte-sum checksum. The command nibble carries on/off.
const PREFIX = 0xa5;
const CMD_OFF = 0;
const CMD_ON = 1;

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["heat", 3],
  ["fan_only", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3],
] as const);

const swingV = table([
  ["off", 0],
  ["highest", 1],
  ["lowest", 2],
  ["swing", 3],
] as const);

function build(s: ClimateState) {
  const b = new Uint8Array(9);
  b[0] = PREFIX;
  setBits(b, 1, 0, 4, s.power ? CMD_ON : CMD_OFF);
  setBits(b, 1, 4, 4, clamp(Math.round(s.temp), 16, 30) - 16);
  setBit(b, 2, 5, true);
  setBits(b, 2, 6, 2, swingV.toRaw(s.swingV));
  setBits(b, 4, 0, 5, 12);
  setBits(b, 5, 6, 2, fan.toRaw(s.fan));
  setBits(b, 6, 5, 3, mode.toRaw(s.mode));
  setBit(b, 7, 6, s.sleep);
  b[8] = sumBytes(b, 0, 8);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 1, 0, 4) !== CMD_OFF,
    mode: mode.fromRaw(getBits(b, 6, 5, 3)),
    temp: getBits(b, 1, 4, 4) + 16,
    fan: fan.fromRaw(getBits(b, 5, 6, 2)),
    swingV: swingV.fromRaw(getBits(b, 2, 6, 2)),
    sleep: getBit(b, 7, 6),
  };
}

const valid = (b: Uint8Array) => b[0] === PREFIX && b[8] === sumBytes(b, 0, 8);

export const haierAc: AcProtocol = {
  id: "haier_ac",
  name: "Haier 72-bit",
  frequency: 38000,
  bits: 72,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Haier.h",
  capabilities: {
    modes: mode.keys,
    fans: fan.keys,
    swingV: swingV.keys,
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: ["sleep"],
  },
  build,
  parse,
  ...haierFrames(9, valid),
};

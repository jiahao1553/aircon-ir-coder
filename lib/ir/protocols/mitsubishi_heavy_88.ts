import { getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { heavyFrames, invertPairs, pairsValid } from "./_mitsubishi_heavy";

// 11 bytes. ZJS signature, then data bytes interleaved with their complements. Swing is split across bytes.
const SIG = [0xad, 0x51, 0x3c, 0xd9, 0x26];

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
  ["turbo", 6],
] as const);

const swingV = table([
  ["off", 0b000],
  ["auto", 0b100],
  ["highest", 0b110],
  ["high", 0b001],
  ["middle", 0b011],
  ["low", 0b101],
  ["lowest", 0b111],
] as const);

const swingH = table([
  ["off", 0b0000],
  ["auto", 0b1000],
  ["left_max", 0b0001],
  ["left", 0b0101],
  ["middle", 0b1001],
  ["right", 0b1101],
  ["right_max", 0b0010],
  ["wide", 0b0110],
] as const);

function valid(b: Uint8Array) {
  return SIG.every((v, i) => b[i] === v) && pairsValid(b);
}

function build(s: ClimateState) {
  const b = new Uint8Array(11);
  b.set(SIG);
  const vertical = swingV.toRaw(s.swingV);
  const horizontal = swingH.toRaw(s.swingH);
  setBit(b, 5, 1, (vertical & 1) === 1);
  setBits(b, 5, 2, 2, horizontal & 3);
  setBit(b, 5, 5, s.clean);
  setBits(b, 5, 6, 2, (horizontal >> 2) & 3);
  setBits(b, 7, 3, 2, (vertical >> 1) & 3);
  setBits(b, 7, 5, 3, s.econo ? 7 : fan.toRaw(s.fan));
  setBits(b, 9, 0, 3, mode.toRaw(s.mode));
  setBit(b, 9, 3, s.power);
  setBits(b, 9, 4, 4, clamp(Math.round(s.temp), 17, 31) - 17);
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const vertical = ((b[5] >> 1) & 1) | (((b[7] >> 3) & 3) << 1);
  const horizontal = ((b[5] >> 2) & 3) | (((b[5] >> 6) & 3) << 2);
  const speed = (b[7] >> 5) & 7;
  return {
    power: getBit(b, 9, 3),
    mode: mode.fromRaw(getBits(b, 9, 0, 3)),
    temp: getBits(b, 9, 4, 4) + 17,
    fan: speed === 7 ? undefined : fan.fromRaw(speed),
    swingV: swingV.fromRaw(vertical),
    swingH: swingH.fromRaw(horizontal),
    clean: getBit(b, 5, 5),
    econo: speed === 7,
    turbo: speed === 6,
  };
}

export const mitsubishiHeavy88: AcProtocol = {
  id: "mitsubishi_heavy_88",
  name: "Mitsubishi Heavy 88-bit",
  frequency: 38000,
  bits: 88,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_MitsubishiHeavy.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "low", "medium", "high", "turbo"],
    swingV: ["off", "auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off", "auto", "left_max", "left", "middle", "right", "right_max", "wide"],
    temp: { min: 17, max: 31, step: 1 },
    features: ["clean", "econo"],
  },
  build,
  parse,
  ...heavyFrames(11, valid),
};

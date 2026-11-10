import { getBit, reverseBits, setBit } from "../core/bits";
import { simpleFrames } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { hitachiTiming } from "./_hitachi";

// Hitachi 224-bit (RAS-35THA6): 28 bytes MSB-first; mode, temp and fan bytes are stored bit-reversed.
const timing = { ...hitachiTiming, msbFirst: true };
const DRY = 5;
const FAN = 0xc;

const mode = table([
  ["auto", 2],
  ["heat", 3],
  ["cool", 4],
  ["dry", DRY],
  ["fan_only", FAN],
] as const);

const fan = table([
  ["auto", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 4],
  ["max", 5],
] as const);

function checksum(b: Uint8Array) {
  let sum = 62;
  for (let i = 0; i < 27; i++) sum -= reverseBits(b[i]);
  return reverseBits(sum & 0xff);
}

function build(s: ClimateState) {
  const b = new Uint8Array(28);
  b.set([0x80, 0x08, 0x0c, 0x02, 0xfd, 0x80, 0x7f, 0x88, 0x48]);
  b[14] = 0x60;
  b[15] = 0x60;
  b[24] = 0x80;
  const m = mode.toRaw(s.mode);
  const temp = clamp(Math.round(s.temp), 16, 32);
  b[9] = temp === 16 ? 0x90 : 0x10;
  b[10] = reverseBits(m);
  b[11] = reverseBits(temp << 1);
  const [lo, hi] = m === DRY ? [2, 3] : m === FAN ? [2, 5] : [1, 5];
  b[13] = reverseBits(clamp(fan.toRaw(s.fan), lo, hi));
  setBit(b, 14, 7, s.swingV === "swing");
  setBit(b, 15, 7, s.swingH === "swing");
  setBit(b, 17, 0, s.power);
  b[27] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 17, 0),
    mode: mode.fromRaw(reverseBits(b[10])),
    temp: reverseBits(b[11]) >> 1,
    fan: fan.fromRaw(reverseBits(b[13])),
    swingV: getBit(b, 14, 7) ? "swing" : "off",
    swingH: getBit(b, 15, 7) ? "swing" : "off",
  };
}

const valid = (b: Uint8Array) => b[0] === 0x80 && b[1] === 0x08 && b[27] === checksum(b);

export const hitachiAc: AcProtocol = {
  id: "hitachi_ac",
  name: "Hitachi 224-bit",
  frequency: 38000,
  bits: 224,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: mode.keys,
    fans: fan.keys,
    swingV: ["off", "swing"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  ...simpleFrames(timing, 28, valid),
};

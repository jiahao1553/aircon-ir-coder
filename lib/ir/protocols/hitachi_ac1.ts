import { getBit, getBits, reverseBits, setBit, setBits } from "../core/bits";
import { simpleFrames } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { hitachiTiming } from "./_hitachi";

// Hitachi 104-bit (R-LT0541-HTA): 13 bytes MSB-first; temp and checksum nibbles are stored bit-reversed.
const timing = { ...hitachiTiming, hdrMark: 3400, hdrSpace: 3400, msbFirst: true };
const AUTO = 0xe;
const DRY = 2;
const COOL = 6;
const FAN_AUTO = 1;
const FAN_LOW = 8;
const SLEEP = 2;

const model = { a: 0b10, b: 0b01 } as const;

const mode = table([
  ["auto", AUTO],
  ["cool", COOL],
  ["heat", 9],
  ["dry", DRY],
  ["fan_only", 4],
] as const);

const fan = table([
  ["auto", FAN_AUTO],
  ["low", FAN_LOW],
  ["medium", 4],
  ["high", 2],
] as const);

function checksum(b: Uint8Array) {
  let sum = 0;
  for (let i = 5; i < 12; i++) sum += reverseBits(b[i] & 0xf, 4) + reverseBits(b[i] >> 4, 4);
  return reverseBits(sum & 0xff);
}

function build(s: ClimateState, variant = "a") {
  const b = Uint8Array.from([0xb2, 0xae, 0x4d, 0x91, 0xf0, 0xe1, 0xa4, 0, 0, 0, 0, 0x61, 0]);
  setBits(b, 3, 6, 2, variant === "b" ? model.b : model.a);
  const m = mode.toRaw(s.mode);
  setBits(b, 5, 4, 4, m);
  // Auto keeps the reset temp (25C).
  if (m !== AUTO) setBits(b, 6, 2, 5, reverseBits(clamp(Math.round(s.temp), 16, 32) - 7, 5));
  // Auto and dry lock the fan; heat and fan modes never leave low.
  const f = m === AUTO ? FAN_AUTO : m === COOL ? fan.toRaw(s.fan) : FAN_LOW;
  setBits(b, 5, 0, 4, f);
  setBit(b, 11, 0, false);
  setBits(b, 11, 1, 3, s.sleep && (m === AUTO || m === COOL) ? SLEEP : 0);
  // The reset state is "on"; turning it off also raises the power-toggle flag.
  setBit(b, 11, 4, !s.power);
  setBit(b, 11, 5, s.power);
  setBit(b, 11, 6, s.swingV === "swing");
  setBit(b, 11, 7, s.swingH === "swing");
  b[12] = checksum(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 11, 5),
    mode: mode.fromRaw(getBits(b, 5, 4, 4)),
    temp: reverseBits(getBits(b, 6, 2, 5), 5) + 7,
    fan: fan.fromRaw(getBits(b, 5, 0, 4)),
    swingV: getBit(b, 11, 6) ? "swing" : "off",
    swingH: getBit(b, 11, 7) ? "swing" : "off",
    sleep: getBits(b, 11, 1, 3) !== 0,
  };
}

const valid = (b: Uint8Array) => b[0] === 0xb2 && b[1] === 0xae && b[2] === 0x4d && b[12] === checksum(b);

export const hitachiAc1: AcProtocol = {
  id: "hitachi_ac1",
  name: "Hitachi 104-bit",
  frequency: 38000,
  bits: 104,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: mode.keys,
    fans: fan.keys,
    swingV: ["off", "swing"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 32, step: 1 },
    features: ["sleep"],
  },
  variants: [
    { id: "a", label: "R-LT0541-HTA (A)", note: "Remote set to model A (the library default)." },
    { id: "b", label: "R-LT0541-HTA (B)", note: "Remote set to model B, as in the known real captures." },
  ],
  build,
  parse,
  ...simpleFrames(timing, 13, valid),
};

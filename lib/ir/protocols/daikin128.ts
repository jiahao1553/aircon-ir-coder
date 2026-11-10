import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { bcd, fan128, fromBcd, message, mode128, nibbleSum, pairLeader } from "./_daikin";

// 17 Series FTXB**AXVJU / BRC52B63. Same carrier as Daikin64, two 8-byte sections.
// Quiet and powerful are fan speeds, and auto mode rejects both.
const bit = { bitMark: 350, oneSpace: 954, zeroSpace: 382 };
const gap = 20300;

function firstSum(b: Uint8Array) {
  return nibbleSum(b, 0, 7, b[7] & 0xf) & 0xf;
}

function build(s: ClimateState) {
  const b = fromHex("16 00 00 00 00 00 00 04 A1 00 00 00 00 00 00 00");
  const mode = mode128.toRaw(s.mode);
  let fan = fan128.toRaw(s.fan);
  if (mode === 0b1010 && (fan === 0b1001 || fan === 0b0011)) fan = 0b0001;
  setBits(b, 1, 0, 4, mode);
  setBits(b, 1, 4, 4, fan);
  b[6] = bcd(Math.round(clamp(s.temp, 16, 30)));
  setBit(b, 7, 0, s.swingV === "auto");
  setBit(b, 7, 1, s.sleep);
  setBit(b, 7, 2, true);
  setBit(b, 7, 3, !s.power);
  b[7] = (b[7] & 0x0f) | (firstSum(b) << 4);
  const econo = !!s.econo && (mode === 0b0010 || mode === 0b1000);
  setBit(b, 9, 2, econo);
  setBit(b, 9, 3, s.light);
  b[15] = nibbleSum(b, 8, 15);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: !getBit(b, 7, 3),
    mode: mode128.fromRaw(getBits(b, 1, 0, 4)),
    temp: fromBcd(b[6]),
    fan: fan128.fromRaw(getBits(b, 1, 4, 4)),
    swingV: getBit(b, 7, 0) ? "auto" : "off",
    sleep: getBit(b, 7, 1),
    econo: getBit(b, 9, 2),
    light: getBit(b, 9, 3),
  };
}

const valid = (b: Uint8Array) =>
  b[0] === 0x16 && b[8] === 0xa1 && (b[7] >> 4) === firstSum(b) && b[15] === nibbleSum(b, 8, 15);

export const daikin128: AcProtocol = {
  id: "daikin128",
  name: "Daikin 128-bit",
  frequency: 38000,
  bits: 128,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "low", "medium", "high", "turbo"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: ["econo", "light", "sleep"],
  },
  powerToggle: true,
  build,
  parse,
  ...message(
    bit,
    [
      { n: 8, hdrMark: 4600, hdrSpace: 2500, footerMark: 350, gap },
      { n: 8, hdrMark: 0, hdrSpace: 0, footerMark: 4600, gap },
    ],
    valid,
    pairLeader(9800, 9800, 2),
  ),
};

import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { bcd, fan128, fromBcd, message, mode64, nibbleSum, pairLeader } from "./_daikin";

// DGS01 / FFN-C / FTWX35AXV1. No absolute power: the bit toggles the unit.
const bit = { bitMark: 350, oneSpace: 954, zeroSpace: 382 };
const frame = { n: 8, hdrMark: 4600, hdrSpace: 2500, footerMark: 350, gap: 20300 };

function checksum(b: Uint8Array) {
  return nibbleSum(b, 0, 7, b[7] & 0xf) & 0xf;
}

function build(s: ClimateState) {
  const b = fromHex("16 42 20 07 16 16 16 7C");
  setBits(b, 1, 0, 4, mode64.toRaw(s.mode));
  setBits(b, 1, 4, 4, fan128.toRaw(s.fan));
  b[6] = bcd(Math.round(clamp(s.temp, 16, 30)));
  setBit(b, 7, 0, s.swingV === "auto");
  setBit(b, 7, 1, s.sleep);
  setBit(b, 7, 2, true);
  setBit(b, 7, 3, !s.power);
  b[7] = (b[7] & 0x0f) | (checksum(b) << 4);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: !getBit(b, 7, 3),
    mode: mode64.fromRaw(getBits(b, 1, 0, 4)),
    temp: fromBcd(b[6]),
    fan: fan128.fromRaw(getBits(b, 1, 4, 4)),
    swingV: getBit(b, 7, 0) ? "auto" : "off",
    sleep: getBit(b, 7, 1),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x16 && (b[7] >> 4) === checksum(b);

export const daikin64: AcProtocol = {
  id: "daikin64",
  name: "Daikin 64-bit",
  frequency: 38000,
  bits: 64,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "low", "medium", "high", "turbo"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: ["sleep"],
  },
  powerToggle: true,
  build,
  parse,
  ...message(bit, [frame], valid, pairLeader(9800, 9800, 2), (w) => {
    w.mark(4600);
    w.space(100000);
  }),
};

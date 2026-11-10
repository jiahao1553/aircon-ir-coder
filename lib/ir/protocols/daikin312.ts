import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, quietTurbo, seal, sealed, swingH312, swingV312, zeroLeader } from "./_daikin";

// FTXM20R5V1B / ARC466A67 / ARC466A58. Half-degree setpoint. Cool floors at 18°C.
const bit = { bitMark: 453, oneSpace: 1275, zeroSpace: 414 };
const section = { hdrMark: 3518, hdrSpace: 1688, footerMark: 453, gap: 35512 };

function template() {
  return fromHex(`
    11 DA 27 00 02 58 64 00
    64 00 00 00 01 00 00 00
    00 00 00 00 11 DA 27 00
    00 08 2C 00 00 00 00 06
    60 00 00 C5 00 08 00
  `);
}

function build(s: ClimateState) {
  const b = template();
  const mode = mode3.toRaw(s.mode);
  const { quiet, turbo } = quietTurbo(s);
  const temp = Math.round(clamp(s.temp, mode === 0b011 ? 18 : 10, 32) * 2);
  setBit(b, 6, 7, !s.power);
  setBits(b, 12, 0, 2, s.light ? 1 : 3);
  setBits(b, 12, 2, 2, s.beep ? 2 : 3);
  setBit(b, 8, 3, s.clean);
  b[25] = 0x08 | (s.power ? 1 : 0) | (mode << 4);
  setBits(b, 26, 0, 7, temp);
  setBits(b, 28, 0, 4, swingV312.toRaw(s.swingV));
  setBits(b, 28, 4, 4, fan15.toRaw(s.fan));
  setBits(b, 29, 0, 4, swingH312.toRaw(s.swingH));
  setBit(b, 33, 5, quiet);
  setBit(b, 33, 0, turbo);
  setBit(b, 36, 2, s.econo);
  seal(b, [19, 38]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 25, 0) && !getBit(b, 6, 7),
    mode: mode3.fromRaw(getBits(b, 25, 4, 3)),
    temp: getBits(b, 26, 0, 7) / 2,
    fan: fan15.fromRaw(getBits(b, 28, 4, 4)),
    swingV: swingV312.fromRaw(getBits(b, 28, 0, 4)),
    swingH: swingH312.fromRaw(getBits(b, 29, 0, 4)),
    quiet: getBit(b, 33, 5),
    turbo: getBit(b, 33, 0),
    econo: getBit(b, 36, 2),
    light: getBits(b, 12, 0, 2) !== 3,
    beep: getBits(b, 12, 2, 2) !== 3,
    clean: getBit(b, 8, 3),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[20] === 0x11 && sealed(b, [19, 38]);

export const daikin312: AcProtocol = {
  id: "daikin312",
  name: "Daikin 312-bit",
  frequency: 36700,
  bits: 312,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto", "highest", "high", "upper_middle", "middle", "low", "lowest"],
    swingH: ["off", "auto", "wide", "left_max", "left", "middle", "right", "right_max"],
    temp: { min: 10, max: 32, step: 0.5 },
    features: ["turbo", "quiet", "econo", "light", "clean", "beep"],
  },
  build,
  parse,
  ...message(
    bit,
    [
      { n: 20, ...section },
      { n: 19, ...section },
    ],
    valid,
    zeroLeader(bit, 25100),
  ),
};

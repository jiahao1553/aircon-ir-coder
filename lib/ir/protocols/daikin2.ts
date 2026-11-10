import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { fan15, message, mode3, pairLeader, quietTurbo, seal, sealed, swingH2, swingV2 } from "./_daikin";

// ARC477A1 / FTXZ25-50NV1B. Leader plus two sections. Cool's floor is 18°C.
const bit = { bitMark: 460, oneSpace: 1270, zeroSpace: 420 };
const gap = 10024 + 25180;
const section = { hdrMark: 3500, hdrSpace: 1728, footerMark: 460, gap };

function template() {
  return fromHex(`
    11 DA 27 00 01 00 C0 70
    08 0C 80 04 B0 16 24 00
    00 BE D0 00 11 DA 27 00
    00 08 00 00 A0 00 00 06
    60 00 00 C1 80 60 00
  `);
}

function build(s: ClimateState) {
  const b = template();
  const mode = mode3.toRaw(s.mode);
  const { quiet, turbo } = quietTurbo(s);
  const temp = Math.round(clamp(s.temp, mode === 0b011 ? 18 : 10, 32));
  setBit(b, 6, 7, !s.power);
  setBits(b, 7, 4, 2, s.light ? 1 : 3);
  setBits(b, 7, 6, 2, s.beep ? 2 : 3);
  setBit(b, 8, 3, s.clean);
  b[17] = swingH2.toRaw(s.swingH);
  setBits(b, 18, 0, 4, swingV2.toRaw(s.swingV));
  b[25] = 0x08 | (s.power ? 1 : 0) | (mode << 4);
  setBits(b, 26, 1, 6, temp);
  setBits(b, 28, 4, 4, fan15.toRaw(s.fan));
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
    temp: getBits(b, 26, 1, 6),
    fan: fan15.fromRaw(getBits(b, 28, 4, 4)),
    swingV: swingV2.fromRaw(getBits(b, 18, 0, 4)),
    swingH: swingH2.fromRaw(b[17]),
    quiet: getBit(b, 33, 5),
    turbo: getBit(b, 33, 0),
    econo: getBit(b, 36, 2),
    light: getBits(b, 7, 4, 2) !== 3,
    beep: getBits(b, 7, 6, 2) !== 3,
    clean: getBit(b, 8, 3),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[20] === 0x11 && sealed(b, [19, 38]);

export const daikin2: AcProtocol = {
  id: "daikin2",
  name: "Daikin2 312-bit",
  frequency: 36700,
  bits: 312,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "quiet", "min", "low", "medium", "high", "max"],
    swingV: ["auto", "off", "highest", "high", "upper_middle", "middle", "low", "lowest"],
    swingH: ["auto", "off", "left_max", "left", "middle", "right", "right_max", "wide"],
    temp: { min: 10, max: 32, step: 1 },
    features: ["turbo", "quiet", "econo", "light", "clean", "beep"],
  },
  build,
  parse,
  ...message(bit, [
    { n: 20, ...section },
    { n: 19, ...section },
  ], valid, pairLeader(10024, 25180, 1)),
};

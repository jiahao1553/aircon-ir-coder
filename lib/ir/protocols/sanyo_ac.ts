import { getBit, getBits, setBit, setBits, sumNibbles } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Sanyo SAP-K121 / RCS-2HS4E: 9 bytes LSB-first, nibble-sum checksum, lead byte 0x6A.
// Reset keeps the sensor at 21°C on the unit and beep enabled.
const timing: Timing = {
  hdrMark: 8500,
  hdrSpace: 4200,
  bitMark: 500,
  oneSpace: 1600,
  zeroSpace: 550,
  footerMark: 500,
  gap: 100000,
};

const TEMPLATE = [0x6a, 0x6d, 0x51, 0x00, 0x10, 0x45, 0x00, 0x00, 0x00];

const mode = table([
  ["auto", 4],
  ["heat", 1],
  ["cool", 2],
  ["dry", 3],
] as const);

const fan = table([
  ["auto", 0],
  ["high", 1],
  ["low", 2],
  ["medium", 3],
] as const);

const swing = table([
  ["auto", 0],
  ["lowest", 2],
  ["low", 3],
  ["middle", 4],
  ["upper_middle", 5],
  ["high", 6],
  ["highest", 7],
] as const);

function build(s: ClimateState) {
  const b = Uint8Array.from(TEMPLATE);
  setBits(b, 1, 0, 5, clamp(Math.round(s.temp), 16, 30) - 4);
  setBits(b, 4, 0, 2, fan.toRaw(s.fan));
  setBits(b, 4, 4, 3, mode.toRaw(s.mode));
  setBits(b, 5, 0, 3, swing.toRaw(s.swingV));
  setBits(b, 5, 6, 2, s.power ? 0b10 : 0b01);
  setBit(b, 6, 3, s.sleep);
  setBit(b, 2, 6, s.beep !== false);
  b[8] = sumNibbles(b, 0, 8) & 0xff;
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBits(b, 5, 6, 2) === 0b10,
    mode: mode.fromRaw(getBits(b, 4, 4, 3)),
    temp: getBits(b, 1, 0, 5) + 4,
    fan: fan.fromRaw(getBits(b, 4, 0, 2)),
    swingV: swing.fromRaw(getBits(b, 5, 0, 3)),
    swingH: "off",
    sleep: getBit(b, 6, 3),
    beep: getBit(b, 2, 6),
  };
}

const valid = (b: Uint8Array) => b.length >= 9 && b[0] === 0x6a && b[8] === (sumNibbles(b, 0, 8) & 0xff);

export const sanyoAc: AcProtocol = {
  id: "sanyo_ac",
  name: "Sanyo SAP-K121",
  frequency: 38000,
  bits: 72,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Sanyo.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["auto", "highest", "high", "upper_middle", "middle", "low", "lowest"],
    swingH: ["off"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["sleep", "beep"],
  },
  build,
  parse,
  ...simpleFrames(timing, 9, valid),
};

import { fromHex, getBit, getBits, setBit, setBits } from "../core/bits";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";
import { message, seal, sealed } from "./_daikin";

// BRC4C153 / BRC4C151 / FFQ35B8V1B. Dry and fan lock the setpoint at 17°C.
// Two unit ids share the layout; the id bit is the only difference.
const bit = { bitMark: 370, oneSpace: 1780, zeroSpace: 710 };
const section = { hdrMark: 5070, hdrSpace: 2140, footerMark: 370, gap: 29410 };

const mode = table([
  ["cool", 0b010],
  ["heat", 0b001],
  ["auto", 0b011],
  ["fan_only", 0b000],
  ["dry", 0b111],
] as const);

const fan = table([
  ["max", 3],
  ["min", 1],
] as const);

const swingH = table([
  ["auto", 5],
  ["off", 6],
] as const);

function build(s: ClimateState, variant = "a") {
  const b = fromHex("11 DA 17 18 04 00 00 11 DA 17 18 00 73 00 20 00 00 00 16 00 20 00");
  if (variant === "b") {
    setBit(b, 3, 0, true);
    setBit(b, 10, 0, true);
  }
  const m = mode.toRaw(s.mode);
  const alt = m === 0b111 ? 2 : m === 0b000 ? 6 : 7;
  const temp = m === 0b111 || m === 0b000 ? 17 : Math.round(clamp(s.temp, 10, 32));
  setBits(b, 12, 4, 3, alt);
  b[14] = (s.power ? 1 : 0) | (m << 4);
  setBits(b, 17, 1, 6, temp - 9);
  b[18] = swingH.toRaw(s.swingH) | (fan.toRaw(s.fan) << 4);
  seal(b, [6, 21]);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 14, 0),
    mode: mode.fromRaw(getBits(b, 14, 4, 3)),
    temp: getBits(b, 17, 1, 6) + 9,
    fan: fan.fromRaw(getBits(b, 18, 4, 4)),
    swingH: swingH.fromRaw(getBits(b, 18, 0, 4)),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x11 && b[1] === 0xda && b[2] === 0x17 && b[7] === 0x11 && sealed(b, [6, 21]);

export const daikin176: AcProtocol = {
  id: "daikin176",
  name: "Daikin 176-bit",
  frequency: 38000,
  bits: 176,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Daikin.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["min", "max"],
    swingV: [],
    swingH: ["auto", "off"],
    temp: { min: 10, max: 32, step: 1 },
    features: [],
  },
  variants: [
    { id: "a", label: "Unit A", note: "Id bit clear. Default for BRC4C153 and BRC4C151." },
    { id: "b", label: "Unit B", note: "Sets the id bit in both sections." },
  ],
  build,
  parse,
  ...message(bit, [
    { n: 7, ...section },
    { n: 15, ...section },
  ], valid),
};

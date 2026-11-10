import { getBit, getBits, setBit, setBits } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Kelon ON/OFF 9000–12000: 48 bits LSB-first, preamble 0x83 0x06, no checksum.
// The wire fan field runs backwards (0 auto, 1 max, 2 medium, 3 min).
// Power and vertical swing are toggles. `power: false` is the toggle frame.
const timing: Timing = {
  hdrMark: 9000,
  hdrSpace: 4600,
  bitMark: 560,
  oneSpace: 1680,
  zeroSpace: 600,
  footerMark: 560,
  gap: 200000,
};

const mode = table([
  ["heat", 0],
  ["auto", 1],
  ["cool", 2],
  ["dry", 3],
  ["fan_only", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
] as const);

function wireFan(speed: number) {
  return (4 - speed) & 3;
}

function build(s: ClimateState) {
  const b = new Uint8Array(6);
  b[0] = 0x83;
  b[1] = 0x06;
  let m = mode.toRaw(s.mode);
  let temp = clamp(Math.round(s.temp), 18, 32);
  let speed = fan.toRaw(s.fan);
  // Super cool replaces mode, setpoint and fan. The requested setpoint otherwise wins.
  if (s.turbo) {
    m = 2;
    temp = 18;
    speed = 3;
  }
  setBits(b, 2, 0, 2, wireFan(speed));
  setBit(b, 2, 2, !s.power);
  setBit(b, 2, 3, s.sleep);
  setBit(b, 2, 7, s.swingV !== "off");
  setBits(b, 3, 0, 3, m);
  setBits(b, 3, 4, 4, temp - 18);
  setBit(b, 4, 7, m === 1);
  setBit(b, 5, 4, s.turbo);
  setBit(b, 5, 7, s.turbo);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const wire = getBits(b, 2, 0, 2);
  return {
    power: !getBit(b, 2, 2),
    mode: mode.fromRaw(getBits(b, 3, 0, 3)),
    temp: getBits(b, 3, 4, 4) + 18,
    fan: fan.fromRaw(wireFan(wire)),
    swingV: getBit(b, 2, 7) ? "swing" : "off",
    swingH: "off",
    sleep: getBit(b, 2, 3),
    turbo: getBit(b, 5, 4),
  };
}

const valid = (b: Uint8Array) => b[0] === 0x83 && b[1] === 0x06;

export const kelon: AcProtocol = {
  id: "kelon",
  name: "Kelon",
  frequency: 38000,
  bits: 48,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Kelon.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "low", "medium", "high"],
    swingV: ["off", "swing"],
    swingH: ["off"],
    temp: { min: 18, max: 32, step: 1 },
    features: ["turbo", "sleep"],
  },
  powerToggle: true,
  build,
  parse,
  ...simpleFrames(timing, 6, valid),
};

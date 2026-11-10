import { getBits } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import type { AcProtocol, ClimateState } from "../core/types";
import {
  fan424,
  hasInvertedPairs,
  invertPairs,
  mode424,
  parseCommon424,
  reset424,
  setCommon424,
  setFan424,
} from "./_hitachi";

// Hitachi 424-bit (RAR-8P2): 53 bytes LSB-first behind a long leader; bytes 3+ are value/complement pairs.
const timing: Timing = {
  hdrMark: 3416,
  hdrSpace: 1604,
  bitMark: 463,
  oneSpace: 1208,
  zeroSpace: 372,
  footerMark: 463,
  gap: 100000,
};
const LEADER_MARK = 29784;
const LEADER_SPACE = 49290;
const SWING_V_BUTTON = 0x81;

function build(s: ClimateState) {
  const b = reset424();
  setCommon424(b, s);
  setFan424(b, s);
  // The remote keeps no swing state: "swing" sends the swing button, which toggles the louvre.
  if (s.swingV === "swing") b[11] = SWING_V_BUTTON;
  invertPairs(b);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    ...parseCommon424(b),
    fan: fan424.fromRaw(getBits(b, 25, 4, 4)),
    swingV: b[11] === SWING_V_BUTTON ? "swing" : "off",
  };
}

const valid = (b: Uint8Array) => b[0] === 0x01 && b[1] === 0x10 && hasInvertedPairs(b);

export const hitachiAc424: AcProtocol = {
  id: "hitachi_ac424",
  name: "Hitachi 424-bit",
  frequency: 38000,
  bits: 424,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Hitachi.h",
  capabilities: {
    modes: mode424.keys,
    fans: fan424.keys,
    swingV: ["off", "swing"],
    swingH: [],
    temp: { min: 16, max: 32, step: 1 },
    features: [],
  },
  build,
  parse,
  modulate(bytes) {
    const w = new PulseWriter();
    w.mark(LEADER_MARK);
    w.space(LEADER_SPACE);
    w.frame(bytes, timing);
    return w.pulses;
  },
  demodulate(pulses) {
    for (let start = 0; start < pulses.length; start += 2) {
      const r = new PulseReader(pulses);
      r.i = start;
      if (!r.mark(LEADER_MARK) || !r.space(LEADER_SPACE)) continue;
      const b = r.frame(53, timing);
      if (b && valid(b)) return b;
    }
    return null;
  },
};

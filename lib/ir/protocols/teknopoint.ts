import { PulseReader, simpleFrames, type Timing } from "../core/pulses";
import type { AcProtocol } from "../core/types";
import { buildTcl, parseTcl, tclValid } from "./_tcl";

// Same 14 bytes as TCL112, model GZ055BE1. Header and bit times differ.
const timing: Timing = {
  hdrMark: 3600,
  hdrSpace: 1600,
  bitMark: 477,
  oneSpace: 1200,
  zeroSpace: 530,
  footerMark: 477,
  gap: 100000,
};

const frames = simpleFrames(timing, 14, tclValid);

function nearer(measured: number, target: number, others: number[]) {
  return others.every((other) => Math.abs(measured - target) < Math.abs(measured - other));
}

export const teknopoint: AcProtocol = {
  id: "teknopoint",
  name: "Teknopoint",
  frequency: 38000,
  bits: 112,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Teknopoint.cpp",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high"],
    swingV: ["off", "swing", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 31, step: 0.5 },
    features: ["turbo", "light", "econo"],
  },
  build: (s) => buildTcl(s, "gz055be1"),
  parse: parseTcl,
  modulate: frames.modulate,
  demodulate(pulses) {
    for (let start = 0; start < pulses.length; start += 2) {
      if (!nearer(pulses[start] ?? 0, 3600, [3000, 3450])) continue;
      const r = new PulseReader(pulses);
      r.i = start;
      const b = r.frame(14, timing);
      if (b && tclValid(b)) return b;
    }
    return null;
  },
};

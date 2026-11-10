import { PulseReader, simpleFrames, type Timing } from "../core/pulses";
import type { AcProtocol } from "../core/types";
import { buildTcl, parseTcl, tclValid } from "./_tcl";

const timing: Timing = {
  hdrMark: 3000,
  hdrSpace: 1650,
  bitMark: 500,
  oneSpace: 1050,
  zeroSpace: 325,
  footerMark: 500,
  gap: 100000,
};

const frames = simpleFrames(timing, 14, tclValid);

function nearer(measured: number, target: number, others: number[]) {
  return others.every((other) => Math.abs(measured - target) < Math.abs(measured - other));
}

export const tcl112ac: AcProtocol = {
  id: "tcl112ac",
  name: "TCL 112",
  frequency: 38000,
  bits: 112,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Tcl.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high"],
    swingV: ["off", "swing", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off", "swing"],
    temp: { min: 16, max: 31, step: 0.5 },
    features: ["turbo", "light", "econo"],
  },
  variants: [
    { id: "tac09chsd", label: "TAC09CHSD", note: "Sets the TCL flag in byte 12. TCL TAC-09CHSD and Leberg LBS-TOR07." },
    { id: "gz055be1", label: "GZ055BE1", note: "Clears the TCL flag. Teknopoint uses this byte layout with its own timings." },
  ],
  build: (s, variant = "tac09chsd") => buildTcl(s, variant),
  parse: parseTcl,
  modulate: frames.modulate,
  demodulate(pulses) {
    for (let start = 0; start < pulses.length; start += 2) {
      if (!nearer(pulses[start] ?? 0, 3000, [3450, 3600])) continue;
      const r = new PulseReader(pulses);
      r.i = start;
      const b = r.frame(14, timing);
      if (b && tclValid(b)) return b;
    }
    return null;
  },
};

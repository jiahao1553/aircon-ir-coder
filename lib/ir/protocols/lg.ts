import { makeLg } from "./_lg";

// LG 28-bit A/C, original timing (8.5 ms header).
export const lg = makeLg({
  id: "lg",
  name: "LG A/C 28-bit",
  timing: { hdrMark: 8500, hdrSpace: 4250, bitMark: 550, oneSpace: 1600, zeroSpace: 550, footerMark: 550, gap: 0 },
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "max"],
    swingV: ["off", "auto"],
    swingH: [],
    temp: { min: 16, max: 30, step: 1 },
    features: [],
  },
  variants: [
    {
      id: "ge6711ar2853m",
      label: "GE 6711AR2853M (AG1BH09AW101)",
      note: "State word only; no swing control.",
    },
    {
      id: "lg6711a20083v",
      label: "LG 6711A20083V (TS-H122ERM1)",
      note: "Adds a swing toggle word after the state when swing is on.",
    },
  ],
});

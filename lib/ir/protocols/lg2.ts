import { makeLg } from "./_lg";

// LG 28-bit A/C, LG2 timing (3.2 ms mark, 9.9 ms space header).
export const lg2 = makeLg({
  id: "lg2",
  name: "LG2 A/C 28-bit",
  timing: { hdrMark: 3200, hdrSpace: 9900, bitMark: 480, oneSpace: 1600, zeroSpace: 550, footerMark: 480, gap: 0 },
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["off", "auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["off", "auto"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["light"],
  },
  variants: [
    {
      id: "akb75215403",
      label: "AKB75215403 (AKB74395308, S4-W12JA3AA)",
      note: "State word only; high fan is sent as max, no swing or light words.",
    },
    {
      id: "akb74955603",
      label: "AKB74955603 (AKB73315611; AMNW09GSJA0, MS05SQ NW0, A4UW30GFA2)",
      note: "Distinct high and low-alt fan codes; swing position word; light-off toggle word.",
    },
    {
      id: "akb73757604",
      label: "AKB73757604 (AMNW24GTPA1, A4UW30GFA2)",
      note: "Four per-vane position words (no vane swing), plus a horizontal swing word.",
    },
  ],
});

import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// Panasonic A/C 216-bit: 27 bytes LSB-first in two sections (8 + 19 bytes), checksum = byte sum + 0xF4.
const timing: Timing = {
  hdrMark: 3456,
  hdrSpace: 1728,
  bitMark: 432,
  oneSpace: 1296,
  zeroSpace: 432,
  footerMark: 432,
  gap: 100000,
};
const SECTION_GAP = 10000;

const KNOWN_GOOD = [
  0x02, 0x20, 0xe0, 0x04, 0x00, 0x00, 0x00, 0x06, 0x02, 0x20, 0xe0, 0x04, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x0e,
  0xe0, 0x00, 0x00, 0x81, 0x00, 0x00, 0x00,
];

const mode = table([
  ["auto", 0],
  ["dry", 2],
  ["cool", 3],
  ["heat", 4],
  ["fan_only", 6],
] as const);

/** Stored as speed + 3 in the high nibble of byte 16. */
const fan = table([
  ["auto", 7],
  ["min", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["max", 4],
] as const);

const swingV = table([
  ["auto", 0xf],
  ["highest", 1],
  ["high", 2],
  ["middle", 3],
  ["low", 4],
  ["lowest", 5],
] as const);

const swingH = table([
  ["auto", 0xd],
  ["left_max", 0x9],
  ["left", 0xa],
  ["middle", 0x6],
  ["right", 0xb],
  ["right_max", 0xc],
] as const);

type Model = "jke" | "dke" | "nke" | "ckp" | "rkr";

/** Model as the remote's own bytes identify it (byte 17 holds swing-H, byte 21/23 model flags). */
function detectModel(b: Uint8Array): Model | undefined {
  if (b[23] === 0x89) return "rkr";
  if (b[17] === 0) {
    if (b[21] & 0x10 && b[23] & 0x01) return "ckp";
    if (b[23] & 0x80) return "jke";
  }
  if (b[23] === 0x01) return "dke";
  if (b[17] === 0x06) return "nke";
  return undefined;
}

/** CKP and RKR swap the quiet and powerful bits of byte 21. */
const quietBit = (b: Uint8Array) => (["ckp", "rkr"].includes(detectModel(b) ?? "") ? 5 : 0);
const powerfulBit = (b: Uint8Array) => 5 - quietBit(b);

function setSwingH(b: Uint8Array, raw: number) {
  const m = detectModel(b);
  if (m === "dke" || m === "rkr") setBits(b, 17, 0, 4, raw);
  else if (m === "nke") setBits(b, 17, 0, 4, 0x6);
}

function build(s: ClimateState, variant = "jke") {
  const b = Uint8Array.from(KNOWN_GOOD);
  b[13] &= 0xf0;
  b[17] = 0;
  b[21] &= ~0x10;
  b[23] = 0x81;
  b[25] = 0;
  if (variant === "dke") {
    b[23] = 0x01;
    b[25] = 0x06;
    setSwingH(b, 0x6);
  } else if (variant === "nke") b[17] = 0x06;
  else if (variant === "ckp") {
    b[21] |= 0x10;
    b[23] = 0x01;
  } else if (variant === "rkr") {
    b[13] |= 0x08;
    b[23] = 0x89;
  }

  setBit(b, 13, 0, s.power);
  setBits(b, 13, 4, 4, mode.toRaw(s.mode));
  setBits(b, 14, 1, 5, s.mode === "fan_only" ? 27 : clamp(Math.round(s.temp), 16, 30));
  setBits(b, 16, 4, 4, fan.toRaw(s.fan) + 3);
  setBits(b, 16, 0, 4, swingV.toRaw(s.swingV));
  if (s.swingH !== "off") setSwingH(b, swingH.toRaw(s.swingH));
  if (s.quiet !== undefined) {
    if (s.quiet) setBit(b, 21, powerfulBit(b), false);
    setBit(b, 21, quietBit(b), s.quiet);
  }
  if (s.turbo !== undefined) {
    if (s.turbo) setBit(b, 21, quietBit(b), false);
    setBit(b, 21, powerfulBit(b), s.turbo);
  }
  b[26] = (sumBytes(b, 0, 26) + 0xf4) & 0xff;
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  return {
    power: getBit(b, 13, 0),
    mode: mode.fromRaw(getBits(b, 13, 4, 3)),
    temp: getBits(b, 14, 1, 5),
    fan: fan.fromRaw(getBits(b, 16, 4, 4) - 3),
    swingV: swingV.fromRaw(getBits(b, 16, 0, 4)),
    swingH: swingH.fromRaw(getBits(b, 17, 0, 4)),
    quiet: getBit(b, 21, quietBit(b)),
    turbo: getBit(b, 21, powerfulBit(b)),
  };
}

const valid = (b: Uint8Array) =>
  b[0] === 0x02 && b[1] === 0x20 && b[8] === 0x02 && b[9] === 0x20 && b[26] === ((sumBytes(b, 0, 26) + 0xf4) & 0xff);

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.frame(bytes.subarray(0, 8), { ...timing, gap: SECTION_GAP });
  w.frame(bytes.subarray(8), timing);
  return w.pulses;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const head = r.frame(8, { ...timing, gap: SECTION_GAP });
    const tail = head && r.frame(19, timing);
    if (!head || !tail) continue;
    const b = new Uint8Array(27);
    b.set(head);
    b.set(tail, 8);
    if (valid(b)) return b;
  }
  return null;
}

export const panasonicAc: AcProtocol = {
  id: "panasonic_ac",
  name: "Panasonic A/C 216-bit",
  frequency: 36700,
  bits: 216,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Panasonic.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry", "fan_only"],
    fans: ["auto", "min", "low", "medium", "high", "max"],
    swingV: ["auto", "highest", "high", "middle", "low", "lowest"],
    swingH: ["auto", "left_max", "left", "middle", "right", "right_max"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["quiet", "turbo"],
  },
  variants: [
    { id: "jke", label: "JKE (A75C3747, CS-YW9MKD)", note: "Default layout; no horizontal swing." },
    {
      id: "dke",
      label: "DKE/DKW/PKR (A75C2616-1, A75C3704, PN1122V, CS-E12QKEW)",
      note: "Horizontal swing supported; different model bytes 23/25.",
    },
    { id: "nke", label: "NKE series", note: "Horizontal swing fixed at middle." },
    { id: "ckp", label: "CKP (A75C2311, CS-ME10/12/14CKPG)", note: "Quiet and powerful bits swapped; no horizontal swing." },
    { id: "rkr", label: "RKR (A75C4762, CS-Z9RKR, CS-Z24RKR)", note: "Horizontal swing; quiet and powerful bits swapped." },
  ],
  build,
  parse,
  modulate,
  demodulate,
};

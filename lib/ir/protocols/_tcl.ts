import { getBit, getBits, setBit, setBits, sumBytes } from "../core/bits";
import { clamp, table } from "../core/table";
import type { ClimateState } from "../core/types";

/** TCL112 / Teknopoint share one 14-byte state. Byte 12 bit 7 is the TCL (not GZ055BE1) flag. */
export const TCL_TEMPLATE = [0x23, 0xcb, 0x26, 0x01, 0x00, 0x24, 0x03, 0x07, 0x40, 0x00, 0x00, 0x00, 0x00];

export const tclMode = table([
  ["auto", 8],
  ["cool", 3],
  ["dry", 2],
  ["heat", 1],
  ["fan_only", 7],
] as const);

export const tclFan = table([
  ["auto", 0],
  ["min", 1],
  ["low", 2],
  ["medium", 3],
  ["high", 5],
] as const);

export const tclSwingV = table([
  ["off", 0],
  ["highest", 1],
  ["high", 2],
  ["middle", 3],
  ["low", 4],
  ["lowest", 5],
  ["swing", 7],
] as const);

export function tclChecksum(b: Uint8Array) {
  const sum = sumBytes(b, 0, b.length - 1);
  return (b[3] === 0x02 ? sum + 0x0f : sum) & 0xff;
}

export function tclValid(b: Uint8Array) {
  return b.length >= 14 && b[0] === 0x23 && b[1] === 0xcb && b[2] === 0x26 && b[13] === tclChecksum(b);
}

/** `model` "gz055be1" clears the TCL flag. Turbo forces high fan and swing, matching setTurbo. */
export function buildTcl(s: ClimateState, model = "tac09chsd") {
  const b = Uint8Array.from([...TCL_TEMPLATE, 0]);
  setBit(b, 5, 2, s.power);
  setBits(b, 6, 0, 4, tclMode.toRaw(s.mode));
  const halves = Math.round(clamp(s.temp, 16, 31) * 2);
  setBit(b, 12, 5, (halves & 1) === 1);
  setBits(b, 7, 0, 4, 31 - Math.floor(halves / 2));
  setBits(b, 8, 0, 3, tclFan.toRaw(s.fan));
  setBits(b, 8, 3, 3, tclSwingV.toRaw(s.swingV));
  setBit(b, 12, 3, s.swingH === "swing" || s.swingH === "auto");
  setBit(b, 5, 7, s.econo);
  setBit(b, 5, 6, s.light === false);
  if (s.turbo) {
    setBit(b, 6, 5, true);
    setBits(b, 8, 0, 3, 0b101);
    setBits(b, 8, 3, 3, 0b111);
  }
  setBit(b, 12, 7, model !== "gz055be1");
  b[13] = tclChecksum(b);
  return b;
}

export function parseTcl(b: Uint8Array): Partial<ClimateState> {
  const swingH = getBit(b, 12, 3);
  return {
    power: getBit(b, 5, 2),
    mode: tclMode.fromRaw(getBits(b, 6, 0, 4)),
    temp: 31 - getBits(b, 7, 0, 4) + (getBit(b, 12, 5) ? 0.5 : 0),
    fan: tclFan.fromRaw(getBits(b, 8, 0, 3)),
    swingV: tclSwingV.fromRaw(getBits(b, 8, 3, 3)),
    swingH: swingH ? "swing" : "off",
    econo: getBit(b, 5, 7),
    light: !getBit(b, 5, 6),
    turbo: getBit(b, 6, 5),
  };
}

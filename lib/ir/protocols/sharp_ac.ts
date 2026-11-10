import { getBit, getBits, setBit, setBits, xorBytes } from "../core/bits";
import { simpleFrames, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState, Fan, Mode, SwingV } from "../core/types";

// Sharp A/C 104-bit: 13 bytes LSB-first, signature AA 5A CF 10, 4-bit folded XOR checksum in the top of byte 12.
const timing: Timing = {
  hdrMark: 3800,
  hdrSpace: 1900,
  bitMark: 470,
  oneSpace: 1400,
  zeroSpace: 500,
  footerMark: 470,
  gap: 100000,
};

const RESET = [0xaa, 0x5a, 0xcf, 0x10, 0x00, 0x01, 0x00, 0x00, 0x08, 0x80, 0x00, 0xe0, 0x01];

const AUTO = 0b00; // Fan mode on A705/A903.
const HEAT = 0b01;
const COOL = 0b10;
const DRY = 0b11;
const FAN_AUTO = 2;
const VALID_FANS = [2, 4, 3, 5, 7];

const mode = table([
  ["auto", AUTO],
  ["cool", COOL],
  ["heat", HEAT],
  ["dry", DRY],
] as const);

const fanA907 = table([
  ["auto", 2],
  ["low", 4],
  ["medium", 3],
  ["high", 5],
  ["max", 7],
] as const);

const fanA705 = table([
  ["auto", 2],
  ["min", 4],
  ["low", 3],
  ["medium", 5],
  ["max", 7],
] as const);

const swing = table([
  ["off", 0],
  ["high", 1],
  ["middle", 3],
  ["low", 4],
  ["lowest", 6],
  ["auto", 7],
] as const);

type Model = "a907" | "a903" | "a705";

/** Replays the remote's setter rules, which reset "special" bits and enforce per-mode temp and fan. */
function emulator(model: Model) {
  const b = Uint8Array.from(RESET);
  let savedTemp = getBits(b, 4, 0, 4) + 15;
  let savedMode = getBits(b, 6, 0, 2);
  let savedFan = getBits(b, 6, 4, 3);
  const getMode = () => getBits(b, 6, 0, 2);
  const setSpecial = (v: number) => (b[10] = v);
  const powerSpecial = (v: number) => setBits(b, 5, 4, 4, v);
  const clearPowerSpecial = () => powerSpecial(getBits(b, 5, 4, 4) & 3);

  const ops = {
    b,
    setTemp(t: number, save = true) {
      const m = getMode();
      if (m === AUTO || m === DRY) {
        b[4] = 0;
        return;
      }
      b[4] = model === "a705" ? 0xd0 : 0xc0;
      const deg = clamp(t, 15, 30);
      if (save) savedTemp = deg;
      setBits(b, 4, 0, 4, deg - 15);
      setSpecial(4);
      clearPowerSpecial();
    },
    setFan(speed: number, save = true) {
      const valid = VALID_FANS.includes(speed);
      setBits(b, 6, 4, 3, valid ? speed : FAN_AUTO);
      if (save || !valid) savedFan = valid ? speed : FAN_AUTO;
      setSpecial(5);
      clearPowerSpecial();
    },
    setMode(m: number, save = true) {
      const real = m === HEAT && model !== "a907" ? AUTO : m;
      if (real === AUTO || real === DRY) ops.setFan(FAN_AUTO, false);
      setBits(b, 6, 0, 2, real);
      ops.setTemp(savedTemp, false);
      if (save) savedMode = getMode();
      setSpecial(0);
      clearPowerSpecial();
    },
    setSwingV(pos: number) {
      if (pos === 6 && getMode() !== HEAT) pos = 4;
      if (pos !== 0) setSpecial(6);
      setBits(b, 8, 0, 3, pos);
    },
    setIon(on: boolean) {
      setBit(b, 11, 2, on);
      clearPowerSpecial();
      if (on) setSpecial(6);
    },
    setClean(on: boolean) {
      if (on) {
        ops.setMode(DRY, false);
        ops.setPower(true, false);
      } else {
        ops.setMode(savedMode, false);
        ops.setFan(savedFan, false);
      }
      setBit(b, 6, 3, on);
      clearPowerSpecial();
    },
    setPower(on: boolean, prevOn: boolean) {
      powerSpecial(on ? (prevOn ? 3 : 1) : 2);
      if (getBit(b, 6, 3)) ops.setClean(false);
      setSpecial(0);
    },
  };
  if (model !== "a907") {
    setBit(b, 4, 4, true);
    setBit(b, 11, 4, true);
  }
  ops.setMode(getMode());
  return ops;
}

function checksum(b: Uint8Array) {
  let x = xorBytes(b, 0, 12) ^ (b[12] & 0xf);
  x ^= x >> 4;
  return x & 0xf;
}

function convertFan(f: Fan, model: Model) {
  if (model !== "a907" && (f === "low" || f === "medium")) return fanA705.toRaw(f);
  return f === "min" ? 4 : fanA907.toRaw(f);
}

function build(s: ClimateState, variant = "a907") {
  const model = variant as Model;
  const ac = emulator(model);
  const m = mode.toRaw(s.mode);
  ac.setMode(m);
  ac.setTemp(Math.round(s.temp));
  ac.setFan(convertFan(s.fan, model));
  // "off" means "leave the vane alone", as the remote does when swing didn't change.
  if (s.swingV !== "off") ac.setSwingV(swing.toRaw(s.swingV === "highest" ? "high" : s.swingV));
  ac.setIon(false);
  ac.setMode(m);
  ac.setClean(false);
  ac.setPower(s.power, false);
  setBits(ac.b, 12, 4, 4, checksum(ac.b));
  return ac.b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const a705 = getBit(b, 11, 4);
  const m = getBits(b, 6, 0, 2);
  const f = getBits(b, 6, 4, 3);
  const ps = getBits(b, 5, 4, 4);
  return {
    power: ps !== 0 && ps !== 2,
    mode: (a705 && m === AUTO ? "fan_only" : mode.fromRaw(m)) as Mode,
    temp: getBits(b, 4, 0, 4) + 15,
    fan: (a705 ? fanA705 : fanA907).fromRaw(f) as Fan,
    swingV: (getBits(b, 8, 0, 3) === 2 ? "off" : swing.fromRaw(getBits(b, 8, 0, 3))) as SwingV,
    swingH: "off",
  };
}

const valid = (b: Uint8Array) =>
  b[0] === 0xaa && b[1] === 0x5a && b[2] === 0xcf && b[3] === 0x10 && getBits(b, 12, 4, 4) === checksum(b);

export const sharpAc: AcProtocol = {
  id: "sharp_ac",
  name: "Sharp A/C 104-bit",
  frequency: 38000,
  bits: 104,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Sharp.h",
  capabilities: {
    modes: ["auto", "cool", "heat", "dry"],
    fans: ["auto", "low", "medium", "high", "max"],
    swingV: ["off", "auto", "high", "middle", "low", "lowest"],
    swingH: [],
    temp: { min: 15, max: 30, step: 1 },
    features: [],
  },
  variants: [
    {
      id: "a907",
      label: "CRMC-A907 / A950 JBEZ (AY-ZP40KR, AH-AxSAY)",
      note: "Default. Has heat and auto modes.",
    },
    {
      id: "a903",
      label: "CRMC-A903 / 820 / A863 JBEZ (AH-PR13-GL, AH-XP10NRY, AH-A12REVP-1)",
      note: "No heat: heat and auto both send fan mode. Low/medium use different fan codes.",
    },
    {
      id: "a705",
      label: "CRMC-A705 JBEZ",
      note: "As A903, and the temperature byte's top nibble is 0xD instead of 0xC.",
    },
  ],
  build,
  parse,
  ...simpleFrames(timing, 13, valid),
};

import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, ClimateState } from "../core/types";

// 8 bytes, LSB-first, split after byte 3 by a 0b010 block mark. Byte 3 high nibble is the constant 0x5.
const timing: Timing = {
  hdrMark: 9000,
  hdrSpace: 4500,
  bitMark: 620,
  oneSpace: 1600,
  zeroSpace: 540,
  footerMark: 620,
  gap: 19980,
};

const mode = table([
  ["auto", 0],
  ["cool", 1],
  ["dry", 2],
  ["fan_only", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 0],
  ["min", 1],
  ["medium", 2],
  ["max", 3],
] as const);

const swingV = table([
  ["off", 0],
  ["auto", 1],
  ["highest", 2],
  ["upper_middle", 3],
  ["middle", 4],
  ["low", 5],
  ["lowest", 6],
] as const);

const swingH = table([
  ["off", 0],
  ["auto", 1],
  ["left_max", 2],
  ["left", 3],
  ["middle", 4],
  ["right", 5],
  ["right_max", 6],
] as const);

function nibbleSum(b: Uint8Array) {
  let sum = 10;
  for (let i = 0; i < 4; i++) sum += b[i] & 0xf;
  for (let i = 4; i < 7; i++) sum += b[i] >> 4;
  return sum & 0xf;
}

function valid(b: Uint8Array) {
  return b.length === 8 && (b[3] & 0xf0) === 0x50 && (b[7] >> 4) === nibbleSum(b);
}

function build(s: ClimateState, variant = "yaw1f") {
  const b = new Uint8Array(8);
  const econoMode = variant === "yx1fsf" && !!s.econo;
  const modeRaw = econoMode ? 5 : mode.toRaw(s.mode);
  const speed = modeRaw === 2 ? 1 : fan.toRaw(s.fan);
  const temp = modeRaw === 0 ? 25 : clamp(Math.round(s.temp), 16, 30);
  const vertical = swingV.toRaw(s.swingV);
  b[0] =
    (modeRaw & 7) |
    (s.power ? 0x08 : 0) |
    ((speed & 3) << 4) |
    (s.swingV === "auto" ? 0x40 : 0) |
    (s.sleep ? 0x80 : 0);
  b[1] = (temp - 16) & 0xf;
  b[2] =
    (s.turbo ? 0x10 : 0) |
    (s.light !== false ? 0x20 : 0) |
    (s.power && variant === "yaw1f" ? 0x40 : 0) |
    (s.clean ? 0x80 : 0);
  b[3] = 0x50;
  b[4] = (vertical & 0xf) | ((swingH.toRaw(s.swingH) & 7) << 4);
  b[5] = 0x20;
  b[7] = s.econo ? 0x04 : 0;
  b[7] = (b[7] & 0x0f) | (nibbleSum(b) << 4);
  return b;
}

function parse(b: Uint8Array): Partial<ClimateState> {
  const modeRaw = b[0] & 7;
  return {
    power: (b[0] & 0x08) !== 0,
    mode: modeRaw === 5 ? undefined : mode.fromRaw(modeRaw),
    temp: (b[1] & 0xf) + 16,
    fan: fan.fromRaw((b[0] >> 4) & 3),
    swingV: swingV.fromRaw(b[4] & 0xf),
    swingH: swingH.fromRaw((b[4] >> 4) & 7),
    turbo: (b[2] & 0x10) !== 0,
    light: (b[2] & 0x20) !== 0,
    clean: (b[2] & 0x80) !== 0,
    sleep: (b[0] & 0x80) !== 0,
    econo: modeRaw === 5 || (b[7] & 0x04) !== 0,
  };
}

function modulate(bytes: Uint8Array) {
  const w = new PulseWriter();
  w.header(timing);
  w.bytes(bytes.subarray(0, 4), timing);
  w.bits(0b010, 3, timing);
  w.footer(timing);
  w.bytes(bytes.subarray(4), timing);
  w.footer(timing);
  return w.pulses;
}

function read(r: PulseReader) {
  if (!r.header(timing)) return null;
  const head = r.bytes(4, timing);
  if (!head || r.bits(3, timing) !== 2n || !r.footer(timing)) return null;
  const tail = r.bytes(4, timing);
  if (!tail || !r.footer(timing)) return null;
  const b = new Uint8Array(8);
  b.set(head);
  b.set(tail, 4);
  return valid(b) ? b : null;
}

function demodulate(pulses: number[]) {
  for (let start = 0; start < pulses.length; start += 2) {
    const r = new PulseReader(pulses);
    r.i = start;
    const b = read(r);
    if (b) return b;
  }
  return null;
}

export const gree: AcProtocol = {
  id: "gree",
  name: "Gree",
  frequency: 38000,
  bits: 64,
  source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_Gree.h",
  capabilities: {
    modes: ["auto", "cool", "dry", "heat", "fan_only"],
    fans: ["auto", "min", "medium", "max"],
    swingV: ["off", "auto", "highest", "upper_middle", "middle", "low", "lowest"],
    swingH: ["off", "auto", "left_max", "left", "middle", "right", "right_max"],
    temp: { min: 16, max: 30, step: 1 },
    features: ["turbo", "light", "clean", "sleep", "econo"],
  },
  variants: [
    { id: "yaw1f", label: "YAW1F", note: "Sets the model-A bit while the unit is on." },
    { id: "ybofb", label: "YBOFB", note: "Leaves the model-A bit clear." },
    { id: "yx1fsf", label: "YX1FSF", note: "Econo is sent as mode 5 instead of the econo bit." },
  ],
  build,
  parse,
  modulate,
  demodulate,
};

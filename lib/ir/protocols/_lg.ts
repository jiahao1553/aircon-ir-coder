import { PulseReader, PulseWriter, type Timing } from "../core/pulses";
import { clamp, table } from "../core/table";
import type { AcProtocol, Capabilities, ClimateState, SwingV, Variant } from "../core/types";

// LG 28-bit A/C words, MSB-first: signature 0x88 (bits 20-27), power (18-19), mode (12-14), temp - 15 (8-11),
// fan (4-7), and a checksum nibble = sum of the four nibbles in bits 4-19. Some remotes follow the state word
// with extra words (swing, light). The payload is every word sent, each as 4 big-endian bytes.

const MIN_GAP = 39750;
const MIN_MESSAGE = 108050;

const OFF = 0x88c0051;
const LIGHT_TOGGLE = 0x88c00a6;
const SWINGV_TOGGLE = 0x8810001;
const SWINGH_AUTO = 0x881316b;
const SWINGH_OFF = 0x881317c;
const VANE_BASE = 0x8813200;

const mode = table([
  ["cool", 0],
  ["dry", 1],
  ["fan_only", 2],
  ["auto", 3],
  ["heat", 4],
] as const);

const fan = table([
  ["auto", 5],
  ["min", 0],
  ["low", 1],
  ["medium", 2],
  ["max", 4],
  ["high", 10],
] as const);

const swingCode = table([
  ["off", 0x881315a],
  ["auto", 0x8813149],
  ["highest", 0x881309d],
  ["high", 0x881308c],
  ["middle", 0x881306a],
  ["low", 0x8813059],
  ["lowest", 0x8813048],
] as const);

/** Per-vane position codes; anything but these four maps to "highest". */
const vanePos = table([
  ["highest", 1],
  ["high", 2],
  ["middle", 4],
  ["low", 5],
  ["lowest", 6],
] as const);

const checksum = (word: number) => {
  const v = (word >>> 4) & 0xffff;
  return ((v & 0xf) + ((v >> 4) & 0xf) + ((v >> 8) & 0xf) + (v >> 12)) & 0xf;
};
const withChecksum = (word: number) => (word & ~0xf) | checksum(word);
const validWord = (w: number) => w >>> 20 === 0x88 && (w & 0xf) === checksum(w);

type LgModel = "ge6711ar2853m" | "lg6711a20083v" | "akb75215403" | "akb74955603" | "akb73757604";

function words(s: ClimateState, model: LgModel) {
  if (!s.power) return [OFF];
  let speed = fan.toRaw(s.fan);
  if (model === "akb74955603" && speed === 1) speed = 9;
  if (model !== "akb74955603" && speed === 10) speed = 4;
  let w = 0x88 << 20;
  w |= mode.toRaw(s.mode) << 12;
  w |= (clamp(Math.round(s.temp), 16, 30) - 15) << 8;
  w |= speed << 4;
  const out = [withChecksum(w)];
  if (model === "lg6711a20083v" && s.swingV !== "off") out.push(SWINGV_TOGGLE);
  if (model === "akb74955603") {
    if (s.swingV !== "off") out.push(swingCode.toRaw(s.swingV));
    if (s.light === false) out.push(LIGHT_TOGGLE);
  }
  if (model === "akb73757604") {
    const pos = vanePos.toRaw(s.swingV);
    for (let vane = 0; vane < 4; vane++) out.push(withChecksum(VANE_BASE + ((vane * 8 + pos) << 4)));
    if (s.swingH !== "off") out.push(SWINGH_AUTO);
  }
  return out;
}

const toBytes = (ws: number[]) => Uint8Array.from(ws.flatMap((w) => [w >>> 24, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff]));

const toWords = (b: Uint8Array) =>
  Array.from({ length: b.length / 4 }, (_, i) => ((b[4 * i] << 24) | (b[4 * i + 1] << 16) | (b[4 * i + 2] << 8) | b[4 * i + 3]) >>> 0);

function parse(b: Uint8Array, light: boolean): Partial<ClimateState> {
  const [first, ...rest] = toWords(b);
  if (first === OFF) return { power: false };
  const raw = (first >> 4) & 0xf;
  const out: Partial<ClimateState> = {
    power: ((first >> 18) & 3) === 0,
    mode: mode.fromRaw((first >> 12) & 7),
    temp: ((first >> 8) & 0xf) + 15,
    fan: raw === 9 ? "low" : fan.fromRaw(raw),
    swingV: "off",
    swingH: "off",
  };
  if (light) out.light = true;
  for (const w of rest) {
    if (w === SWINGV_TOGGLE) out.swingV = "auto";
    else if (w === LIGHT_TOGGLE) out.light = false;
    else if (w === SWINGH_AUTO) out.swingH = "auto";
    else if (w === SWINGH_OFF) out.swingH = "off";
    else if (w >= VANE_BASE && w < VANE_BASE + (32 << 4)) out.swingV = vanePos.fromRaw((w >> 4) & 7) ?? "highest";
    else if (swingCode.fromRaw(w)) out.swingV = swingCode.fromRaw(w) as SwingV;
  }
  return out;
}

export function makeLg(opts: {
  id: string;
  name: string;
  timing: Timing;
  capabilities: Capabilities;
  variants: Variant[];
}): AcProtocol {
  const t = { ...opts.timing, msbFirst: true };
  return {
    id: opts.id,
    name: opts.name,
    frequency: 38000,
    bits: 28,
    source: "https://github.com/crankyoldgit/IRremoteESP8266/blob/master/src/ir_LG.h",
    capabilities: opts.capabilities,
    variants: opts.variants,
    build: (s, variant = opts.variants[0].id) => toBytes(words(s, variant as LgModel)),
    parse: (b) => parse(b, opts.capabilities.features.includes("light")),
    modulate(bytes) {
      const w = new PulseWriter();
      for (const word of toWords(bytes)) {
        const start = w.pulses.length;
        w.header(t);
        w.bits(word, 28, t);
        w.mark(t.footerMark);
        const elapsed = w.pulses.slice(start).reduce((a, b) => a + b, 0);
        w.space(Math.max(MIN_GAP, MIN_MESSAGE - elapsed));
      }
      return w.pulses;
    },
    demodulate(pulses) {
      for (let start = 0; start < pulses.length; start += 2) {
        const r = new PulseReader(pulses);
        r.i = start;
        const found: number[] = [];
        for (;;) {
          const at = r.i;
          const v = r.header(t) ? r.bits(28, t) : null;
          if (v === null || !r.footer({ ...t, gap: MIN_GAP }) || !validWord(Number(v))) {
            r.i = at;
            break;
          }
          found.push(Number(v));
        }
        if (found.length) return toBytes(found);
      }
      return null;
    },
  };
}

import type { AcProtocol, ClimateState, Fan, Mode, SwingH, SwingV } from "./core/types";
import { CODECS, type CodecId, type Encoding } from "./formats";
import { encodeState } from "./index";
import type { FlipperSignal } from "./transports/flipper";

export interface SmartIrSpec {
  protocol: AcProtocol;
  variant?: string;
  manufacturer: string;
  models: string[];
  controller: string;
  encoding: Encoding;
  codec: CodecId;
  modes: Mode[];
  fans: Fan[];
  /** Which vane the SmartIR swing modes drive; null leaves swing out of the file. */
  swingAxis: "v" | "h" | null;
  swings: (SwingV | SwingH)[];
  minTemp: number;
  maxTemp: number;
  step: number;
  /** Settings not in the grid (the other vane, features); also the state sent as `off`. */
  base: ClimateState;
}

function withSwing(s: ClimateState, axis: SmartIrSpec["swingAxis"], swing: string): ClimateState {
  if (axis === "v") return { ...s, swingV: swing as SwingV };
  if (axis === "h") return { ...s, swingH: swing as SwingH };
  return s;
}

export function temperatures(spec: Pick<SmartIrSpec, "minTemp" | "maxTemp" | "step">) {
  const out: number[] = [];
  for (let t = spec.minTemp; t <= spec.maxTemp + 1e-9; t += spec.step) out.push(Math.round(t * 2) / 2);
  return out;
}

export function commandCount(spec: SmartIrSpec) {
  return spec.modes.length * spec.fans.length * Math.max(1, spec.swingAxis ? spec.swings.length : 1) * temperatures(spec).length + 1;
}

/** A SmartIR climate device file (litinoveweedle/SmartIR schema). */
export function buildSmartIr(spec: SmartIrSpec) {
  const { protocol: p } = spec;
  // UFOR11Controller wraps the stored code as {"ir_code_to_send": code} when it publishes.
  const encode = (s: ClimateState) => CODECS[spec.codec].encode(encodeState(p, s, spec.variant), p.frequency);
  const temps = temperatures(spec);
  const swings = spec.swingAxis ? spec.swings : [null];

  const off = encode({ ...spec.base, power: false });
  const commands: Record<string, unknown> = { off };
  if (p.powerToggle) commands.on = off;
  for (const mode of spec.modes) {
    const byFan: Record<string, unknown> = {};
    for (const fan of spec.fans) {
      const bySwing: Record<string, Record<string, string>> = {};
      for (const swing of swings) {
        const byTemp: Record<string, string> = {};
        for (const temp of temps) {
          const s = withSwing({ ...spec.base, power: true, mode, fan, temp }, spec.swingAxis, swing ?? "");
          byTemp[String(temp)] = encode(s);
        }
        bySwing[swing ?? ""] = byTemp;
      }
      byFan[fan] = spec.swingAxis ? bySwing : bySwing[""];
    }
    commands[mode] = byFan;
  }

  return {
    manufacturer: spec.manufacturer,
    supportedModels: spec.models,
    supportedController: spec.controller,
    commandsEncoding: spec.encoding,
    temperatureUnit: "C",
    minTemperature: spec.minTemp,
    maxTemperature: spec.maxTemp,
    precision: spec.step,
    operationModes: spec.modes,
    fanModes: spec.fans,
    ...(spec.swingAxis ? { swingModes: spec.swings } : {}),
    commands,
  };
}

/** A small Flipper test set: off, the tuned state, and cool/heat/dry probes named like Flipper-IRDB's ac.ir. */
export function flipperSamples(p: AcProtocol, state: ClimateState, variant?: string): FlipperSignal[] {
  const c = p.capabilities;
  const pick = (t: number) => Math.min(c.temp.max, Math.max(c.temp.min, t));
  const fans = c.fans.filter((f) => f !== "auto");
  const hi = fans[fans.length - 1] ?? state.fan;
  const lo = fans[0] ?? state.fan;
  const probes: [string, Partial<ClimateState>][] = [
    ["Off", { power: false }],
    ["Tuned", {}],
    ["Cool_hi", { mode: "cool", temp: pick(18), fan: hi }],
    ["Cool_lo", { mode: "cool", temp: pick(26), fan: lo }],
    ["Heat_hi", { mode: "heat", temp: pick(30), fan: hi }],
    ["Heat_lo", { mode: "heat", temp: pick(22), fan: lo }],
    ["Dh", { mode: "dry", temp: pick(24) }],
  ];
  return probes
    .filter(([, patch]) => !patch.mode || c.modes.includes(patch.mode))
    .map(([name, patch]) => ({
      name,
      frequency: p.frequency,
      pulses: encodeState(p, { ...state, power: true, ...patch }, variant),
    }));
}

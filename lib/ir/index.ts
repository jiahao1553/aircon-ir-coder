import type { AcProtocol, ClimateState } from "./core/types";
import { PROTOCOLS } from "./protocols";

export * from "./core/types";
export { PROTOCOLS };

export function getProtocol(id: string): AcProtocol {
  const p = PROTOCOLS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown protocol ${id}`);
  return p;
}

export function defaultState(p: AcProtocol): ClimateState {
  const c = p.capabilities;
  const temp = Math.min(c.temp.max, Math.max(c.temp.min, 24));
  return {
    power: true,
    mode: c.modes.includes("cool") ? "cool" : c.modes[0],
    temp,
    fan: c.fans.includes("auto") ? "auto" : c.fans[0],
    swingV: c.swingV[0] ?? "off",
    swingH: c.swingH[0] ?? "off",
  };
}

/** Moves each field onto the nearest value the protocol supports. */
export function fitState(p: AcProtocol, s: ClimateState): ClimateState {
  const c = p.capabilities;
  const d = defaultState(p);
  const step = c.temp.step;
  return {
    ...s,
    mode: c.modes.includes(s.mode) ? s.mode : d.mode,
    fan: c.fans.includes(s.fan) ? s.fan : d.fan,
    swingV: c.swingV.includes(s.swingV) ? s.swingV : d.swingV,
    swingH: c.swingH.includes(s.swingH) ? s.swingH : d.swingH,
    temp: Math.min(c.temp.max, Math.max(c.temp.min, Math.round(s.temp / step) * step)),
  };
}

export function encodeState(p: AcProtocol, state: ClimateState, variant?: string): number[] {
  return p.modulate(p.build(state, variant));
}

export interface Identified {
  protocol: AcProtocol;
  bytes: Uint8Array;
  state: Partial<ClimateState>;
  /** The variant whose `build` reproduces the capture byte for byte, if any. */
  variant?: string;
}

/** Every protocol whose timing and checksum match the capture. */
export function identify(pulses: number[]): Identified[] {
  const hits: Identified[] = [];
  for (const protocol of PROTOCOLS) {
    try {
      const bytes = protocol.demodulate(pulses);
      if (!bytes) continue;
      const state = protocol.parse(bytes);
      const full = fitState(protocol, { ...defaultState(protocol), ...state });
      const same = (v?: string) => protocol.build(full, v).every((b, i) => b === bytes[i]);
      const variant = protocol.variants?.find((v) => same(v.id))?.id;
      hits.push({ protocol, bytes, state, variant });
    } catch {
      // a protocol that can't read this capture just doesn't match
    }
  }
  return hits;
}

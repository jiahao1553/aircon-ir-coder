import { BRAND_MODELS } from "./brands.data";
import type { AcProtocol } from "./core/types";
import { PROTOCOLS } from "./protocols";

export interface ModelEntry {
  model: string;
  protocols: string[];
  /** Remote-model hint from the source, matched against the protocol's variants. */
  variant?: string;
}

export interface Brand {
  name: string;
  models: ModelEntry[];
}

/** Captures in this repo that pin a protocol variant. */
const LOCAL: Record<string, ModelEntry[]> = {
  "Mitsubishi Electric": [
    { model: "MSXY-FP10VG / FP13VG / FP18VG (SmartIR 1136)", protocols: ["mitsubishi_ac"], variant: "msxy" },
    { model: "Mr. Slim JS 1.5hp (learned capture)", protocols: ["mitsubishi_ac"], variant: "mr_slim" },
  ],
};

const known = new Set(PROTOCOLS.map((p) => p.id));

export const BRANDS: Brand[] = Object.entries({ ...BRAND_MODELS })
  .map(([name, models]) => ({ name, models: [...(LOCAL[name] ?? []), ...models] }))
  .concat(Object.entries(LOCAL).filter(([n]) => !(n in BRAND_MODELS)).map(([name, models]) => ({ name, models })))
  .map((b) => ({
    ...b,
    models: b.models
      .map((m) => ({ ...m, protocols: m.protocols.filter((p) => known.has(p)) }))
      .filter((m) => m.protocols.length),
  }))
  .filter((b) => b.models.length)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Every protocol any model of the brand uses, most common first. */
export function brandProtocols(brand: Brand): string[] {
  const count = new Map<string, number>();
  for (const m of brand.models) for (const p of m.protocols) count.set(p, (count.get(p) ?? 0) + (m.protocols.length === 1 ? 2 : 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

export function matchVariant(protocol: AcProtocol, hint?: string): string | undefined {
  if (!protocol.variants?.length) return undefined;
  const h = hint?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = h
    ? protocol.variants.find((v) => {
        const id = v.id.toLowerCase().replace(/[^a-z0-9]/g, "");
        const label = v.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        return id === h || label.includes(h) || h.includes(id);
      })
    : undefined;
  return (hit ?? protocol.variants[0]).id;
}

/** The trial order for a model: each candidate protocol with its hinted variant first, then its other variants. */
export function trials(entry: ModelEntry, protocols: AcProtocol[]): { protocol: AcProtocol; variant?: string }[] {
  const out: { protocol: AcProtocol; variant?: string }[] = [];
  for (const id of entry.protocols) {
    const p = protocols.find((x) => x.id === id);
    if (!p) continue;
    const first = matchVariant(p, entry.variant);
    out.push({ protocol: p, variant: first });
    for (const v of p.variants ?? []) if (v.id !== first) out.push({ protocol: p, variant: v.id });
  }
  return out;
}

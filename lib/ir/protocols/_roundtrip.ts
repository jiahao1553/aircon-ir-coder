import type { AcProtocol, ClimateState } from "../core/types";

/** Every declared capability value that `parse(build(s))` fails to return, varying one field of `base` at a time. */
export function roundTripFailures(p: AcProtocol, base: ClimateState, variant?: string) {
  const c = p.capabilities;
  const cases: Partial<ClimateState>[] = [
    ...c.modes.map((mode) => ({ mode })),
    ...c.fans.map((fan) => ({ fan })),
    ...c.swingV.map((swingV) => ({ swingV })),
    ...c.swingH.map((swingH) => ({ swingH })),
    ...c.features.flatMap((f) => [{ [f]: true }, { [f]: false }]),
    { power: true },
    { power: false },
  ];
  for (let t = c.temp.min; t <= c.temp.max; t += c.temp.step) cases.push({ temp: t });
  const failures: string[] = [];
  for (const change of cases) {
    const got = p.parse(p.build({ ...base, ...change }, variant)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(change)) if (got[k] !== v) failures.push(`${k}=${v} parsed as ${got[k]}`);
  }
  return failures;
}

/** Two-way lookup between canonical names and a protocol's raw field values. The first entry is the fallback. */
export function table<K extends string>(entries: readonly (readonly [K, number])[]) {
  const keys = entries.map(([k]) => k);
  return {
    keys,
    toRaw(key: K | string | undefined): number {
      const hit = entries.find(([k]) => k === key);
      return (hit ?? entries[0])[1];
    },
    fromRaw(raw: number): K | undefined {
      return entries.find(([, v]) => v === raw)?.[0];
    },
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

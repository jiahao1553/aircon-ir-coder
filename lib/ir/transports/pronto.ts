// Pronto learned format: 0000, carrier code, pair count, 0, then durations in carrier cycles.
const PRONTO_CLOCK = 0.241246;

export function encodePronto(pulses: number[], frequency = 38000): string {
  const code = Math.round(1_000_000 / (frequency * PRONTO_CLOCK));
  const period = code * PRONTO_CLOCK;
  const even = pulses.length % 2 ? [...pulses, 100000] : pulses;
  const words = [0, code, even.length / 2, 0, ...even.map((us) => Math.max(1, Math.round(us / period)))];
  return words.map((w) => w.toString(16).padStart(4, "0").toUpperCase()).join(" ");
}

export function decodePronto(text: string): { pulses: number[]; frequency: number } {
  const words = text.trim().split(/\s+/).map((w) => parseInt(w, 16));
  if (words.length < 6 || words[0] !== 0 || words.some(Number.isNaN)) {
    throw new Error("Pronto codes start with 0000 and contain hex words.");
  }
  const period = words[1] * PRONTO_CLOCK;
  const count = (words[2] + words[3]) * 2;
  return {
    pulses: words.slice(4, 4 + count).map((c) => Math.round(c * period)),
    frequency: Math.round(1_000_000 / period),
  };
}

// ESPHome `remote_transmitter.transmit_raw`: marks positive, spaces negative, in µs.
export function encodeEsphome(pulses: number[]): string {
  return JSON.stringify(pulses.map((us, i) => (i % 2 ? -Math.round(us) : Math.round(us))));
}

export function decodeEsphome(text: string): number[] {
  const values = JSON.parse(text);
  if (!Array.isArray(values) || !values.every((v) => typeof v === "number")) {
    throw new Error("ESPHome raw codes are a JSON array of numbers.");
  }
  return values.map((v: number) => Math.abs(v));
}

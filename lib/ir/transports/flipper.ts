// Flipper Zero .ir signal file, raw signals only. Format per
// https://github.com/flipperdevices/flipperzero-firmware/blob/dev/documentation/file_formats/InfraredFileFormats.md
const MAX_TIMINGS = 1024;

export interface FlipperSignal {
  name: string;
  pulses: number[];
  frequency?: number;
}

export function encodeFlipper(signals: FlipperSignal[]): string {
  const lines = ["Filetype: IR signals file", "Version: 1"];
  for (const s of signals) {
    if (s.pulses.length > MAX_TIMINGS) {
      throw new Error(`"${s.name}" has ${s.pulses.length} timings; Flipper raw signals hold at most ${MAX_TIMINGS}.`);
    }
    lines.push(
      "#",
      `name: ${s.name.replace(/\s+/g, "_")}`,
      "type: raw",
      `frequency: ${s.frequency ?? 38000}`,
      "duty_cycle: 0.330000",
      `data: ${s.pulses.map((us) => Math.round(us)).join(" ")}`,
    );
  }
  return lines.join("\n") + "\n";
}

export function decodeFlipper(text: string): FlipperSignal[] {
  const out: FlipperSignal[] = [];
  let current: Partial<FlipperSignal> & { type?: string } = {};
  const flush = () => {
    if (current.name && current.type === "raw" && current.pulses) out.push(current as FlipperSignal);
    current = {};
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "#") flush();
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "name") {
      flush();
      current.name = value;
    } else if (key === "type") current.type = value;
    else if (key === "frequency") current.frequency = Number(value);
    else if (key === "data") current.pulses = value.split(/\s+/).map(Number);
  }
  flush();
  return out;
}

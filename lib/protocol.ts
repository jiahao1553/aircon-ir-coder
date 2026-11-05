export const MODELS = ["MSXY-FP10VG", "MSXY-FP13VG", "MSXY-FP18VG"] as const;

export const MODES = ["cool", "dry", "fan_only"] as const;
export type Mode = (typeof MODES)[number];

export const FANS = ["quiet", "auto", "low", "mid", "high", "highest"] as const;
export type Fan = (typeof FANS)[number];

export const MIN_TEMP = 16;
export const MAX_TEMP = 31;

const HEADER = [0x23, 0xcb, 0x26, 0x01, 0x00] as const;

const MODE_BYTE: Record<Mode, number> = {
  cool: 0x18,
  dry: 0x10,
  fan_only: 0x38,
};

const MODE_BY_BYTE: Record<number, Mode> = {
  0x18: "cool",
  0x10: "dry",
  0x38: "fan_only",
};

const FAN_BITS: Record<Fan, number> = {
  auto: 0,
  low: 1,
  mid: 2,
  high: 3,
  highest: 4,
  quiet: 5,
};

const FAN_BY_BITS: Record<number, Fan> = {
  0: "auto",
  1: "low",
  2: "mid",
  3: "high",
  4: "highest",
  5: "quiet",
};

/** Constant per mode in this code set. High nibble stays 0x3. */
const VANE_BYTE: Record<Mode, number> = {
  cool: 0x36,
  dry: 0x32,
  fan_only: 0x30,
};

export const MODE_LABEL: Record<Mode, string> = {
  cool: "Cool",
  dry: "Dry",
  fan_only: "Fan",
};

export const FAN_LABEL: Record<Fan, string> = {
  quiet: "Quiet",
  auto: "Auto",
  low: "Low",
  mid: "Mid",
  high: "High",
  highest: "Highest",
};

export type FrameState = {
  power: boolean;
  mode: Mode;
  /** Setpoint in °C. Dry and fan-only frames do not carry it. */
  temperature: number;
  fan: Fan;
  /** Minutes since midnight, before the 6-minute quantization. */
  clockMinutes: number;
};

export type ParsedFrame = {
  bytes: number[];
  checksumOk: boolean;
  headerOk: boolean;
  power: boolean | null;
  mode: Mode | null;
  /** Setpoint when the mode stores one. Null for dry and fan-only. */
  temperature: number | null;
  /** Value written in byte 7, as °C. Dry and fan-only keep 24. */
  storedTemperature: number | null;
  fan: Fan | null;
  limitFlag: boolean;
  clockMinutes: number;
  notes: string[];
};

export function clampTemp(value: number): number {
  return Math.min(MAX_TEMP, Math.max(MIN_TEMP, Math.round(value)));
}

export function quantizeClock(minutes: number): number {
  const wrapped = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return Math.floor(wrapped / 6) * 6;
}

export function formatClock(minutes: number): string {
  const safe = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function fanByteFor(state: FrameState): { byte: number; limitFlag: boolean } {
  let byte = 0x78 | FAN_BITS[state.fan];
  const coolLimit =
    state.mode === "cool" &&
    (state.temperature === MIN_TEMP || state.temperature === MAX_TEMP);
  const autoOutsideCool =
    (state.mode === "dry" || state.mode === "fan_only") && state.fan === "auto";
  if (coolLimit || autoOutsideCool) {
    byte = (byte + 0x40) & 0xff;
    return { byte, limitFlag: true };
  }
  return { byte, limitFlag: false };
}

export function buildFrame(state: FrameState): number[] {
  const temperature = clampTemp(state.temperature);
  const normalized: FrameState = { ...state, temperature };
  const { byte: fanByte } = fanByteFor(normalized);
  const bytes = [
    ...HEADER,
    state.power ? 0x20 : 0x00,
    MODE_BYTE[state.mode],
    state.mode === "cool" ? temperature - MIN_TEMP : 0x08,
    VANE_BYTE[state.mode],
    fanByte,
    Math.floor(quantizeClock(state.clockMinutes) / 6) & 0xff,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  bytes.push(checksumOf(bytes));
  return bytes;
}

export function checksumOf(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length && i < 17; i += 1) sum += bytes[i];
  return sum & 0xff;
}

export function parseFrame(bytes: number[]): ParsedFrame {
  const notes: string[] = [];
  const headerOk = HEADER.every((value, index) => bytes[index] === value);
  if (!headerOk) {
    notes.push("The preamble is not 23 CB 26 01 00, so this is not an MSXY-FP frame.");
  }
  const checksumOk = bytes.length === 18 && checksumOf(bytes) === bytes[17];
  if (bytes.length !== 18) {
    notes.push(`Expected 18 bytes and found ${bytes.length}.`);
  } else if (!checksumOk) {
    notes.push("Checksum does not match the sum of the first 17 bytes.");
  }

  const power = bytes[5] === 0x20 ? true : bytes[5] === 0x00 ? false : null;
  if (power === null && bytes.length > 5) {
    notes.push(`Power byte 0x${hex(bytes[5])} is neither 0x20 (on) nor 0x00 (off).`);
  }

  const mode = MODE_BY_BYTE[bytes[6]] ?? null;
  if (!mode && bytes.length > 6) {
    notes.push(`Mode byte 0x${hex(bytes[6])} is not cool (18), dry (10), or fan (38).`);
  }

  const storedTemperature =
    bytes.length > 7 && bytes[7] <= 0x0f ? bytes[7] + MIN_TEMP : null;
  const temperature = mode === "cool" ? storedTemperature : null;
  if (mode && mode !== "cool" && bytes[7] !== 0x08) {
    notes.push(
      `Dry and fan frames in this set store 0x08 (24°C) in the temperature byte. This one stores 0x${hex(bytes[7])}.`,
    );
  }

  const fanField = decodeFanByte(bytes[9] ?? 0, mode, temperature);
  notes.push(...fanField.notes);

  if (mode && bytes[8] !== undefined && bytes[8] !== VANE_BYTE[mode]) {
    notes.push(
      `Vane byte is 0x${hex(bytes[8])}. This remote uses 0x${hex(VANE_BYTE[mode])} for ${MODE_LABEL[mode].toLowerCase()}.`,
    );
  }

  for (let index = 11; index <= 16; index += 1) {
    if (bytes[index]) {
      notes.push(`Byte ${index} is 0x${hex(bytes[index])}. These captures leave bytes 11–16 at zero.`);
      break;
    }
  }

  return {
    bytes,
    checksumOk,
    headerOk,
    power,
    mode,
    temperature,
    storedTemperature,
    fan: fanField.fan,
    limitFlag: fanField.limitFlag,
    clockMinutes: (bytes[10] ?? 0) * 6,
    notes,
  };
}

function decodeFanByte(
  fanByte: number,
  mode: Mode | null,
  temperature: number | null,
): { fan: Fan | null; limitFlag: boolean; notes: string[] } {
  const notes: string[] = [];
  let raw = fanByte;
  let limitFlag = false;
  if (raw >= 0xb8 && raw <= 0xbd) {
    raw = (raw - 0x40) & 0xff;
    limitFlag = true;
  }
  const fan = FAN_BY_BITS[raw & 0x07] ?? null;
  if ((raw & 0xf8) !== 0x78) {
    notes.push(
      `Fan byte 0x${hex(fanByte)} does not use the swing vane pattern (0x78 plus a speed of 0–5).`,
    );
  } else if (!fan) {
    notes.push(`Fan nibble 0x${(raw & 0x07).toString(16)} is not a known speed.`);
  }
  if (limitFlag) {
    const expected =
      (mode === "cool" && (temperature === MIN_TEMP || temperature === MAX_TEMP)) ||
      ((mode === "dry" || mode === "fan_only") && fan === "auto");
    if (!expected) {
      notes.push("The extra fan-byte flag is set in a combination these captures do not use.");
    }
  }
  return { fan, limitFlag, notes };
}

export function hex(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function formatBytes(bytes: number[]): string {
  return bytes.map(hex).join(" ");
}

export type ByteNote = {
  index: number;
  label: string;
  text: string;
};

export function explainBytes(parsed: ParsedFrame): ByteNote[] {
  const bytes = parsed.bytes;
  const mode = parsed.mode;
  const notes: ByteNote[] = HEADER.map((_, index) => ({
    index,
    label: "Preamble",
    text: "Fixed leader 23 CB 26 01 00 on every MSXY-FP frame.",
  }));

  notes.push({
    index: 5,
    label: "Power",
    text:
      parsed.power === true
        ? "On. Bit 5 set (0x20)."
        : parsed.power === false
          ? "Off. The rest of the frame still describes a mode."
          : `Unrecognized power byte 0x${hex(bytes[5] ?? 0)}.`,
  });

  notes.push({
    index: 6,
    label: "Mode",
    text:
      mode === "cool"
        ? "Cool (0x18)."
        : mode === "dry"
          ? "Dry (0x10)."
          : mode === "fan_only"
            ? "Fan only (0x38)."
            : `Unrecognized mode byte 0x${hex(bytes[6] ?? 0)}.`,
  });

  notes.push({
    index: 7,
    label: "Temperature",
    text:
      mode === "cool" && parsed.temperature !== null
        ? `${parsed.temperature}°C, stored as degrees minus 16 (0x${hex(bytes[7] ?? 0)}).`
        : mode === "cool"
          ? `Temperature byte 0x${hex(bytes[7] ?? 0)} is outside 16–31°C.`
          : "Not a setpoint in dry or fan. These captures write 0x08, which is 24°C.",
  });

  notes.push({
    index: 8,
    label: "Vane",
    text: mode
      ? `Constant for ${MODE_LABEL[mode].toLowerCase()} in this code set (0x${hex(VANE_BYTE[mode])}). The high nibble stays 0x3; the low nibble changes with the mode. These captures do not include a separate swing command.`
      : `Byte 0x${hex(bytes[8] ?? 0)}.`,
  });

  const flagText = parsed.limitFlag
    ? mode === "cool"
      ? " The upper nibble is 0xB because cool is at 16°C or 31°C."
      : " The upper nibble is 0xB because auto fan in dry or fan-only uses that form."
    : " The upper nibble is 0x7.";
  notes.push({
    index: 9,
    label: "Fan",
    text: parsed.fan
      ? `${FAN_LABEL[parsed.fan]} fan. The low 3 bits are the speed (0 auto, 1 low, 2 mid, 3 high, 4 highest, 5 quiet).${flagText}`
      : `Unrecognized fan byte 0x${hex(bytes[9] ?? 0)}.`,
  });

  notes.push({
    index: 10,
    label: "Clock",
    text: `Remote clock ${formatClock(parsed.clockMinutes)}. Stored as minutes divided by 6 (0x${hex(bytes[10] ?? 0)}). It does not change the climate command.`,
  });

  for (let index = 11; index <= 16; index += 1) {
    notes.push({
      index,
      label: "Unused",
      text: "Zero on this model. Other Mitsubishi frames use these bytes for timers.",
    });
  }

  notes.push({
    index: 17,
    label: "Checksum",
    text: parsed.checksumOk
      ? `0x${hex(bytes[17] ?? 0)}, the low byte of the sum of bytes 0–16.`
      : `0x${hex(bytes[17] ?? 0)} does not match the calculated sum 0x${hex(checksumOf(bytes))}.`,
  });

  return notes;
}

export function describeState(parsed: ParsedFrame): string {
  if (!parsed.headerOk || parsed.power === null || !parsed.mode || !parsed.fan) {
    return "This frame does not match the MSXY-FP layout.";
  }
  const power = parsed.power ? "Power on" : "Power off";
  const mode = MODE_LABEL[parsed.mode];
  const fan = `${FAN_LABEL[parsed.fan]} fan`;
  if (parsed.mode === "cool" && parsed.temperature !== null) {
    return `${power}, ${mode.toLowerCase()}, ${parsed.temperature}°C, ${fan.toLowerCase()}.`;
  }
  return `${power}, ${mode.toLowerCase()}, ${fan.toLowerCase()}. Temperature is not sent in this mode.`;
}

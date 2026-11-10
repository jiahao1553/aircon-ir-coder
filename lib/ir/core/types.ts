export type Mode = "auto" | "cool" | "heat" | "dry" | "fan_only";

export type Fan =
  | "auto"
  | "quiet"
  | "min"
  | "low"
  | "medium"
  | "medium_high"
  | "high"
  | "max"
  | "turbo";

export type SwingV =
  | "off"
  | "auto"
  | "swing"
  | "highest"
  | "high"
  | "upper_middle"
  | "middle"
  | "low"
  | "lowest";

export type SwingH =
  | "off"
  | "auto"
  | "swing"
  | "left_max"
  | "left"
  | "middle"
  | "right"
  | "right_max"
  | "wide";

export type Feature = "turbo" | "quiet" | "econo" | "light" | "clean" | "sleep" | "beep";

/** Brand-neutral A/C state, the same shape every protocol encodes from and decodes to. */
export interface ClimateState {
  power: boolean;
  mode: Mode;
  /** Celsius. */
  temp: number;
  fan: Fan;
  swingV: SwingV;
  swingH: SwingH;
  turbo?: boolean;
  quiet?: boolean;
  econo?: boolean;
  light?: boolean;
  clean?: boolean;
  sleep?: boolean;
  beep?: boolean;
}

export interface Capabilities {
  modes: Mode[];
  fans: Fan[];
  swingV: SwingV[];
  swingH: SwingH[];
  temp: { min: number; max: number; step: 0.5 | 1 };
  features: Feature[];
}

/** A known remote-to-remote difference inside one protocol, offered to the user as a "try this next" option. */
export interface Variant {
  id: string;
  label: string;
  note: string;
}

export interface AcProtocol {
  /** Stable id, matches the file name in `lib/ir/protocols/`. */
  id: string;
  name: string;
  /** Carrier frequency in Hz. */
  frequency: number;
  /** Payload length in bits. */
  bits: number;
  /** Where the frame layout was documented. */
  source: string;
  capabilities: Capabilities;
  variants?: Variant[];
  /**
   * The remote has no absolute on/off, only a power-toggle flag. `build` with `power: false` returns
   * the toggle frame, which the SmartIR builder writes as both `on` and `off`.
   */
  powerToggle?: boolean;
  /** State to payload bytes (checksum included). */
  build(state: ClimateState, variant?: string): Uint8Array;
  /** Payload bytes to state. */
  parse(bytes: Uint8Array): Partial<ClimateState>;
  /** Payload bytes to alternating mark/space durations in µs, starting with a mark. */
  modulate(bytes: Uint8Array): number[];
  /** Durations back to payload bytes, or null if the timing or checksum doesn't match. */
  demodulate(pulses: number[]): Uint8Array | null;
}

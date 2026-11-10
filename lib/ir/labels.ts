import type { Feature, Fan, Mode, SwingH, SwingV } from "./core/types";

export const MODE_LABEL: Record<Mode, string> = {
  auto: "Auto",
  cool: "Cool",
  heat: "Heat",
  dry: "Dry",
  fan_only: "Fan",
};

export const FAN_LABEL: Record<Fan, string> = {
  auto: "Auto",
  quiet: "Quiet",
  min: "Min",
  low: "Low",
  medium: "Medium",
  medium_high: "Med-high",
  high: "High",
  max: "Max",
  turbo: "Turbo",
};

export const SWING_V_LABEL: Record<SwingV, string> = {
  off: "Off",
  auto: "Auto",
  swing: "Swing",
  highest: "Highest",
  high: "High",
  upper_middle: "Upper mid",
  middle: "Middle",
  low: "Low",
  lowest: "Lowest",
};

export const SWING_H_LABEL: Record<SwingH, string> = {
  off: "Off",
  auto: "Auto",
  swing: "Swing",
  left_max: "Far left",
  left: "Left",
  middle: "Middle",
  right: "Right",
  right_max: "Far right",
  wide: "Wide",
};

export const FEATURE_LABEL: Record<Feature, string> = {
  turbo: "Turbo",
  quiet: "Quiet",
  econo: "Econo",
  light: "Display light",
  clean: "Clean",
  sleep: "Sleep",
  beep: "Beep",
};

export const MODES = Object.keys(MODE_LABEL) as Mode[];
export const FANS = Object.keys(FAN_LABEL) as Fan[];
export const SWING_V = Object.keys(SWING_V_LABEL) as SwingV[];
export const SWING_H = Object.keys(SWING_H_LABEL) as SwingH[];
export const FEATURES = Object.keys(FEATURE_LABEL) as Feature[];

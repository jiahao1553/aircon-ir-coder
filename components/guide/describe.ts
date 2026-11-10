import type { ClimateState } from "@/lib/ir";
import { FAN_LABEL, MODE_LABEL, SWING_H_LABEL, SWING_V_LABEL } from "@/lib/ir/labels";

export function describe(s: Partial<ClimateState>) {
  const parts = [
    s.power === undefined ? null : s.power ? "On" : "Off",
    s.mode ? MODE_LABEL[s.mode] : null,
    s.temp !== undefined ? `${s.temp}°C` : null,
    s.fan ? `${FAN_LABEL[s.fan]} fan` : null,
    s.swingV ? `vane ${SWING_V_LABEL[s.swingV].toLowerCase()}` : null,
    s.swingH && s.swingH !== "off" ? `wide vane ${SWING_H_LABEL[s.swingH].toLowerCase()}` : null,
  ];
  return parts.filter(Boolean).join(", ");
}

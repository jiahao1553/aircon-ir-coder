"use client";

import type { ClimateState, Mode, SwingV } from "@/lib/ir";
import { MODE_LABEL, SWING_H_LABEL, SWING_V_LABEL } from "@/lib/ir/labels";
import { describe } from "./describe";
import { SevenSeg } from "./hardware";

const VANE_ANGLE: Record<SwingV, number> = {
  off: 10,
  auto: 30,
  swing: 30,
  highest: 0,
  high: 15,
  upper_middle: 25,
  middle: 35,
  low: 48,
  lowest: 60,
};

const AIR: Record<Mode, string> = {
  auto: "#7fd3a8",
  cool: "#6fc3ff",
  heat: "#ffa25c",
  dry: "#7fd6d0",
  fan_only: "#d8d8d8",
};

export function AcUnit({ state }: { state: ClimateState }) {
  const on = state.power;
  const air = AIR[state.mode];

  return (
    <div className="flex flex-col gap-4">
      <div className="chassis relative overflow-hidden p-5 pb-0">
        <div className="flex items-start justify-between">
          <span className="engraved text-[9px]">Indoor unit</span>
          <div className="flex items-center gap-2 rounded-md bg-[#141a1f] px-3 py-2 shadow-[inset_0_2px_6px_rgb(0_0_0/0.7)]">
            <span className="led" data-on={on} aria-label={on ? "Running" : "Standby"} />
            <SevenSeg
              text={on ? String(Math.trunc(state.temp)).padStart(2, " ") : "--"}
              className={`text-2xl ${on ? "text-[#5ec8ff] drop-shadow-[0_0_6px_#5ec8ffaa]" : "text-[#5ec8ff]/40"}`}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          ))}
        </div>

        <div className="relative mt-6 h-16 rounded-t-md bg-[#2b2a27] shadow-[inset_0_4px_8px_rgb(0_0_0/0.7)]">
          {on ? (
            <span
              aria-hidden
              className="absolute inset-x-6 top-3 h-10 animate-pulse rounded-full blur-xl"
              style={{ background: air, opacity: 0.65 }}
            />
          ) : null}
          <span
            aria-hidden
            className={`absolute inset-x-3 top-2 h-3 origin-top rounded-sm bg-gradient-to-b from-white to-[#d5d0c6] shadow-[0_2px_3px_rgb(0_0_0/0.4)] transition-transform duration-500 ${
              on && state.swingV === "swing" ? "animate-[vane_2.4s_ease-in-out_infinite]" : ""
            }`}
            style={{ transform: `perspective(120px) rotateX(-${on ? VANE_ANGLE[state.swingV] : 0}deg)` }}
          />
        </div>
      </div>

      <div className="well grid grid-cols-3 gap-px overflow-hidden p-0 text-center">
        {[
          ["Mode", MODE_LABEL[state.mode]],
          ["Vane", SWING_V_LABEL[state.swingV]],
          ["Wide vane", SWING_H_LABEL[state.swingH]],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#f3efe7] px-2 py-2.5">
            <p className="engraved text-[8px]">{k}</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#974800]">{v}</p>
          </div>
        ))}
      </div>
      <p className="px-1 text-xs leading-relaxed text-[#5f5a52]">{describe(state)}.</p>
    </div>
  );
}

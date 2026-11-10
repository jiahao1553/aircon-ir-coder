"use client";

import { ArrowLeftRight, ArrowUpDown, ChevronDown, ChevronUp, Droplets, Fan as FanIcon, Power, Snowflake, Sun, type LucideIcon } from "lucide-react";
import type { ClimateState, Fan, Feature, Mode } from "@/lib/ir";
import { FAN_LABEL, FEATURES, MODES, SWING_H_LABEL, SWING_V_LABEL } from "@/lib/ir/labels";
import { Key, SevenSeg } from "./hardware";
import type { Trial } from "./identify";

const MODE_ICON: Record<Mode, LucideIcon | "A"> = { auto: "A", cool: Snowflake, heat: Sun, dry: Droplets, fan_only: FanIcon };

const FAN_BARS: Record<Fan, number> = { auto: 0, quiet: 1, min: 1, low: 2, medium: 3, medium_high: 4, high: 4, max: 5, turbo: 5 };

const FEATURE_KEY: Record<Feature, string> = {
  turbo: "Turbo",
  quiet: "Quiet",
  econo: "Eco",
  light: "Light",
  clean: "Clean",
  sleep: "Sleep",
  beep: "Beep",
};

const next = <T,>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

export function Remote({ trial, state, onState }: { trial: Trial; state: ClimateState; onState: (s: ClimateState) => void }) {
  const p = trial.protocol;
  const c = p.capabilities;
  const patch = (n: Partial<ClimateState>) => onState({ ...state, ...n });
  const whole = Math.trunc(state.temp);
  const half = state.temp !== whole;
  const ModeIcon = MODE_ICON[state.mode];

  return (
    <div className="chassis relative mx-auto flex w-[19rem] flex-col items-center gap-5 rounded-[2.2rem] px-6 pt-10 pb-8">
      <span aria-hidden className="absolute -top-3 h-6 w-24 rounded-t-[1.2rem] bg-gradient-to-b from-[#7a1a14] to-[#3c0c09] shadow-[inset_0_2px_3px_rgb(255_255_255/0.25)]" />
      <p className="engraved max-w-full truncate text-[9px]">{p.name}</p>

      <div className="lcd w-full px-4 py-3" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {MODES.map((m) => {
              const Icon = MODE_ICON[m];
              const cls = !c.modes.includes(m) ? "opacity-0" : state.mode === m ? "" : "lcd-ghost";
              return Icon === "A" ? (
                <span key={m} className={`font-mono text-sm leading-none font-bold ${cls}`}>
                  A
                </span>
              ) : (
                <Icon key={m} className={`size-4 ${cls}`} strokeWidth={2.5} />
              );
            })}
          </div>
          <span className="lcd-tag" data-on={!state.power}>
            OFF
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between">
          <div className="flex items-start">
            <SevenSeg text={String(whole).padStart(2, " ")} className="text-[3.4rem]" />
            <div className="ml-1 flex flex-col items-start pt-1">
              <span className="font-mono text-lg leading-none font-bold">°C</span>
              <span className={`mt-1 font-mono text-sm leading-none font-bold ${half ? "" : "lcd-ghost"}`}>.5</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex h-6 items-end gap-0.5" aria-label={`Fan ${FAN_LABEL[state.fan]}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`w-1.5 bg-current ${n <= FAN_BARS[state.fan] ? "" : "lcd-ghost"}`} style={{ height: `${n * 20}%` }} />
              ))}
            </div>
            <span className="font-mono text-[9px] font-bold uppercase">{state.fan === "auto" ? "Fan auto" : FAN_LABEL[state.fan]}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-black/15 pt-1.5 font-mono text-[9px] font-bold uppercase">
          <span className={c.swingV.length > 1 ? "" : "lcd-ghost"}>
            <ArrowUpDown className="mr-0.5 inline size-3" />
            {SWING_V_LABEL[state.swingV]}
          </span>
          <span className={c.swingH.length > 1 ? "" : "lcd-ghost"}>
            <ArrowLeftRight className="mr-0.5 inline size-3" />
            {SWING_H_LABEL[state.swingH]}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {FEATURES.filter((f) => c.features.includes(f)).map((f) => (
            <span key={f} className="lcd-tag uppercase" data-on={!!state[f]}>
              {FEATURE_KEY[f]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <div className="flex flex-col items-center gap-1.5">
          <Key tone="red" className="size-16 rounded-full" aria-label="Power" aria-pressed={state.power} onClick={() => patch({ power: !state.power })}>
            <Power className="size-6" strokeWidth={2.5} />
          </Key>
          <span className="engraved text-[9px]">{p.powerToggle ? "Power toggle" : "Power"}</span>
        </div>
        <div className="well flex gap-1.5 p-1.5">
          <Key className="h-16 w-16" label="Temp" aria-label="Raise temperature" title={`${c.temp.min}–${c.temp.max}°C`} disabled={state.temp >= c.temp.max} onClick={() => patch({ temp: state.temp + c.temp.step })}>
            <ChevronUp className="size-5" />
          </Key>
          <Key className="h-16 w-16" label="Temp" aria-label="Lower temperature" title={`${c.temp.min}–${c.temp.max}°C`} disabled={state.temp <= c.temp.min} onClick={() => patch({ temp: state.temp - c.temp.step })}>
            <ChevronDown className="size-5" />
          </Key>
        </div>
      </div>

      <div className="grid w-full grid-cols-4 gap-2">
        <Key className="h-14" label="Mode" disabled={c.modes.length < 2} onClick={() => patch({ mode: next(c.modes, state.mode) })}>
          {ModeIcon === "A" ? <span className="font-mono text-sm leading-4 font-bold">A</span> : <ModeIcon className="size-4" />}
        </Key>
        <Key className="h-14" label="Fan" disabled={c.fans.length < 2} onClick={() => patch({ fan: next(c.fans, state.fan) })}>
          <FanIcon className="size-4" />
        </Key>
        <Key className="h-14" label="Swing" aria-label="Vertical vane" disabled={c.swingV.length < 2} onClick={() => patch({ swingV: next(c.swingV, state.swingV) })}>
          <ArrowUpDown className="size-4" />
        </Key>
        <Key className="h-14" label="Wide" aria-label="Horizontal vane" disabled={c.swingH.length < 2} onClick={() => patch({ swingH: next(c.swingH, state.swingH) })}>
          <ArrowLeftRight className="size-4" />
        </Key>
      </div>

      <div className="grid w-full grid-cols-4 gap-2">
        {FEATURES.map((f) => (
          <Key
            key={f}
            className="h-9"
            label={FEATURE_KEY[f]}
            disabled={!c.features.includes(f)}
            aria-pressed={c.features.includes(f) && !!state[f]}
            onClick={() => patch({ [f]: !state[f] } as Partial<ClimateState>)}
          />
        ))}
        <span className="flex items-center justify-center">
          <span className="h-1.5 w-12 rounded-full bg-[#cfc8bc] shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]" />
        </span>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, ArrowUpDown, Droplets, Fan as FanIcon, Snowflake, Sun, type LucideIcon } from "lucide-react";
import type { Fan, Mode, SwingH, SwingV } from "@/lib/ir";
import { FAN_LABEL, FANS, MODE_LABEL, MODES } from "@/lib/ir/labels";
import { Key } from "./hardware";

const MODE_ICON: Record<Exclude<Mode, "auto">, LucideIcon> = {
  cool: Snowflake,
  heat: Sun,
  dry: Droplets,
  fan_only: FanIcon,
};

const FAN_BARS: Record<Exclude<Fan, "auto">, number> = {
  quiet: 1,
  min: 2,
  low: 3,
  medium: 4,
  medium_high: 5,
  high: 6,
  max: 7,
  turbo: 8,
};

const V_RAYS: { id: SwingV; label: string; deg: number }[] = [
  { id: "highest", label: "Highest", deg: -75 },
  { id: "high", label: "High", deg: -45 },
  { id: "upper_middle", label: "Upper", deg: -15 },
  { id: "middle", label: "Middle", deg: 15 },
  { id: "low", label: "Low", deg: 45 },
  { id: "lowest", label: "Lowest", deg: 75 },
];

const H_RAYS: { id: SwingH; label: string; deg: number; twin?: boolean }[] = [
  { id: "left_max", label: "Far left", deg: -68 },
  { id: "left", label: "Left", deg: -34 },
  { id: "middle", label: "Middle", deg: 0 },
  { id: "right", label: "Right", deg: 34 },
  { id: "right_max", label: "Far right", deg: 68 },
  { id: "wide", label: "Wide", deg: 80, twin: true },
];

export function ModePicks({
  selected,
  enabled,
  onToggle,
}: {
  selected: readonly Mode[];
  enabled: readonly Mode[];
  onToggle: (mode: Mode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="engraved">Modes</span>
      <div className="well flex flex-wrap gap-1.5 p-1.5">
        <Key
          className="h-14 w-14"
          label="Auto"
          disabled={!enabled.includes("auto")}
          aria-pressed={enabled.includes("auto") && selected.includes("auto")}
          onClick={() => onToggle("auto")}
        >
          <span className="font-mono text-sm leading-none font-bold">A</span>
        </Key>
        {MODES.filter((m): m is Exclude<Mode, "auto"> => m !== "auto").map((m) => {
            const Icon = MODE_ICON[m];
            const allowed = enabled.includes(m);
            return (
              <Key
                key={m}
                className="h-14 w-14"
                label={MODE_LABEL[m]}
                disabled={!allowed}
                aria-pressed={allowed && selected.includes(m)}
                onClick={() => onToggle(m)}
              >
                <Icon className="size-5" />
            </Key>
          );
        })}
      </div>
    </div>
  );
}

export function FanPicks({
  selected,
  enabled,
  onToggle,
}: {
  selected: readonly Fan[];
  enabled: readonly Fan[];
  onToggle: (fan: Fan) => void;
}) {
  const speeds = FANS.filter((f): f is Exclude<Fan, "auto"> => f !== "auto");
  return (
    <div className="flex flex-col gap-2">
      <span className="engraved">Fan speeds</span>
      <div className="well grid grid-cols-9 gap-x-1 p-2">
        <button
          type="button"
          disabled={!enabled.includes("auto")}
          aria-pressed={enabled.includes("auto") && selected.includes("auto")}
          aria-label="Auto"
          title={enabled.includes("auto") ? undefined : "Not available on this protocol"}
          onClick={() => onToggle("auto")}
          className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
        >
          <span className={`flex h-12 items-center font-mono text-sm font-bold ${enabled.includes("auto") && selected.includes("auto") ? "text-[#12533e]" : enabled.includes("auto") ? "text-[#7d776e]" : "text-[#d9d3c8]"}`}>
            A
          </span>
          <span className={`text-center text-[8px] leading-tight font-bold tracking-wide uppercase ${enabled.includes("auto") ? "text-[#5f5a52]" : "text-[#c4beb4]"}`}>
            Auto
          </span>
        </button>
        {speeds.map((f) => {
            const allowed = enabled.includes(f);
            const on = allowed && selected.includes(f);
            const bars = FAN_BARS[f];
            return (
              <button
                key={f}
                type="button"
                disabled={!allowed}
                aria-pressed={on}
                aria-label={FAN_LABEL[f]}
                title={allowed ? undefined : "Not available on this protocol"}
                onClick={() => onToggle(f)}
                className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
              >
                <span className="flex h-12 items-end gap-[2px]" aria-hidden>
                  {Array.from({ length: bars }, (_, i) => (
                    <span
                      key={i}
                      className={`w-[3px] rounded-sm ${on ? "bg-[#12533e]" : allowed ? "bg-[#7d776e]" : "bg-[#d9d3c8]"}`}
                      style={{ height: `${6 + i * 5}px` }}
                    />
                  ))}
                </span>
                <span className={`text-center text-[8px] leading-tight font-bold tracking-wide uppercase ${allowed ? "text-[#5f5a52]" : "text-[#c4beb4]"}`}>
                  {FAN_LABEL[f]}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

const CX = 10;
const CY = 80;
const R0 = 6;
const R1 = 64;

/** Vertical fan opens to the right. Wide fan hangs from the top: 0° is down, negative is left, positive is right. */
function rayEnds(deg: number, radius: number, wide: boolean) {
  const a = (deg * Math.PI) / 180;
  if (wide) return { x: 100 + radius * Math.sin(a), y: 12 + radius * Math.cos(a) };
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

export function VanePicks({
  horizontal,
  both,
  selected,
  enabled,
  onDirection,
  onToggle,
}: {
  horizontal: boolean;
  both: boolean;
  selected: readonly string[];
  enabled: readonly string[];
  onDirection: (horizontal: boolean) => void;
  onToggle: (id: string) => void;
}) {
  const rays = horizontal ? H_RAYS : V_RAYS;
  const title = horizontal ? "Wide vane" : "Vane positions";
  const mark = (id: "auto" | "swing", label: string, icon: ReactNode) => {
    const allowed = enabled.includes(id);
    return (
      <Key className="h-14 w-14" label={label} disabled={!allowed} aria-pressed={allowed && selected.includes(id)} onClick={() => onToggle(id)}>
        {icon}
      </Key>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="engraved">{title}</span>
        {both ? (
          <div className="well flex p-0.5" role="radiogroup" aria-label="Vane direction">
            {(
              [
                [false, "Vertical vane", <ArrowUpDown key="v" className="size-3.5" />],
                [true, "Wide vane", <ArrowLeftRight key="h" className="size-3.5" />],
              ] as const
            ).map(([wide, label, icon]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-label={label}
                aria-checked={horizontal === wide}
                onClick={() => onDirection(wide)}
                className={`flex size-7 items-center justify-center rounded ${horizontal === wide ? "key-green" : "text-[#5f5a52]"}`}
              >
                {icon}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {mark("auto", "Auto", <span className="font-mono text-sm leading-none font-bold">A</span>)}
          {mark("swing", "Swing", horizontal ? <ArrowLeftRight className="size-4" /> : <ArrowUpDown className="size-4" />)}
        </div>
        <svg viewBox={horizontal ? "0 0 200 96" : "0 -8 136 176"} className={`${horizontal ? "h-24" : "h-40"} w-full min-w-0`} role="group" aria-label={title}>
          {rays.map((ray) => {
            const allowed = enabled.includes(ray.id);
            const on = allowed && selected.includes(ray.id);
            const degs = "twin" in ray && ray.twin ? [ray.deg, -ray.deg] : [ray.deg];
            const reach = horizontal ? 50 : R1;
            const tip = rayEnds(ray.deg, reach + (horizontal ? 16 : 12), horizontal);
            const colour = on ? "#12533e" : allowed ? "#6f6a62" : "#d5d0c6";
            return (
              <g
                key={ray.id}
                role="button"
                tabIndex={allowed ? 0 : -1}
                aria-pressed={on}
                aria-label={ray.label}
                aria-disabled={!allowed}
                className={allowed ? "cursor-pointer" : "cursor-not-allowed"}
                onClick={() => allowed && onToggle(ray.id)}
                onKeyDown={(e) => {
                  if (allowed && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onToggle(ray.id);
                  }
                }}
              >
                <title>{allowed ? ray.label : `${ray.label} — not available on this protocol`}</title>
                {degs.map((deg) => {
                  const a = rayEnds(deg, R0, horizontal);
                  const b = rayEnds(deg, reach, horizontal);
                  return (
                    <g key={deg}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={18} strokeLinecap="round" />
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour} strokeWidth={on ? 9 : 7} strokeLinecap="round" />
                    </g>
                  );
                })}
                <text
                  x={tip.x}
                  y={tip.y}
                  textAnchor={horizontal ? (ray.deg < -15 ? "end" : ray.deg > 15 ? "start" : "middle") : "middle"}
                  dominantBaseline="middle"
                  fill={allowed ? "#5f5a52" : "#c4beb4"}
                  fontSize="7"
                  fontWeight="700"
                >
                  {ray.label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

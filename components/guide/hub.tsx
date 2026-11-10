"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Cpu, Disc3, Download, Network, Radio, Router, Smartphone, Zap, type LucideIcon } from "lucide-react";
import { encodeState, type ClimateState } from "@/lib/ir";
import { CODECS, CONTROLLERS } from "@/lib/ir/formats";
import { flipperSamples } from "@/lib/ir/smartir";
import { encodeFlipper } from "@/lib/ir/transports/flipper";
import { download, slug } from "./controls";
import { Key } from "./hardware";
import type { Trial } from "./identify";

const ICON: Record<string, LucideIcon> = {
  Broadlink: Radio,
  UFOR11: Disc3,
  MQTT: Network,
  ZHA: Zap,
  ESPHome: Cpu,
  Xiaomi: Smartphone,
  LOOKin: Router,
};

export type Output = { controller: string; option: number };

export function Hub({
  trial,
  state,
  output,
  onOutput,
}: {
  trial: Trial;
  state: ClimateState;
  output: Output;
  onOutput: (o: Output) => void;
}) {
  const { protocol: p, variant } = trial;
  const ctrl = CONTROLLERS.find((x) => x.id === output.controller) ?? CONTROLLERS[0];
  const opt = ctrl.options[Math.min(output.option, ctrl.options.length - 1)];
  const [copied, setCopied] = useState(false);

  const pulses = useMemo(() => encodeState(p, state, variant), [p, state, variant]);
  const code = useMemo(() => CODECS[opt.codec].encode(pulses, p.frequency), [opt.codec, pulses, p.frequency]);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function downloadFlipper() {
    const text = encodeFlipper(flipperSamples(p, state, variant));
    download(`${slug(p.id + (variant ? `-${variant}` : ""))}.ir`, text, "text/plain");
  }

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
        {CONTROLLERS.map((x) => {
          const Icon = ICON[x.id] ?? Radio;
          const on = x.id === ctrl.id;
          const encodings = x.options.map((o) => o.encoding).join(", ");
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              title={encodings}
              onClick={() => onOutput({ controller: x.id, option: 0 })}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-shadow ${
                on
                  ? "bg-gradient-to-b from-[#26302c] to-[#141a17] text-white shadow-[0_0_0_2px_#00b0ff,0_0_14px_#00b0ff55]"
                  : "chassis text-[#3a3730]"
              }`}
            >
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${on ? "bg-black/40 text-[#4fc3ff]" : "well text-[#5f5a52]"}`}>
                <Icon className="size-3.5" />
              </span>
              <span className="truncate text-[11px] leading-tight font-bold">{x.label.replace(/ \(.*\)$/, "")}</span>
            </button>
          );
        })}
      </div>

      {ctrl.options.length > 1 ? (
        <div className="flex items-center gap-3 px-1">
          <span className="engraved">Encoding</span>
          <div className="well relative flex p-1" role="radiogroup" aria-label="Encoding">
            {ctrl.options.map((o, i) => (
              <button
                key={o.encoding}
                type="button"
                role="radio"
                aria-checked={o === opt}
                onClick={() => onOutput({ controller: ctrl.id, option: i })}
                className={`rounded-md px-3 py-1 font-mono text-[11px] font-bold transition-all ${
                  o === opt ? "key-green shadow-md" : "text-[#5f5a52]"
                }`}
              >
                {o.encoding}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="chassis flex min-h-48 flex-1 flex-col p-2.5 lg:min-h-0">
        <div className="h-2 shrink-0 rounded-full bg-[#1d1b16] shadow-[inset_0_2px_3px_rgb(0_0_0/0.8)]" aria-hidden />
        <div className="mx-2 flex min-h-0 flex-1 flex-col">
          <div className="tape flex max-h-72 min-h-0 flex-1 flex-col gap-2 overflow-auto px-4 pt-4 pb-3 text-[11px] leading-snug lg:max-h-none">
            <p className="font-bold">
              {ctrl.label.toUpperCase()} · {opt.encoding.toUpperCase()}
            </p>
            <p className="rounded-sm bg-black/[0.04] p-1.5 break-all">{code}</p>
          </div>
          <div className="tape-edge shrink-0" aria-hidden />
        </div>

        <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2">
          <Key className="h-10 flex-row gap-2 text-xs font-bold" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy code"}
          </Key>
          <Key
            className="h-10 flex-row gap-2 text-xs font-bold"
            onClick={downloadFlipper}
            title="Off, this command, and cool, heat and dry probes. Copy to SD/infrared/ on the Flipper."
          >
            <Download className="size-4" />
            Flipper .ir
          </Key>
        </div>
      </div>
    </div>
  );
}

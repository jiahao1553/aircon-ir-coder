"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { encodeState, type ClimateState } from "@/lib/ir";
import { CODECS, CONTROLLERS } from "@/lib/ir/formats";
import { flipperSamples } from "@/lib/ir/smartir";
import { encodeFlipper } from "@/lib/ir/transports/flipper";
import { download, slug } from "./controls";
import { BroadlinkMark, EsphomeMark, FlipperMark, LookinMark, MqttMark, TuyaMark, XiaomiMark, ZigbeeMark } from "./marks";
import type { Trial } from "./identify";

const MARK = {
  Broadlink: BroadlinkMark,
  UFOR11: TuyaMark,
  MQTT: MqttMark,
  ZHA: ZigbeeMark,
  ESPHome: EsphomeMark,
  Xiaomi: XiaomiMark,
  LOOKin: LookinMark,
  Flipper: FlipperMark,
} as const;

export const FLIPPER = "Flipper";

export type Output = { controller: string; option: number };

const iconButton = "flex size-6 items-center justify-center rounded text-[#5f5a52] hover:bg-black/10";

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
  const flipper = output.controller === FLIPPER;
  const ctrl = CONTROLLERS.find((x) => x.id === output.controller) ?? CONTROLLERS[0];
  const opt = ctrl.options[Math.min(output.option, ctrl.options.length - 1)];
  const [copied, setCopied] = useState(false);

  const pulses = useMemo(() => encodeState(p, state, variant), [p, state, variant]);
  const code = useMemo(
    () => (flipper ? encodeFlipper(flipperSamples(p, state, variant)) : CODECS[opt.codec].encode(pulses, p.frequency)),
    [flipper, opt.codec, p, pulses, state, variant],
  );

  const tiles = [
    ...CONTROLLERS.map((x) => ({ id: x.id, label: x.label.replace(/ \(.*\)$/, "") })),
    { id: FLIPPER, label: "Flipper" },
  ];

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
        {tiles.map((x) => {
          const Icon = MARK[x.id as keyof typeof MARK];
          const on = x.id === output.controller;
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => onOutput({ controller: x.id, option: 0 })}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-[transform,box-shadow] ${
                on
                  ? "translate-y-0.5 bg-gradient-to-b from-[#e9e5dc] to-[#dcd5c9] text-[#12533e] shadow-[inset_0_2px_4px_rgb(0_0_0/0.18),0_1px_0_#bdb5a8,0_1px_2px_rgb(0_0_0/0.25)]"
                  : "chassis text-[#3a3730]"
              }`}
            >
              <span className="flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                <Icon />
              </span>
              <span className="truncate text-[11px] leading-tight font-bold">{x.label}</span>
            </button>
          );
        })}
      </div>

      {!flipper && ctrl.options.length > 1 ? (
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
          <div className="tape flex max-h-72 min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-3 text-[11px] leading-snug lg:max-h-none">
            <p className="mb-2 shrink-0 font-bold">{flipper ? "FLIPPER ZERO" : `${ctrl.label.toUpperCase()} · ${opt.encoding.toUpperCase()}`}</p>
            <div className="relative min-h-40 flex-1">
              <div className={`absolute inset-0 overflow-auto rounded-sm bg-black/[0.04] p-1.5 ${flipper ? "pr-14" : "pr-8"}`}>
                <p className={flipper ? "break-all whitespace-pre-wrap" : "break-all"}>{code}</p>
              </div>
              <div className="absolute top-1 right-1 z-10 flex">
                {flipper ? (
                  <button
                    type="button"
                    className={iconButton}
                    aria-label="Download Flipper .ir"
                    title="Save the .ir file. Copy it to SD/infrared/ on the Flipper."
                    onClick={downloadFlipper}
                  >
                    <Download className="size-3.5" />
                  </button>
                ) : null}
                <button type="button" className={iconButton} aria-label={copied ? "Copied" : "Copy code"} onClick={copy}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="tape-edge shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}

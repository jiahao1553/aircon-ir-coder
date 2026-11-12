"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Printer } from "lucide-react";
import type { ClimateState, Fan, Mode, SwingH, SwingV } from "@/lib/ir";
import { CONTROLLERS } from "@/lib/ir/formats";
import { buildSmartIr, commandCount, type SmartIrSpec } from "@/lib/ir/smartir";
import { download, slug } from "./controls";
import { Key, SevenSeg } from "./hardware";
import { FLIPPER, type Output } from "./hub";
import type { Trial } from "./identify";
import { FanPicks, ModePicks, VanePicks } from "./picks";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function SmartIrBuilder({ trial, base, output }: { trial: Trial; base: ClimateState; output: Output }) {
  const c = trial.protocol.capabilities;
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const canV = c.swingV.length > 1;
  const canH = c.swingH.length > 1;
  const [modes, setModes] = useState<Mode[]>(c.modes.filter((m) => m !== "auto"));
  const [fans, setFans] = useState<Fan[]>(c.fans);
  const [horizontal, setHorizontal] = useState(!canV && canH);
  const [swingsV, setSwingsV] = useState<SwingV[]>([]);
  const [swingsH, setSwingsH] = useState<SwingH[]>([]);
  const [minTemp, setMinTemp] = useState(Math.max(c.temp.min, 16));
  const [maxTemp, setMaxTemp] = useState(Math.min(c.temp.max, 30));
  const [step, setStep] = useState<number>(1);

  const swingOn = horizontal ? swingsH.some((s) => c.swingH.includes(s)) : swingsV.some((s) => c.swingV.includes(s));
  const flipper = output.controller === FLIPPER;
  const ctrl = CONTROLLERS.find((x) => x.id === output.controller) ?? CONTROLLERS[0];
  const opt = ctrl.options[Math.min(output.option, ctrl.options.length - 1)];
  const spec: SmartIrSpec = {
    protocol: trial.protocol,
    variant: trial.variant,
    manufacturer: manufacturer.trim(),
    models: model.trim() ? [model.trim()] : [],
    controller: ctrl.id,
    encoding: opt.encoding,
    codec: opt.codec,
    modes: c.modes.filter((m) => modes.includes(m)),
    fans: c.fans.filter((f) => fans.includes(f)),
    swingAxis: swingOn ? (horizontal ? "h" : "v") : null,
    swings: horizontal ? c.swingH.filter((s) => swingsH.includes(s)) : c.swingV.filter((s) => swingsV.includes(s)),
    minTemp: Math.min(minTemp, maxTemp),
    maxTemp: Math.max(minTemp, maxTemp),
    step,
    base,
  };
  const count = commandCount(spec);
  const missing = [
    spec.manufacturer ? null : "manufacturer",
    spec.models.length ? null : "model",
    spec.modes.length ? null : "a mode",
    spec.fans.length ? null : "a fan speed",
    !spec.swingAxis || spec.swings.length ? null : "a vane position",
  ].filter(Boolean);

  function save() {
    const json = JSON.stringify(buildSmartIr(spec), null, 2);
    download(`${slug(manufacturer || trial.protocol.id)}-${slug(trial.protocol.id)}.json`, json + "\n");
  }

  const tempDial = (label: string, value: number, set: (n: number) => void) => (
    <div className="flex flex-col gap-2">
      <span className="engraved">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="lcd px-2.5 py-1.5">
          <SevenSeg text={String(value).padStart(2, " ")} className="text-2xl" />
        </div>
        <div className="flex flex-col gap-1">
          <Key className="h-6 w-8" aria-label={`Raise ${label}`} title={`${c.temp.min}–${c.temp.max}°C`} disabled={value >= c.temp.max} onClick={() => set(value + 1)}>
            <ChevronUp className="size-3.5" />
          </Key>
          <Key className="h-6 w-8" aria-label={`Lower ${label}`} title={`${c.temp.min}–${c.temp.max}°C`} disabled={value <= c.temp.min} onClick={() => set(value - 1)}>
            <ChevronDown className="size-3.5" />
          </Key>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Manufacturer", manufacturer, setManufacturer, "Mitsubishi Electric"],
          ["Model", model, setModel, "MSXY-FP18VG"],
        ].map(([label, value, set, placeholder]) => (
          <label key={label as string} className="metal relative flex flex-col gap-1.5 rounded-md px-4 pt-2.5 pb-3">
            <span className="engraved text-[9px]">{label as string}</span>
            <input
              className="plate-input"
              value={value as string}
              placeholder={placeholder as string}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-6">
          <ModePicks selected={modes} enabled={c.modes} onToggle={(m) => setModes(toggle(modes, m))} />
          <FanPicks selected={fans} enabled={c.fans} onToggle={(f) => setFans(toggle(fans, f))} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="engraved">Temperature</span>
          <div className="flex flex-wrap items-end gap-4">
            {tempDial("Min °C", minTemp, setMinTemp)}
            {tempDial("Max °C", maxTemp, setMaxTemp)}
            <div className="flex flex-col gap-2">
              <span className="engraved">Precision</span>
              <div className="well flex p-1" role="radiogroup" aria-label="Precision">
                {[1, 0.5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={step === s}
                    disabled={s === 0.5 && c.temp.step !== 0.5}
                    title={s === 0.5 && c.temp.step !== 0.5 ? "Not available on this protocol" : undefined}
                    onClick={() => setStep(s)}
                    className={`rounded-md px-3.5 py-1.5 font-mono text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-35 ${
                      step === s ? "key-green" : "text-[#5f5a52]"
                    }`}
                  >
                    {s}°
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {canV || canH ? (
          <VanePicks
            horizontal={horizontal}
            both={canV && canH}
            selected={horizontal ? swingsH : swingsV}
            enabled={horizontal ? c.swingH : c.swingV}
            onDirection={setHorizontal}
            onToggle={(id) => (horizontal ? setSwingsH(toggle(swingsH, id as SwingH)) : setSwingsV(toggle(swingsV, id as SwingV)))}
          />
        ) : (
          <div />
        )}
      </div>

      <div className="well flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="lcd shrink-0 px-3 py-2">
            <SevenSeg text={String(count).padStart(4, " ")} className="text-3xl" />
          </div>
          <p className="min-w-0 max-w-sm text-xs leading-relaxed break-words text-[#5f5a52]">
            Commands{trial.protocol.powerToggle ? ", plus an identical on and off toggle" : ", plus off"}. The remote fills in anything
            these controls don&apos;t set. Save as <code className="font-mono">custom_codes/climate/&lt;number&gt;.json</code> and set{" "}
            <code className="font-mono">device_code</code> to that number.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Key tone="green" className="h-14 flex-row gap-2.5 px-6 text-sm font-bold tracking-wide" disabled={flipper || missing.length > 0} onClick={save} title={flipper ? "Flipper Zero uses a .ir file" : missing.length ? `Needs ${missing.join(", ")}` : `${ctrl.label} · ${opt.encoding}`}>
            <Printer className="size-5" />
            Print SmartIR file
          </Key>
          <span className="engraved text-[9px]">{flipper ? "Flipper Zero uses a .ir file" : missing.length ? `Needs ${missing.join(", ")}` : `${ctrl.label} · ${opt.encoding}`}</span>
        </div>
      </div>
    </div>
  );
}

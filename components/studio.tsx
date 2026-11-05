"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Minus, Plus, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { broadlinkToFrame, frameToBroadlink, frameToPulses } from "@/lib/broadlink";
import { learnedCapture } from "@/lib/learned";
import {
  FAN_LABEL,
  FANS,
  MAX_TEMP,
  MIN_TEMP,
  MODE_LABEL,
  MODES,
  MODELS,
  buildFrame,
  describeState,
  explainBytes,
  formatBytes,
  formatClock,
  hex,
  parseFrame,
  quantizeClock,
  type FrameState,
  type ParsedFrame,
} from "@/lib/protocol";

const INITIAL: FrameState = {
  power: true,
  mode: "cool",
  temperature: 24,
  fan: "auto",
  clockMinutes: 8 * 60 + 6,
};

export function Studio() {
  const [state, setState] = useState<FrameState>(INITIAL);
  const [selectedByte, setSelectedByte] = useState(7);
  const [copied, setCopied] = useState<"code" | "hex" | null>(null);
  const [paste, setPaste] = useState("");
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<ParsedFrame | null>(null);

  const bytes = useMemo(() => buildFrame(state), [state]);
  const parsed = useMemo(() => parseFrame(bytes), [bytes]);
  const notes = useMemo(() => explainBytes(parsed), [parsed]);
  const code = useMemo(() => frameToBroadlink(bytes), [bytes]);
  const pulses = useMemo(() => frameToPulses(bytes), [bytes]);
  const learned = useMemo(() => learnedCapture(state), [state]);
  const learnedFrame = useMemo(() => {
    try {
      return broadlinkToFrame(learned.base64).frame;
    } catch {
      return null;
    }
  }, [learned.base64]);

  const comparison = compareFrames(bytes, learnedFrame);
  const sentClock = quantizeClock(state.clockMinutes);
  const clockShifted = sentClock !== normalizeDay(state.clockMinutes);
  const activeNote = notes.find((note) => note.index === selectedByte) ?? notes[0];

  function patch(next: Partial<FrameState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function copy(value: string, which: "code" | "hex") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    window.setTimeout(() => setCopied((current) => (current === which ? null : current)), 1600);
  }

  function decodePaste() {
    const text = paste.trim();
    if (!text) {
      setDecoded(null);
      setDecodeError("Paste a Base64 Broadlink code first.");
      return;
    }
    try {
      const { frame } = broadlinkToFrame(text);
      const result = parseFrame(frame);
      setDecoded(result);
      setDecodeError(result.headerOk ? null : "The packet decoded, but it is not an MSXY-FP frame.");
    } catch (error) {
      setDecoded(null);
      setDecodeError(error instanceof Error ? error.message : "That code could not be decoded.");
    }
  }

  function loadDecoded() {
    if (!decoded?.mode || !decoded.fan || decoded.power === null) return;
    setState({
      power: decoded.power,
      mode: decoded.mode,
      temperature: decoded.temperature ?? decoded.storedTemperature ?? state.temperature,
      fan: decoded.fan,
      clockMinutes: decoded.clockMinutes,
    });
    setSelectedByte(decoded.mode === "cool" ? 7 : 6);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Mitsubishi Electric · {MODELS.join(" · ")}
        </p>
        <h1 className="font-display text-4xl tracking-tight text-balance sm:text-5xl">
          MSXY-FP IR studio
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          These Broadlink codes are an 18-byte Mitsubishi frame, sent twice. Pick a mode,
          temperature, and fan speed to build the same packet, or paste a captured code to
          read it back.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section
          aria-label="Remote"
          className="rounded-[2rem] border border-[#e4ddd0] bg-[#f7f4ee] p-5 shadow-[0_20px_50px_-30px_rgba(40,32,20,0.45)] sm:p-6"
        >
          <div
            className={`rounded-2xl border border-[#1c3a2c] px-4 py-5 transition-colors ${
              state.power ? "bg-[#10241c] text-[#d7f5c8]" : "bg-[#1a1f1c] text-[#6d7a72]"
            }`}
          >
            <div className="flex items-center justify-between text-[0.7rem] tracking-[0.16em] uppercase">
              <span>{state.power ? "On" : "Standby"}</span>
              <span>{formatClock(sentClock)}</span>
            </div>
            <p className="font-display mt-3 text-6xl leading-none tabular-nums">
              {state.mode === "cool" ? state.temperature : "—"}
              <span className="ml-1 text-2xl">{state.mode === "cool" ? "°C" : ""}</span>
            </p>
            <p className="mt-3 text-sm">
              {MODE_LABEL[state.mode]} · {FAN_LABEL[state.fan]} fan
            </p>
            {state.mode !== "cool" ? (
              <p className="mt-1 text-xs text-[#8ea898]">
                Dry and fan frames do not carry a setpoint.
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant={state.power ? "default" : "outline"}
              className="h-11 rounded-full px-4"
              aria-pressed={state.power}
              onClick={() => patch({ power: !state.power })}
            >
              <Power />
              {state.power ? "Power on" : "Power off"}
            </Button>
            <p className="text-right text-xs text-muted-foreground">
              Off keeps the mode in the frame.
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Mode
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={state.mode === mode ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={state.mode === mode}
                  onClick={() => patch({ mode })}
                >
                  {MODE_LABEL[mode]}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5" disabled={state.mode !== "cool"}>
            <legend className="flex w-full items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <span>Temperature</span>
              <span className="tabular-nums normal-case">
                {state.mode === "cool" ? `${state.temperature}°C` : "Not sent"}
              </span>
            </legend>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Lower temperature"
                disabled={state.mode !== "cool" || state.temperature <= MIN_TEMP}
                onClick={() => patch({ temperature: state.temperature - 1 })}
              >
                <Minus />
              </Button>
              <Slider
                className="flex-1"
                min={MIN_TEMP}
                max={MAX_TEMP}
                step={1}
                value={[state.temperature]}
                disabled={state.mode !== "cool"}
                aria-label="Temperature"
                onValueChange={(next) => {
                  const value = Array.isArray(next) ? next[0] : next;
                  if (typeof value === "number") patch({ temperature: value });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Raise temperature"
                disabled={state.mode !== "cool" || state.temperature >= MAX_TEMP}
                onClick={() => patch({ temperature: state.temperature + 1 })}
              >
                <Plus />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {MIN_TEMP}–{MAX_TEMP}°C. At 16°C and 31°C the fan byte uses the 0xB form.
            </p>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fan
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FANS.map((fan) => (
                <Button
                  key={fan}
                  type="button"
                  variant={state.fan === fan ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={state.fan === fan}
                  onClick={() => patch({ fan })}
                >
                  {FAN_LABEL[fan]}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Remote clock
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Hour
                <Input
                  className="mt-1 h-11"
                  type="number"
                  min={0}
                  max={23}
                  value={Math.floor(normalizeDay(state.clockMinutes) / 60)}
                  onChange={(event) => {
                    const hour = clampNumber(event.target.value, 0, 23);
                    const minute = normalizeDay(state.clockMinutes) % 60;
                    patch({ clockMinutes: hour * 60 + minute });
                  }}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Minute
                <Input
                  className="mt-1 h-11"
                  type="number"
                  min={0}
                  max={59}
                  value={normalizeDay(state.clockMinutes) % 60}
                  onChange={(event) => {
                    const minute = clampNumber(event.target.value, 0, 59);
                    const hour = Math.floor(normalizeDay(state.clockMinutes) / 60);
                    patch({ clockMinutes: hour * 60 + minute });
                  }}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {clockShifted
                ? `${formatClock(state.clockMinutes)} is sent as ${formatClock(sentClock)}. The remote stores time in 6-minute steps, and the clock does not change the climate command.`
                : "Stored in 6-minute steps. The clock does not change the climate command."}
            </p>
          </fieldset>
        </section>

        <section aria-label="Frame inspector" className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">Frame</h2>
              <Badge variant="secondary">{parsed.checksumOk ? "Checksum ok" : "Checksum failed"}</Badge>
              {parsed.limitFlag ? <Badge variant="outline">0xB fan byte</Badge> : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed">{describeState(parsed)}</p>
            <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {bytes.map((byte, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedByte(index)}
                  className={`rounded-lg border px-1 py-2 text-center font-mono text-xs tabular-nums ${
                    selectedByte === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  aria-pressed={selectedByte === index}
                  aria-label={`Byte ${index}, ${hex(byte)}, ${notes[index]?.label ?? ""}`}
                >
                  <span className="block text-[0.65rem] opacity-70">{index}</span>
                  {hex(byte)}
                </button>
              ))}
            </div>
            {activeNote ? (
              <p className="mt-3 text-sm leading-relaxed">
                <span className="font-medium">
                  Byte {activeNote.index} · {activeNote.label}.{" "}
                </span>
                {activeNote.text}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Broadlink code</h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10" onClick={() => copy(formatBytes(bytes), "hex")}>
                  {copied === "hex" ? <Check /> : <Copy />}
                  {copied === "hex" ? "Copied" : "Copy hex"}
                </Button>
                <Button type="button" className="h-10" onClick={() => copy(code, "code")}>
                  {copied === "code" ? <Check /> : <Copy />}
                  {copied === "code" ? "Copied" : "Copy code"}
                </Button>
              </div>
            </div>
            <p className="mt-3 font-mono text-xs leading-relaxed break-all text-muted-foreground">{code}</p>
            <Comparison comparison={comparison} issue={learned.issue} />
            <Waveform pulses={pulses} />
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-medium">Read a captured code</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste any Base64 code from the MSXY-FP table, or one this studio just built.
            </p>
            <textarea
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              placeholder="JgBMAm…"
              rows={4}
              className="mt-3 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="h-10" onClick={decodePaste}>
                Decode
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={!decoded?.mode || !decoded.fan || decoded.power === null}
                onClick={loadDecoded}
              >
                Use these settings
              </Button>
            </div>
            {decodeError ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {decodeError}
              </p>
            ) : null}
            {decoded ? <DecodedResult parsed={decoded} /> : null}
            {!decoded && !decodeError ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing decoded yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <Protocol />
    </div>
  );
}

function Comparison({
  comparison,
  issue,
}: {
  comparison: ReturnType<typeof compareFrames>;
  issue?: string;
}) {
  return (
    <div className="mt-4 rounded-xl bg-muted/70 px-3 py-3 text-sm leading-relaxed">
      <p className="font-medium">{comparison.title}</p>
      <p className="mt-1 text-muted-foreground">{comparison.detail}</p>
      {issue ? <p className="mt-2 text-muted-foreground">{issue}</p> : null}
    </div>
  );
}

function DecodedResult({ parsed }: { parsed: ParsedFrame }) {
  return (
    <div className="mt-4 space-y-2 text-sm">
      <p>{describeState(parsed)}</p>
      <p className="font-mono text-xs break-all text-muted-foreground">{formatBytes(parsed.bytes)}</p>
      {parsed.notes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {parsed.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Header, fields, and checksum all match this model.</p>
      )}
    </div>
  );
}

function Waveform({ pulses }: { pulses: number[] }) {
  const slice = pulses.slice(0, 90);
  let x = 0;
  const commands: string[] = [];
  for (let index = 0; index < slice.length; index += 1) {
    const width = Math.max(0.6, slice[index] / 28);
    const high = index % 2 === 0;
    const y = high ? 6 : 28;
    commands.push(`M ${x.toFixed(1)} ${high ? 28 : 6} V ${y} H ${(x + width).toFixed(1)}`);
    x += width;
  }
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">
        Opening of the IR burst. A short gap is a 0, a long gap is a 1. The frame is repeated after a long space.
      </p>
      <div className="mt-2 overflow-x-auto rounded-xl bg-[#10241c] p-3">
        <svg viewBox={`0 0 ${Math.max(x, 1)} 36`} className="h-12 min-w-[36rem]" role="img" aria-label="Infrared pulse waveform">
          <path d={commands.join(" ")} fill="none" stroke="#d7f5c8" strokeWidth="1.4" />
        </svg>
      </div>
    </div>
  );
}

function Protocol() {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-medium">How the code is built</h2>
      <div className="mt-3 grid gap-6 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
        <div className="space-y-3">
          <p>
            Each command is a Broadlink IR packet: type byte 0x26, a length, then pulse widths in
            ticks of about 32.84 µs. Inside the pulses is a 144-bit Mitsubishi Electric frame, least
            significant bit first, sent twice.
          </p>
          <p>
            Timing follows the usual Mitsubishi aircon carrier. A header mark of about 3.5 ms and a
            space of about 1.7 ms start the frame. Each bit is a 0.43 ms mark. A 0 is a 0.39 ms
            space and a 1 is a 1.25 ms space. A long space separates the two copies.
          </p>
        </div>
        <dl className="space-y-2">
          <Row k="0–4" v="Fixed preamble 23 CB 26 01 00." />
          <Row k="5" v="Power. 0x20 on, 0x00 off." />
          <Row k="6" v="Mode. Cool 0x18, dry 0x10, fan 0x38." />
          <Row k="7" v="Cool setpoint minus 16. Dry and fan store 0x08." />
          <Row k="8" v="Vane byte, constant per mode: 36, 32, or 30." />
          <Row k="9" v="Fan in the low 3 bits. Upper nibble 7, or B at the cool limits and for auto outside cool." />
          <Row k="10" v="Clock, minutes divided by 6." />
          <Row k="11–16" v="Zero. Unused on these models." />
          <Row k="17" v="Checksum, the low 8 bits of the sum of bytes 0–16." />
        </dl>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        287 of the 288 on-commands rebuild byte for byte when the clock stamp is kept. The published
        capture for cool, high fan, 18°C is a duplicate of 17°C, so the studio writes 18°C instead
        of copying it. There is no heat mode and no operating-mode auto in this set.
      </p>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="font-mono text-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function compareFrames(built: number[], learned: number[] | null) {
  if (!learned) {
    return {
      title: "No learned capture to compare.",
      detail: "The table did not contain a code for this combination.",
    };
  }
  if (built.length === learned.length && built.every((byte, index) => byte === learned[index])) {
    return {
      title: "Matches the learned capture.",
      detail: "Every byte, including the clock and checksum, is the same as the code in the table.",
    };
  }
  const dataDiffs = built
    .map((byte, index) => (index === 10 || index === 17 || byte === learned[index] ? null : index))
    .filter((index): index is number => index !== null);
  if (dataDiffs.length === 0) {
    return {
      title: "Same command, different clock.",
      detail: `Byte 10 is ${hex(built[10])} here and ${hex(learned[10])} in the capture. The checksum changes with it. The climate fields match.`,
    };
  }
  return {
    title: "Differs from the learned capture.",
    detail: `Bytes ${dataDiffs.join(", ")} do not match. Generated ${formatBytes(built)}. Learned ${formatBytes(learned)}.`,
  };
}

function normalizeDay(minutes: number): number {
  return ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
}

function clampNumber(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

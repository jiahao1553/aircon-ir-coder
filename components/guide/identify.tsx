"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PROTOCOLS, type AcProtocol } from "@/lib/ir";
import { PROTOCOL_MODELS } from "@/lib/ir/protocol-models.data";
import { Key } from "./hardware";

export type Trial = { protocol: AcProtocol; variant?: string };

export function protocolChoice(protocol: AcProtocol) {
  return protocol.id;
}

export function trialFromChoice(choice: string): Trial {
  const protocol = PROTOCOLS.find((p) => p.id === choice) ?? PROTOCOLS[0];
  return { protocol };
}

export function Identify({ value, onChange }: { value: string; onChange: (choice: string) => void }) {
  const index = Math.max(0, PROTOCOLS.findIndex((p) => p.id === value));
  const step = (d: number) => onChange(PROTOCOLS[(index + d + PROTOCOLS.length) % PROTOCOLS.length].id);
  const angle = -135 + (270 * index) / (PROTOCOLS.length - 1);
  const drag = useRef<{ pointer: number; index: number; turned: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const protocol = PROTOCOLS[index];

  const pointerAngle = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: pointerAngle(e), index, turned: 0 };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = pointerAngle(e);
    let delta = now - d.pointer;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.pointer = now;
    d.turned += delta;
    const span = 270 / (PROTOCOLS.length - 1);
    const next = Math.min(PROTOCOLS.length - 1, Math.max(0, Math.round(d.index + d.turned / span)));
    if (PROTOCOLS[next].id !== value) onChange(PROTOCOLS[next].id);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, value]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div ref={root} className="relative min-w-0 flex-1 sm:min-w-[20rem]">
        <div className="metal flex flex-col gap-1 rounded-md px-4 py-2.5">
          <span className="engraved text-[9px]">
            Protocol · {String(index + 1).padStart(2, "0")} of {PROTOCOLS.length}
          </span>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                step(1);
                setOpen(true);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                step(-1);
                setOpen(true);
              }
            }}
            className="flex w-full cursor-pointer items-center gap-3 bg-transparent text-left outline-none focus-visible:underline"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-base font-bold text-[#12533e]">{protocol.name}</span>
            <ChevronDown className={`size-4 shrink-0 text-[#5f5a52] ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        {open ? (
          <ul
            role="listbox"
            aria-label="Protocol"
            className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-auto rounded-md border border-[#c9c4b8] bg-[#f7f4ee] p-1 shadow-lg"
          >
            {PROTOCOLS.map((p) => {
              const models = PROTOCOL_MODELS[p.id];
              const selected = p.id === value;
              return (
                <li key={p.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer flex-col items-start gap-0.5 rounded px-2.5 py-1.5 text-left ${selected ? "bg-[#dce8e1]" : "hover:bg-[#ece7de]"}`}
                  >
                    <span className="font-mono text-sm font-bold text-[#12533e]">{p.name}</span>
                    {models?.length ? <span className="text-[11px] leading-snug text-[#6b6560]">{models.join(", ")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Key className="size-9" aria-label="Previous protocol" onClick={() => step(-1)}>
          <ChevronLeft className="size-4" />
        </Key>
        <button
          type="button"
          aria-label="Turn protocol knob"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`knob relative size-14 cursor-pointer touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2f6b55] ${dragging ? "dragging" : ""}`}
        >
          <span aria-hidden className="knob-face pointer-events-none absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <span className="absolute top-1.5 left-1/2 h-3.5 w-1 -translate-x-1/2 rounded-full bg-[#b8231b]" />
          </span>
        </button>
        <Key className="size-9" aria-label="Next protocol" onClick={() => step(1)}>
          <ChevronRight className="size-4" />
        </Key>
      </div>
    </div>
  );
}

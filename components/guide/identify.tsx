"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { PROTOCOLS, type AcProtocol } from "@/lib/ir";
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
  const [dragging, setDragging] = useState(false);

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

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="metal relative flex min-w-0 flex-1 flex-col gap-1 rounded-md px-4 py-2.5 sm:min-w-[20rem]">
        <span className="engraved text-[9px]">
          Protocol · {String(index + 1).padStart(2, "0")} of {PROTOCOLS.length}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent font-mono text-base font-bold text-[#12533e] outline-none focus-visible:underline"
        >
          {PROTOCOLS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
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

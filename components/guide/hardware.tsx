"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// Segments a–g, clockwise from the top, then the middle bar.
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

const PATHS: Record<string, string> = {
  a: "M3 1h10l-2 2H5z",
  b: "M14 2v10l-2-1.5V4z",
  c: "M14 14v10l-2-2V15.5z",
  d: "M3 25h10l-2-2H5z",
  e: "M2 14v10l2-2V15.5z",
  f: "M2 2v10l2-1.5V4z",
  g: "M3 13l2-1.5h6l2 1.5-2 1.5H5z",
};

/** Seven-segment digits with unlit segments left faintly visible, like a real LCD. */
export function SevenSeg({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex gap-[0.08em] ${className ?? ""}`} aria-label={text.trim()}>
      {[...text].map((ch, i) => {
        const lit = SEGMENTS[ch] ?? "";
        return (
          <svg key={i} viewBox="0 0 16 26" className="h-[1em] w-[0.62em]" aria-hidden>
            {Object.entries(PATHS).map(([seg, d]) => (
              <path key={seg} d={d} fill="currentColor" opacity={lit.includes(seg) ? 1 : 0.08} />
            ))}
          </svg>
        );
      })}
    </span>
  );
}

export function Key({
  children,
  label,
  tone,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; tone?: "red" | "green" }) {
  return (
    <button
      type="button"
      className={`key ${tone ? `key-${tone}` : ""} ${className ?? ""}`}
      {...rest}
      title={rest.title ?? (rest.disabled ? "Not available on this protocol" : undefined)}
    >
      {children}
      {label ? <span className="text-[9px] font-bold tracking-[0.12em] uppercase">{label}</span> : null}
    </button>
  );
}

export function Screws() {
  return (
    <>
      {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`absolute ${pos} size-2.5 rounded-full bg-gradient-to-br from-[#f4f1ea] to-[#a8a297] shadow-[inset_0_1px_1px_rgb(0_0_0/0.4)] after:absolute after:top-1/2 after:left-[2px] after:h-px after:w-1.5 after:-translate-y-1/2 after:rotate-45 after:bg-black/40`}
        />
      ))}
    </>
  );
}

export function Bay({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="engraved">{title}</h2>
        {aside ? <span className="engraved text-[#2f6b55]">{aside}</span> : null}
      </div>
      <div className="flex flex-col lg:min-h-0 lg:flex-1">{children}</div>
    </section>
  );
}

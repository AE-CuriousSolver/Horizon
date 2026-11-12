"use client";

import { useState, useTransition } from "react";
import { adjustScore } from "@/lib/data/actions";
import { scores as copy } from "@/lib/copy/en-GB";
import { cx } from "./ui";

type Field = "effort" | "impact" | "urgency";
const FIELDS: Field[] = ["effort", "impact", "urgency"];

export function ScoreStepper({
  label,
  hint,
  value,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const btn = cx(
    compact ? "size-7" : "size-8",
    "flex items-center justify-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-30",
  );
  const controls = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label={copy.less(label)}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        className={btn}
      >
        ▾
      </button>
      <span className="w-4 text-center text-sm font-semibold tabular-nums" aria-label={`${label} ${value}`}>
        {value}
      </span>
      <button
        type="button"
        aria-label={copy.more(label)}
        disabled={disabled || value >= 5}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        ▴
      </button>
    </div>
  );
  if (compact) {
    return (
      <div className="flex flex-col items-center" title={hint}>
        <span className="text-[11px] leading-none text-muted">{label}</span>
        {controls}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1" title={hint}>
      <span className="w-14 text-xs text-muted">{label}</span>
      {controls}
    </div>
  );
}

/** Inline score arrows that save straight away. */
export function ScoreArrows({
  taskId,
  effort,
  impact,
  urgency,
  className,
}: {
  taskId: string;
  effort: number;
  impact: number;
  urgency: number;
  className?: string;
}) {
  const [values, setValues] = useState({ effort, impact, urgency });
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const change = (field: Field, next: number) => {
    const prev = values[field];
    const delta = next > prev ? 1 : -1;
    setValues((v) => ({ ...v, [field]: Math.min(5, Math.max(1, next)) }));
    setError(false);
    start(async () => {
      const res = await adjustScore(taskId, field, delta);
      if (!res.ok) {
        setValues((v) => ({ ...v, [field]: prev }));
        setError(true);
      }
    });
  };

  return (
    <div className={cx("flex flex-wrap items-end gap-x-3", pending && "opacity-80", className)}>
      {FIELDS.map((f) => (
        <ScoreStepper
          key={f}
          label={copy[f].label}
          hint={copy[f].hint}
          value={values[f]}
          onChange={(n) => change(f, n)}
          compact
        />
      ))}
      {error && <span className="text-xs text-warm">Couldn&apos;t save that. Try again.</span>}
    </div>
  );
}

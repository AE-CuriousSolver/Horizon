"use client";

import { useRef, useState, useTransition } from "react";
import { quickCapture } from "@/lib/data/actions";
import { radar as copy, scores } from "@/lib/copy/en-GB";
import { ScoreStepper } from "./ScoreArrows";
import { cx, inputClass } from "./ui";

const DEFAULTS = { effort: 3, impact: 3, urgency: 3 };

export function QuickCapture() {
  const [title, setTitle] = useState("");
  const [values, setValues] = useState(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    start(async () => {
      const res = await quickCapture({ title, ...values });
      if (res.ok) {
        setTitle("");
        setValues(DEFAULTS);
        setOpen(false);
        ref.current?.focus();
      } else setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-line bg-surface p-3">
      <div className="flex gap-2">
        <label htmlFor="quick-capture" className="sr-only">
          {copy.capturePlaceholder}
        </label>
        <input
          id="quick-capture"
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={copy.capturePlaceholder}
          maxLength={300}
          className={cx(inputClass, "border-transparent bg-transparent px-1")}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="min-h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-40"
        >
          {copy.captureButton}
        </button>
      </div>
      {(open || title) && (
        <div className="mt-2 flex flex-wrap gap-x-3 border-t border-line pt-2">
          {(["effort", "impact", "urgency"] as const).map((f) => (
            <ScoreStepper
              key={f}
              label={scores[f].label}
              hint={scores[f].hint}
              value={values[f]}
              onChange={(n) => setValues((v) => ({ ...v, [f]: n }))}
            />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-warm">{error}</p>}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { completeNextStep, setTaskStatus } from "@/lib/data/actions";
import type { CardModel } from "@/lib/board";
import { checkIn as checkInCopy, radar as copy } from "@/lib/copy/en-GB";
import { ScoreArrows } from "./ScoreArrows";
import { useToast } from "./Toast";
import { cx } from "./ui";

export function TaskCard({ card, graceDays }: { card: CardModel; graceDays: number }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, hide = false, after?: () => void) => {
    setError(null);
    if (hide) setGone(true);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setGone(false);
        setError(res.error ?? null);
      } else after?.();
    });
  };

  if (gone) return null;

  const markDone = () =>
    run(() => setTaskStatus(card.id, "done"), true, () =>
      toast(copy.markedDone(card.title), async () => {
        await setTaskStatus(card.id, "undone");
      }),
    );

  return (
    <li
      className={cx(
        "rounded-2xl border bg-surface p-4 transition-opacity",
        card.checkIn ? "border-warm/40 bg-warm-soft" : "border-line",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={markDone}
          aria-label={`${copy.done}: ${card.title}`}
          title={copy.done}
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent hover:border-accent hover:text-accent"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/tasks/${card.id}`} className="block">
            <p className="font-medium leading-snug break-words">{card.headline}</p>
            {card.subheading && <p className="mt-0.5 text-sm text-muted break-words">{card.subheading}</p>}
          </Link>
          {card.checkIn ? (
            <div className="mt-2">
              <p className="text-sm">{card.checkIn.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/tasks/${card.id}`}
                  className="inline-flex min-h-9 items-center rounded-full bg-surface px-3 text-sm font-medium hover:bg-surface-2"
                >
                  {checkInCopy.update}
                </Link>
                <button
                  type="button"
                  onClick={markDone}
                  className="min-h-9 rounded-full bg-surface px-3 text-sm font-medium hover:bg-surface-2"
                >
                  {checkInCopy.done}
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setTaskStatus(card.id, "let_go"), true)}
                  className="min-h-9 rounded-full bg-surface px-3 text-sm font-medium hover:bg-surface-2"
                >
                  {checkInCopy.letGo}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">{checkInCopy.autoLetGoHint(graceDays)}</p>
            </div>
          ) : (
            card.reason && <p className="mt-1.5 text-xs text-accent">{card.reason}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <ScoreArrows taskId={card.id} effort={card.effort} impact={card.impact} urgency={card.urgency} />
            {card.hasOpenStep && (
              <button
                type="button"
                onClick={() => run(() => completeNextStep(card.id))}
                className="min-h-9 rounded-full px-3 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                {copy.stepDone}
              </button>
            )}
          </div>
          {card.workings && (
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer">
                {copy.workingsTitle}: {card.workings.total}
              </summary>
              <ul className="mt-1 space-y-0.5">
                {card.workings.lines.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4">
                    <span>{l.label}</span>
                    <span className="tabular-nums">{l.points}</span>
                  </li>
                ))}
                {card.workings.effectiveDeadline && <li>Treated as due {card.workings.effectiveDeadline}</li>}
              </ul>
            </details>
          )}
          {error && <p className="mt-2 text-xs text-warm">{error}</p>}
        </div>
      </div>
    </li>
  );
}

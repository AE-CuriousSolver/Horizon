"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setTaskStatus, type LifecycleAction } from "@/lib/data/actions";
import type { OrbitItem } from "@/lib/board";
import { editor } from "@/lib/copy/en-GB";
import { ScoreArrows } from "./ScoreArrows";
import { cx } from "./ui";

export function OrbitList({
  items,
  kind,
}: {
  items: OrbitItem[];
  kind: "visible" | "hidden" | "done" | "letGo";
}) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item) => (
        <OrbitRow key={item.id} item={item} kind={kind} />
      ))}
    </ul>
  );
}

function OrbitRow({ item, kind }: { item: OrbitItem; kind: "visible" | "hidden" | "done" | "letGo" }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const act = (a: LifecycleAction) =>
    start(async () => {
      setGone(true);
      const res = await setTaskStatus(item.id, a);
      if (!res.ok) setGone(false);
    });
  if (gone) return null;
  const closed = kind === "done" || kind === "letGo";
  return (
    <li className={cx("p-3", pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/tasks/${item.id}`} className="min-w-0">
          <p className={cx("break-words", closed && "text-muted")}>{item.title}</p>
          <p className="text-xs text-muted">
            {kind === "done" && item.note ? `Done ${item.note}` : item.note}
            {item.stepsTotal > 0 && ` ${item.note ? "· " : ""}${item.stepsDone}/${item.stepsTotal} steps`}
          </p>
        </Link>
        {kind === "done" && (
          <button type="button" onClick={() => act("undone")} className="shrink-0 text-sm text-accent hover:underline">
            {editor.undone}
          </button>
        )}
        {kind === "letGo" && (
          <button type="button" onClick={() => act("restore")} className="shrink-0 text-sm text-accent hover:underline">
            {editor.restore}
          </button>
        )}
      </div>
      {!closed && (
        <ScoreArrows taskId={item.id} effort={item.effort} impact={item.impact} urgency={item.urgency} className="mt-1" />
      )}
    </li>
  );
}

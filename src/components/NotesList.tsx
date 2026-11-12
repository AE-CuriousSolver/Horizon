"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { putBack, resolveNote, setTaskStatus } from "@/lib/data/actions";
import { notes as copy } from "@/lib/copy/en-GB";
import { cx } from "./ui";

export interface NoteTask {
  id: string;
  title: string;
  /** What can be done for this task from the note. */
  action: "restore" | "edit" | "put_back" | null;
  adjustment?: string;
}

export interface NoteModel {
  id: string;
  when: string;
  message: string;
  resolved: boolean;
  tasks: NoteTask[];
}

export function NotesList({ notes }: { notes: NoteModel[] }) {
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
    </ul>
  );
}

function NoteCard({ note }: { note: NoteModel }) {
  const [pending, start] = useTransition();
  const [resolved, setResolved] = useState(note.resolved);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const act = (t: NoteTask) =>
    start(async () => {
      setError(null);
      const res =
        t.action === "restore"
          ? await setTaskStatus(t.id, "restore")
          : await putBack(t.id, t.adjustment ?? "");
      if (res.ok) setDoneIds((d) => [...d, t.id]);
      else setError(res.error);
    });

  const actionable = note.tasks.filter((t) => t.action);
  return (
    <li className={cx("rounded-2xl border border-line bg-surface p-4", resolved && "opacity-60", pending && "opacity-70")}>
      <p className="text-xs text-muted">{note.when}</p>
      <p className="mt-1">{note.message}</p>
      {actionable.length > 0 && !resolved && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">{copy.notRight}</p>
          <ul className="space-y-1.5">
            {actionable.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">{t.title}</span>
                {doneIds.includes(t.id) ? (
                  <span className="shrink-0 text-xs text-muted">{t.action === "put_back" ? copy.putBackDone : "✓"}</span>
                ) : t.action === "edit" ? (
                  <Link href={`/tasks/${t.id}`} className="shrink-0 font-medium text-accent hover:underline">
                    {copy.edit}
                  </Link>
                ) : (
                  <button type="button" onClick={() => act(t)} className="shrink-0 font-medium text-accent hover:underline">
                    {t.action === "restore" ? copy.restore : copy.putBack}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!resolved && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              const res = await resolveNote(note.id);
              if (res.ok) setResolved(true);
            })
          }
          className="mt-3 text-sm text-muted hover:text-ink"
        >
          {copy.allGood}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-warm">{error}</p>}
    </li>
  );
}

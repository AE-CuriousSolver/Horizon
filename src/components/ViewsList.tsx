"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteView, renameView } from "@/lib/data/actions";
import { views as copy } from "@/lib/copy/en-GB";
import { inputClass } from "./ui";

export interface ViewRowModel {
  id: string;
  name: string;
  summary: string;
  href: string;
}

export function ViewsList({ items }: { items: ViewRowModel[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((v) => (
        <ViewRow key={v.id} view={v} />
      ))}
    </ul>
  );
}

function ViewRow({ view }: { view: ViewRowModel }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(view.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <li className="p-3">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await renameView(view.id, name);
              if (res.ok) setEditing(false);
              else setError(res.error);
            });
          }}
        >
          <label htmlFor={`view-${view.id}`} className="sr-only">
            {copy.name}
          </label>
          <input id={`view-${view.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} autoFocus />
          <button type="submit" disabled={pending} className="shrink-0 text-sm font-medium text-accent">
            {copy.save}
          </button>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words">{view.name}</p>
            <p className="text-xs text-muted">{view.summary}</p>
          </div>
          <div className="flex shrink-0 gap-3 text-sm">
            <Link href={view.href} className="font-medium text-accent hover:underline">
              {copy.apply}
            </Link>
            <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink">
              {copy.rename}
            </button>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setGone(true);
                  const res = await deleteView(view.id);
                  if (!res.ok) {
                    setGone(false);
                    setError(res.error);
                  }
                })
              }
              className="text-muted hover:text-ink"
            >
              {copy.delete}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-warm">{error}</p>}
    </li>
  );
}

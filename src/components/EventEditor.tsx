"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteEvent, saveEvent } from "@/lib/data/actions";
import { events as copy, editor } from "@/lib/copy/en-GB";
import type { EventValue, WhenValue } from "@/lib/validation";
import { Button, Card, ErrorText, FieldLabel, inputClass } from "./ui";
import { WhenPicker } from "./WhenPicker";

export function EventEditor({
  initial,
  linkedCount,
}: {
  initial: EventValue;
  linkedCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [startW, setStart] = useState<WhenValue>(initial.start);
  const [endW, setEnd] = useState<WhenValue | null>(initial.end ?? null);
  const [confirming, setConfirming] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveEvent({ id: initial.id, name, start: startW, end: endW });
      if (!res.ok) return setError(res.error);
      router.push("/events");
      router.refresh();
    });
  };

  const remove = () =>
    start(async () => {
      if (!initial.id) return;
      const res = await deleteEvent(initial.id);
      if (!res.ok) return setError(res.error);
      router.push("/events");
      router.refresh();
    });

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <FieldLabel htmlFor="event-name">{copy.name}</FieldLabel>
        <input
          id="event-name"
          required
          maxLength={200}
          value={name}
          placeholder={copy.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          autoFocus={!initial.id}
        />
      </div>

      <div role="radiogroup" aria-label="Kind of event" className="flex gap-2">
        {[
          { key: "day", label: copy.onADay, active: !endW },
          { key: "range", label: copy.betweenDates, active: !!endW },
        ].map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.active}
            onClick={() =>
              setEnd(o.key === "day" ? null : (endW ?? { date: startW.date, precision: "day", part: null, time: null }))
            }
            className={`min-h-9 rounded-full border px-3 text-sm ${o.active ? "border-accent bg-accent-soft" : "border-line text-muted"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">{endW ? copy.from : copy.on}</p>
        <WhenPicker label={endW ? copy.from : copy.on} value={startW} onChange={setStart} />
      </div>
      {endW && (
        <div>
          <p className="mb-1 text-sm font-medium">{copy.to}</p>
          <WhenPicker label={copy.to} value={endW} onChange={setEnd} />
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? editor.saving : editor.save}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          {editor.cancel}
        </Button>
      </div>

      {initial.id && (
        <Card>
          {!confirming ? (
            <Button variant="ghost" onClick={() => (linkedCount > 0 ? setConfirming(true) : remove())} disabled={pending}>
              {copy.delete}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">{copy.deleteTitle}</p>
              <p className="text-sm text-muted">{copy.deleteWithTasks(linkedCount)}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={remove} disabled={pending}>
                  {copy.unlinkAndDelete}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  {editor.cancel}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </form>
  );
}

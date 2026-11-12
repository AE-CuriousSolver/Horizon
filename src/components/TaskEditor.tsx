"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  dismissShapingHint,
  saveTask,
  setTaskStatus,
  type LifecycleAction,
} from "@/lib/data/actions";
import { editor as copy, relations, scores as scoreCopy } from "@/lib/copy/en-GB";
import { formatWhen } from "@/lib/format";
import { priorityConfig } from "@/lib/priority/config";
import { localDateString, resolveWhen } from "@/lib/priority/time";
import type { Relation, TaskStatus } from "@/lib/priority/types";
import { deadlineConflict, leadDaysFor } from "@/lib/priority/visibility";
import type { TaskValue, WhenValue } from "@/lib/validation";
import { ScoreStepper } from "./ScoreArrows";
import { useToast } from "./Toast";
import { Button, Card, cx, ErrorText, FieldLabel, inputClass } from "./ui";
import { WhenPicker } from "./WhenPicker";

export interface EditorOption {
  id: string;
  name: string;
  hidden?: boolean;
}

export interface EditorEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
}

interface StepDraft {
  key: string;
  id: string | null;
  title: string;
  done: boolean;
}

export function TaskEditor({
  initial,
  status,
  shapingDismissed,
  environments,
  states,
  events,
  tz,
}: {
  initial: TaskValue;
  status: TaskStatus | null;
  shapingDismissed: boolean;
  environments: EditorOption[];
  states: EditorOption[];
  events: EditorEvent[];
  tz: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<TaskValue>(initial);
  const [steps, setSteps] = useState<StepDraft[]>(
    initial.steps.map((s, i) => ({ key: s.id ?? `n${i}`, id: s.id ?? null, title: s.title, done: s.done })),
  );
  const [newStep, setNewStep] = useState("");
  const [hintHidden, setHintHidden] = useState(shapingDismissed);
  const [customLead, setCustomLead] = useState(initial.leadDays != null);

  const set = <K extends keyof TaskValue>(k: K, val: TaskValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const event = events.find((e) => e.id === v.eventId) ?? null;
  const now = useMemo(() => new Date(), []);
  const today = localDateString(now, tz);

  const conflict = useMemo(() => {
    if (!v.deadline || !event || !v.eventRelation) return null;
    try {
      const c = deadlineConflict(
        {
          effort: v.effort,
          leadDays: v.eventRelation === "before" && customLead ? (v.leadDays ?? null) : null,
          deadlineAt: resolveWhen("end", v.deadline, tz),
          eventRelation: v.eventRelation,
        },
        { id: event.id, name: event.name, startsAt: new Date(event.startsAt), endsAt: event.endsAt ? new Date(event.endsAt) : null },
        tz,
      );
      return c ? formatWhen(c.appearsAt, "exact", null, tz, now, "start") : null;
    } catch {
      return null;
    }
  }, [v.deadline, v.effort, v.leadDays, v.eventRelation, event, customLead, tz, now]);

  const defaultLead = leadDaysFor({ effort: v.effort, leadDays: null });
  const showHint =
    !hintHidden && v.effort >= priorityConfig.ordering.mixEffort.heavyEffort && (steps.length === 0 || !v.doneWhen);

  const addStep = () => {
    const title = newStep.trim();
    if (!title) return;
    setSteps((s) => [...s, { key: `n${Date.now()}`, id: null, title, done: false }]);
    setNewStep("");
  };
  const move = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const copyS = [...s];
      [copyS[i], copyS[j]] = [copyS[j]!, copyS[i]!];
      return copyS;
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: TaskValue = {
      ...v,
      eventRelation: v.eventId ? (v.eventRelation ?? "before") : null,
      leadDays: v.eventId && v.eventRelation === "before" && customLead ? (v.leadDays ?? defaultLead) : null,
      steps: steps.filter((s) => s.title.trim()).map((s) => ({ id: s.id, title: s.title.trim(), done: s.done })),
    };
    start(async () => {
      const res = await saveTask(payload);
      if (!res.ok) return setError(res.error);
      if (v.id) router.back();
      else router.push("/");
      router.refresh();
    });
  };

  const lifecycle = (action: LifecycleAction) =>
    start(async () => {
      if (!v.id) return;
      const res = await setTaskStatus(v.id, action);
      if (!res.ok) return setError(res.error);
      if (action === "delete") {
        const id = v.id;
        toast(copy.deleted(v.title), async () => {
          await setTaskStatus(id, "undelete");
          router.refresh();
        });
        router.push("/");
      }
      router.refresh();
    });

  const deadlineDefault: WhenValue = { date: today, precision: "day", part: null, time: null };

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <FieldLabel htmlFor="title">{copy.title}</FieldLabel>
        <input
          id="title"
          required
          maxLength={300}
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputClass}
          autoFocus={!v.id}
        />
      </div>

      <div>
        <FieldLabel htmlFor="done-when">{copy.doneWhen}</FieldLabel>
        <input
          id="done-when"
          maxLength={300}
          value={v.doneWhen ?? ""}
          placeholder={copy.doneWhenPlaceholder}
          onChange={(e) => set("doneWhen", e.target.value)}
          className={inputClass}
        />
      </div>

      {showHint && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
          <p>{copy.shapingHint}</p>
          <button
            type="button"
            className="shrink-0 text-xs text-muted hover:text-ink"
            onClick={() => {
              setHintHidden(true);
              if (v.id) void dismissShapingHint(v.id);
            }}
          >
            {copy.dismiss}
          </button>
        </div>
      )}

      <section>
        <p className="mb-1 text-sm font-medium">{copy.steps}</p>
        <ul className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Done: ${s.title}`}
                checked={s.done}
                onChange={(e) => setSteps((all) => all.map((x) => (x.key === s.key ? { ...x, done: e.target.checked } : x)))}
                className="size-5 accent-[var(--accent)]"
              />
              <input
                aria-label={`Step ${i + 1}`}
                value={s.title}
                maxLength={300}
                onChange={(e) => setSteps((all) => all.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))}
                className={cx(inputClass, "py-1.5", s.done && "text-muted line-through")}
              />
              <button type="button" aria-label={copy.moveUp} onClick={() => move(i, -1)} className="px-1 text-muted hover:text-ink">
                ↑
              </button>
              <button type="button" aria-label={copy.moveDown} onClick={() => move(i, 1)} className="px-1 text-muted hover:text-ink">
                ↓
              </button>
              <button
                type="button"
                aria-label={copy.removeStep}
                onClick={() => setSteps((all) => all.filter((x) => x.key !== s.key))}
                className="px-1 text-muted hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <label htmlFor="new-step" className="sr-only">
            {copy.addStep}
          </label>
          <input
            id="new-step"
            value={newStep}
            maxLength={300}
            placeholder={copy.stepPlaceholder}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addStep();
              }
            }}
            className={cx(inputClass, "py-1.5")}
          />
          <Button onClick={addStep} disabled={!newStep.trim()}>
            {copy.addStep}
          </Button>
        </div>
      </section>

      <section>
        <p className="mb-1 text-sm font-medium">{copy.scores}</p>
        <div className="flex flex-wrap gap-x-4">
          {(["effort", "impact", "urgency"] as const).map((f) => (
            <ScoreStepper key={f} label={scoreCopy[f].label} hint={scoreCopy[f].hint} value={v[f]} onChange={(n) => set(f, n)} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="environment">{copy.environment}</FieldLabel>
          <select
            id="environment"
            value={v.environmentId ?? ""}
            onChange={(e) => set("environmentId", e.target.value || null)}
            className={inputClass}
          >
            <option value="">{copy.none}</option>
            {environments
              .filter((o) => !o.hidden || o.id === v.environmentId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="state">{copy.state}</FieldLabel>
          <select id="state" value={v.stateId ?? ""} onChange={(e) => set("stateId", e.target.value || null)} className={inputClass}>
            <option value="">{copy.none}</option>
            {states
              .filter((o) => !o.hidden || o.id === v.stateId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <section>
        <p className="mb-1 text-sm font-medium">{copy.deadline}</p>
        {v.deadline ? (
          <div className="space-y-1">
            <WhenPicker label={copy.deadline} value={v.deadline} onChange={(w) => set("deadline", w)} />
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => set("deadline", null)}>
              {copy.removeDeadline}
            </button>
          </div>
        ) : (
          <Button onClick={() => set("deadline", deadlineDefault)}>{copy.addDeadline}</Button>
        )}
      </section>

      <section>
        <p className="mb-1 text-sm font-medium">{copy.event}</p>
        {events.length === 0 && !v.eventId ? (
          <p className="text-sm text-muted">{copy.noEvents}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <label htmlFor="relation" className="sr-only">
              {copy.relation}
            </label>
            <select
              id="relation"
              value={v.eventRelation ?? "before"}
              onChange={(e) => set("eventRelation", e.target.value as Relation)}
              className={`${inputClass} w-auto`}
              disabled={!v.eventId}
            >
              {(["before", "during", "after"] as const).map((r) => (
                <option key={r} value={r}>
                  {relations[r]}
                </option>
              ))}
            </select>
            <label htmlFor="event" className="sr-only">
              {copy.event}
            </label>
            <select
              id="event"
              value={v.eventId ?? ""}
              onChange={(e) =>
                setV((p) => ({ ...p, eventId: e.target.value || null, eventRelation: e.target.value ? (p.eventRelation ?? "before") : null }))
              }
              className={`${inputClass} w-auto min-w-40 flex-1`}
            >
              <option value="">{copy.linkEvent}</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {formatWhen(new Date(e.startsAt), "day", null, tz, now, "start")}
                </option>
              ))}
            </select>
          </div>
        )}
        {event && (v.eventRelation ?? "before") === "before" && (
          <div className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
            {customLead ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="lead-days">{copy.leadDays}</label>
                <input
                  id="lead-days"
                  type="number"
                  min={0}
                  max={365}
                  value={v.leadDays ?? defaultLead}
                  onChange={(e) => set("leadDays", Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                  className={`${inputClass} w-24 py-1`}
                />
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => {
                    setCustomLead(false);
                    set("leadDays", null);
                  }}
                >
                  {copy.leadUseDefault}
                </button>
              </div>
            ) : (
              <p>
                <span aria-hidden>ⓘ </span>
                {copy.leadInfo(defaultLead, event.name, v.effort >= 4)}{" "}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    setCustomLead(true);
                    set("leadDays", defaultLead);
                  }}
                >
                  {copy.leadOverride}
                </button>
              </p>
            )}
          </div>
        )}
        {conflict && <p className="mt-2 rounded-xl bg-warm-soft p-3 text-sm">{copy.conflict(conflict)}</p>}
      </section>

      <div>
        <FieldLabel htmlFor="description">{copy.description}</FieldLabel>
        <textarea
          id="description"
          rows={3}
          maxLength={5000}
          value={v.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? copy.saving : copy.save}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          {copy.cancel}
        </Button>
      </div>

      {v.id && status && (
        <Card className="flex flex-wrap gap-2">
          {status === "open" && (
            <>
              <Button onClick={() => lifecycle("done")} disabled={pending}>
                {copy.done}
              </Button>
              <Button onClick={() => lifecycle("let_go")} disabled={pending}>
                {copy.letGo}
              </Button>
            </>
          )}
          {status === "done" && (
            <Button onClick={() => lifecycle("undone")} disabled={pending}>
              {copy.undone}
            </Button>
          )}
          {(status === "let_go" || status === "deleted") && (
            <Button onClick={() => lifecycle("restore")} disabled={pending}>
              {copy.restore}
            </Button>
          )}
          {status !== "deleted" && (
            <Button variant="ghost" onClick={() => lifecycle("delete")} disabled={pending} className="ml-auto">
              {copy.delete}
            </Button>
          )}
        </Card>
      )}
    </form>
  );
}

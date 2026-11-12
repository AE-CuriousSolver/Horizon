"use client";

import { useState, useTransition } from "react";
import {
  addListItem,
  renameListItem,
  resetDemo,
  setListItemHidden,
  updateSettings,
} from "@/lib/data/actions";
import { adjustmentToggles, settings as copy } from "@/lib/copy/en-GB";
import type { AdjustmentKey } from "@/lib/priority/config";
import { Button, Card, cx, inputClass } from "./ui";

interface Item {
  id: string;
  name: string;
  hidden: boolean;
}

export function ListEditor({ kind, title, items }: { kind: "environments" | "states"; title: string; items: Item[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="font-medium">{title}</h2>
      <p className="mb-3 text-xs text-muted">{copy.listsHint}</p>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <ListRow key={i.id} kind={kind} item={i} />
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await addListItem(kind, name);
            if (res.ok) setName("");
            else setError(res.error);
          });
        }}
      >
        <label htmlFor={`add-${kind}`} className="sr-only">
          {copy.add}
        </label>
        <input
          id={`add-${kind}`}
          value={name}
          maxLength={60}
          placeholder={copy.addPlaceholder}
          onChange={(e) => setName(e.target.value)}
          className={cx(inputClass, "py-1.5")}
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {copy.add}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-warm">{error}</p>}
    </Card>
  );
}

function ListRow({ kind, item }: { kind: "environments" | "states"; item: Item }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className={cx("py-2", pending && "opacity-60")}>
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await renameListItem(kind, item.id, name);
              if (res.ok) setEditing(false);
              else setError(res.error);
            });
          }}
        >
          <label htmlFor={`rename-${item.id}`} className="sr-only">
            {copy.rename}
          </label>
          <input id={`rename-${item.id}`} autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={cx(inputClass, "py-1.5")} />
          <Button type="submit">{copy.save}</Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className={cx(item.hidden && "text-muted")}>
            {item.name}
            {item.hidden && <span className="ml-2 text-xs">({copy.hidden})</span>}
          </span>
          <span className="flex shrink-0 gap-3 text-sm">
            <button type="button" className="text-muted hover:text-ink" onClick={() => setEditing(true)}>
              {copy.rename}
            </button>
            <button
              type="button"
              className="text-muted hover:text-ink"
              onClick={() =>
                start(async () => {
                  const res = await setListItemHidden(kind, item.id, !item.hidden);
                  if (!res.ok) setError(res.error);
                })
              }
            >
              {item.hidden ? copy.show : copy.hide}
            </button>
          </span>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-warm">{error}</p>}
    </li>
  );
}

export function PreferencesForm({
  timezone,
  timezones,
  listSize,
  showWorkings,
  flags,
}: {
  timezone: string;
  timezones: string[];
  listSize: number;
  showWorkings: boolean;
  flags: Record<AdjustmentKey, boolean>;
}) {
  const [tz, setTz] = useState(timezone);
  const [size, setSize] = useState(String(listSize));
  const [workings, setWorkings] = useState(showWorkings);
  const [f, setF] = useState(flags);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setStatus(null);
          start(async () => {
            const res = await updateSettings({
              timezone: tz,
              focusListSize: Number(size),
              showWorkings: workings,
              flags: f,
            });
            setStatus(res.ok ? copy.saved : res.error);
          });
        }}
      >
        <div>
          <label htmlFor="tz" className="mb-1 block text-sm font-medium">
            {copy.timezone}
          </label>
          <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={inputClass}>
            {timezones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="size" className="mb-1 block text-sm font-medium">
            {copy.listSize}
          </label>
          <input
            id="size"
            type="number"
            min={1}
            max={100}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className={cx(inputClass, "w-28")}
          />
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={workings} onChange={(e) => setWorkings(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
          <span>
            <span className="block text-sm font-medium">{copy.showWorkings}</span>
            <span className="block text-xs text-muted">{copy.showWorkingsHint}</span>
          </span>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{copy.adjustments}</legend>
          <p className="text-xs text-muted">{copy.adjustmentsHint}</p>
          {(Object.keys(adjustmentToggles) as AdjustmentKey[]).map((k) => (
            <label key={k} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={f[k]}
                onChange={(e) => setF((p) => ({ ...p, [k]: e.target.checked }))}
                className="mt-1 size-5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm">{adjustmentToggles[k].label}</span>
                <span className="block text-xs text-muted">{adjustmentToggles[k].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {copy.save}
          </Button>
          {status && <span className="text-sm text-muted">{status}</span>}
        </div>
      </form>
    </Card>
  );
}

export function DemoReset() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <h2 className="font-medium">{copy.demo}</h2>
      <p className="mb-3 text-xs text-muted">{copy.resetDemoHint}</p>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resetDemo();
            setMsg(res.ok ? copy.saved : res.error);
          })
        }
      >
        {copy.resetDemo}
      </Button>
      {msg && <span className="ml-3 text-sm text-muted">{msg}</span>}
    </Card>
  );
}

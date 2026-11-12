"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveView } from "@/lib/data/actions";
import { filters as copy, radar } from "@/lib/copy/en-GB";
import type { RadarFilters } from "@/lib/board";
import { cx, inputClass } from "./ui";

interface Item {
  id: string;
  name: string;
}

interface ViewItem extends Item {
  filters: RadarFilters;
}

export function filtersToSearch(f: RadarFilters, viewId?: string | null): string {
  const p = new URLSearchParams();
  f.environmentIds.forEach((id) => p.append("env", id));
  f.stateIds.forEach((id) => p.append("state", id));
  if (f.overdueOnly) p.set("overdue", "1");
  if (viewId) p.set("view", viewId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "min-h-9 rounded-full border px-3 text-sm transition-colors",
        active ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  environments,
  states,
  views,
  filters,
  activeViewId,
}: {
  environments: Item[];
  states: Item[];
  views: ViewItem[];
  filters: RadarFilters;
  activeViewId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(
    filters.environmentIds.length > 0 || filters.stateIds.length > 0 || filters.overdueOnly,
  );
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const go = (next: RadarFilters, viewId: string | null = null) =>
    start(() => router.replace(`${pathname}${filtersToSearch(next, viewId)}`, { scroll: false }));

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const active = filters.environmentIds.length + filters.stateIds.length + (filters.overdueOnly ? 1 : 0);

  return (
    <div className={cx("mb-4", pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="view-picker">
          {copy.view}
        </label>
        <select
          id="view-picker"
          value={activeViewId ?? ""}
          onChange={(e) => {
            const v = views.find((x) => x.id === e.target.value);
            go(v ? v.filters : { environmentIds: [], stateIds: [], overdueOnly: false }, v?.id ?? null);
          }}
          className="min-h-9 rounded-full border border-line bg-surface px-3 text-sm"
        >
          <option value="">{copy.noView}</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-9 rounded-full border border-line px-3 text-sm text-muted hover:text-ink"
        >
          Filters{active ? ` · ${active}` : ""}
        </button>
        {active > 0 && (
          <button
            type="button"
            onClick={() => go({ environmentIds: [], stateIds: [], overdueOnly: false })}
            className="text-sm text-accent hover:underline"
          >
            {radar.clearFilters}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{copy.environment}</legend>
            <div className="flex flex-wrap gap-2">
              {environments.map((e) => (
                <Chip
                  key={e.id}
                  active={filters.environmentIds.includes(e.id)}
                  onClick={() => go({ ...filters, environmentIds: toggle(filters.environmentIds, e.id) })}
                >
                  {e.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{copy.state}</legend>
            <div className="flex flex-wrap gap-2">
              {states.map((s) => (
                <Chip
                  key={s.id}
                  active={filters.stateIds.includes(s.id)}
                  onClick={() => go({ ...filters, stateIds: toggle(filters.stateIds, s.id) })}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Chip active={filters.overdueOnly} onClick={() => go({ ...filters, overdueOnly: !filters.overdueOnly })}>
            {copy.overdueOnly}
          </Chip>

          {active > 0 && !activeViewId && (
            <div className="border-t border-line pt-3">
              {naming ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    start(async () => {
                      const res = await saveView(name, {
                        environment_ids: filters.environmentIds,
                        state_ids: filters.stateIds,
                        overdue_only: filters.overdueOnly,
                      });
                      if (res.ok) {
                        setNaming(false);
                        setName("");
                        router.replace(`${pathname}${filtersToSearch(filters, res.data?.id)}`, { scroll: false });
                      } else setError(res.error);
                    });
                  }}
                >
                  <label htmlFor="view-name" className="sr-only">
                    {copy.saveAsView}
                  </label>
                  <input
                    id="view-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={copy.viewNamePlaceholder}
                    maxLength={80}
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="min-h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-40"
                  >
                    {copy.save}
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setNaming(true)} className="text-sm text-accent hover:underline">
                  {copy.saveAsView}
                </button>
              )}
              {error && <p className="mt-2 text-sm text-warm">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

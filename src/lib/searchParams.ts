import type { RadarFilters } from "./board";

export type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function list(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.filter((x) => UUID.test(x));
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseFilters(sp: SearchParams): RadarFilters {
  return {
    environmentIds: list(sp.env),
    stateIds: list(sp.state),
    overdueOnly: first(sp.overdue) === "1",
  };
}

export function parsePages(sp: SearchParams): number {
  const n = Number(first(sp.pages));
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 50) : 1;
}

export function filtersToSearch(f: RadarFilters, viewId?: string | null, extra?: Record<string, string>): string {
  const p = new URLSearchParams();
  f.environmentIds.forEach((id) => p.append("env", id));
  f.stateIds.forEach((id) => p.append("state", id));
  if (f.overdueOnly) p.set("overdue", "1");
  if (viewId) p.set("view", viewId);
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

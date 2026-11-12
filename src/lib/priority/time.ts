import { TZDate } from "@date-fns/tz";
import { priorityConfig, type PriorityConfig } from "./config";
import type { Part, Precision, WhenInput } from "./types";

export const DAY_MS = 86_400_000;

function parseDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

function parseTime(time: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return [Number(m[1]), Number(m[2])];
}

/** The instant at a local wall-clock time in `tz`. Day overflow (e.g. day 32) rolls over. */
export function localInstant(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  return new Date(new TZDate(y, mo, d, h, mi, 0, 0, tz).getTime());
}

/** Local calendar parts of an instant in `tz`. */
export function localParts(instant: Date, tz: string) {
  const t = new TZDate(instant.getTime(), tz);
  return {
    year: t.getFullYear(),
    month: t.getMonth(),
    day: t.getDate(),
    hours: t.getHours(),
    minutes: t.getMinutes(),
    weekday: t.getDay(),
  };
}

/** YYYY-MM-DD for an instant in `tz`. */
export function localDateString(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function startOfLocalDay(instant: Date, tz: string): Date {
  const p = localParts(instant, tz);
  return localInstant(p.year, p.month, p.day, 0, 0, tz);
}

/** The next local midnight after the local day containing `instant`. */
export function endOfLocalDay(instant: Date, tz: string): Date {
  const p = localParts(instant, tz);
  return localInstant(p.year, p.month, p.day + 1, 0, 0, tz);
}

/** Move by whole local calendar days, keeping the wall-clock time (DST-safe). */
export function addLocalDays(instant: Date, days: number, tz: string): Date {
  const p = localParts(instant, tz);
  return localInstant(p.year, p.month, p.day + days, p.hours, p.minutes, tz);
}

/** Whole local calendar days from `from` to `to` (negative if `to` is earlier). */
export function localDayDiff(from: Date, to: Date, tz: string): number {
  const a = parseDate(localDateString(from, tz));
  const b = parseDate(localDateString(to, tz));
  return Math.round((Date.UTC(...b) - Date.UTC(...a)) / DAY_MS);
}

/**
 * Resolve a rough "when" to an instant.
 * Starts (event starts) resolve to the start of the chosen period;
 * ends (deadlines, event ends) resolve to the end, read as "by".
 */
export function resolveWhen(
  kind: "start" | "end",
  when: WhenInput,
  tz: string,
  config: PriorityConfig = priorityConfig,
): Date {
  const [y, mo, d] = parseDate(when.date);
  if (when.precision === "exact") {
    const [h, mi] = parseTime(when.time ?? "");
    return localInstant(y, mo, d, h, mi, tz);
  }
  if (when.precision === "part_of_day") {
    const part = when.part ?? "morning";
    const hours = config.partOfDay[part][kind];
    return localInstant(y, mo, d, hours, 0, tz);
  }
  return kind === "start"
    ? localInstant(y, mo, d, 0, 0, tz)
    : localInstant(y, mo, d + 1, 0, 0, tz);
}

/** Inverse of resolveWhen, for filling pickers from stored values. */
export function toWhenInput(
  kind: "start" | "end",
  instant: Date,
  precision: Precision,
  part: Part | null,
  tz: string,
): WhenInput {
  const anchor =
    kind === "end" && precision === "day" ? new Date(instant.getTime() - 1) : instant;
  const p = localParts(instant, tz);
  return {
    date: localDateString(anchor, tz),
    precision,
    part: precision === "part_of_day" ? part : null,
    time:
      precision === "exact"
        ? `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`
        : null,
  };
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

export function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

import { localDayDiff, localParts } from "./priority/time";
import type { Part, Precision } from "./priority/types";
import { partShort, reasons as reasonCopy } from "./copy/en-GB";
import type { Reason } from "./priority/reasons";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTime(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  const h = p.hours % 12 === 0 ? 12 : p.hours % 12;
  const suffix = p.hours < 12 ? "am" : "pm";
  return p.minutes === 0 ? `${h}${suffix}` : `${h}:${String(p.minutes).padStart(2, "0")}${suffix}`;
}

/** "today", "tomorrow", "Wed", "Wed 3 Dec", "3 Dec 2027" — relative to `now`. */
export function formatDay(instant: Date, tz: string, now: Date): string {
  const diff = localDayDiff(now, instant, tz);
  const p = localParts(instant, tz);
  const n = localParts(now, tz);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS[p.weekday]!;
  const base = `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
  return p.year === n.year ? base : `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/**
 * Describe a stored instant as the user chose it, never a fake precise time.
 * kind "end" = deadlines and event ends ("by"), "start" = event starts.
 */
export function formatWhen(
  instant: Date,
  precision: Precision,
  part: Part | null,
  tz: string,
  now: Date,
  kind: "start" | "end" = "end",
): string {
  // An "on the day" end is stored as the next midnight: show the day itself.
  const anchor = kind === "end" && precision === "day" ? new Date(instant.getTime() - 1) : instant;
  const day = formatDay(anchor, tz, now);
  if (precision === "part_of_day" && part) {
    return kind === "end" ? `${day}, by ${partShort[part]}` : `${day}, ${partShort[part]}`;
  }
  if (precision === "exact") {
    return kind === "end" ? `${day}, by ${formatTime(instant, tz)}` : `${day}, ${formatTime(instant, tz)}`;
  }
  return day;
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function reasonText(
  reason: Reason,
  deadline: { precision: Precision; part: Part | null } | null,
  tz: string,
  now: Date,
): string {
  switch (reason.key) {
    case "due":
      return reasonCopy.due(
        formatWhen(reason.date!, deadline?.precision ?? "day", deadline?.part ?? null, tz, now),
      );
    case "before_event":
      return reasonCopy.before_event(reason.eventName ?? "the event");
    case "during_event":
      return reasonCopy.during_event(reason.eventName ?? "the event");
    case "check_in_overdue":
    case "check_in_event_started":
    case "check_in_event_ended":
      return ""; // shown as the check-in prompt instead
    default:
      return reasonCopy[reason.key];
  }
}

/** Join task titles naturally: "A", "A and B", "A, B and 2 others". */
export function joinTitles(titles: string[]): string {
  const q = titles.map((t) => `"${t}"`);
  if (q.length <= 1) return q[0] ?? "";
  if (q.length === 2) return `${q[0]} and ${q[1]}`;
  if (q.length === 3) return `${q[0]}, ${q[1]} and ${q[2]}`;
  return `${q[0]}, ${q[1]} and ${q.length - 2} others`;
}

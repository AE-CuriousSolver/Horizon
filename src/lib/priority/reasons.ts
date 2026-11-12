/**
 * Picks the single "why it's here" line for a Radar task.
 * Returns a key and parameters; the wording lives in src/lib/copy/en-GB.ts.
 */
import { priorityConfig, type PriorityConfig } from "./config";
import type { OrderedItem } from "./order";
import { daysBetween } from "./time";

export type ReasonKey =
  | "check_in_overdue"
  | "check_in_event_started"
  | "check_in_event_ended"
  | "brought_forward"
  | "light_run"
  | "heavy_run"
  | "low_energy"
  | "quick_win"
  | "mix"
  | "due"
  | "before_event"
  | "during_event"
  | "urgent"
  | "matters"
  | "ready";

export interface Reason {
  key: ReasonKey;
  /** For deadline/check-in reasons. */
  date?: Date;
  /** For event reasons. */
  eventName?: string;
}

export function pickReason(
  item: OrderedItem,
  now: Date,
  config: PriorityConfig = priorityConfig,
): Reason {
  const v = item.visibility;
  const eventName = item.event?.name;

  if (v.kind === "check_in") {
    if (v.cause === "overdue") return { key: "check_in_overdue", date: v.since };
    if (v.cause === "event_started") return { key: "check_in_event_started", eventName };
    return { key: "check_in_event_ended", eventName };
  }

  const has = (id: OrderedItem["adjustments"][number]["id"]) =>
    item.adjustments.some((a) => a.id === id);
  if (has("brought_forward")) return { key: "brought_forward" };
  if (has("light_run")) return { key: "light_run" };
  if (has("heavy_run")) return { key: "heavy_run" };
  if (has("low_energy")) return { key: "low_energy" };
  if (has("quick_win")) return { key: "quick_win" };
  if (has("mix")) return { key: "mix" };

  const s = item.score;
  const largest = Math.max(s.urgency, s.impact, s.deadline, s.event);
  const d = item.task.deadlineAt;
  if (
    d &&
    s.deadline > 0 &&
    s.deadline === largest &&
    daysBetween(now, d) <= config.reasons.dueWithinDays
  ) {
    return { key: "due", date: d };
  }
  if (item.task.eventRelation === "before" && s.event > 0 && s.event === largest) {
    return { key: "before_event", eventName };
  }
  if (item.task.eventRelation === "during" && item.event) {
    return { key: "during_event", eventName };
  }
  if (item.task.urgency >= config.reasons.urgentAtLeast) return { key: "urgent" };
  if (item.task.impact >= config.reasons.mattersAtLeast) return { key: "matters" };
  return { key: "ready" };
}

/**
 * Layer 1: can this task be done now?
 * Pure: everything it needs is passed in, including `now`.
 */
import { priorityConfig, type PriorityConfig } from "./config";
import { addLocalDays, DAY_MS, endOfLocalDay, startOfLocalDay } from "./time";
import type { EventInput, Relation, TaskInput, Visibility } from "./types";

/** Lead time for a `before` link: the user's own number, or the effort default. */
export function leadDaysFor(
  task: Pick<TaskInput, "effort" | "leadDays">,
  config: PriorityConfig = priorityConfig,
): number {
  if (task.leadDays != null && task.leadDays >= 0) return task.leadDays;
  return config.visibility.leadDaysByEffort[task.effort] ?? 14;
}

export interface EventWindow {
  /** Task can appear from here (null = no lower bound). */
  from: Date | null;
  /** Task's moment has passed from here (null = never). */
  until: Date | null;
}

/** The window an event link allows, before any deadline is considered. */
export function eventWindow(
  task: Pick<TaskInput, "effort" | "leadDays">,
  relation: Relation,
  event: EventInput,
  tz: string,
  config: PriorityConfig = priorityConfig,
): EventWindow {
  switch (relation) {
    case "before":
      return {
        from: addLocalDays(event.startsAt, -leadDaysFor(task, config), tz),
        until: event.startsAt,
      };
    case "during":
      if (event.endsAt) return { from: event.startsAt, until: event.endsAt };
      // Single-day event: that whole local day.
      return {
        from: startOfLocalDay(event.startsAt, tz),
        until: endOfLocalDay(event.startsAt, tz),
      };
    case "after":
      return { from: event.endsAt ?? event.startsAt, until: null };
  }
}

/**
 * Where a task stands right now.
 * - closed: done, let go or deleted
 * - check_in: a deadline or event moment has passed; stays visible with a prompt
 * - hidden: not yet doable, with the moment it appears
 * - visible: on the Radar
 */
export function visibility(
  task: TaskInput,
  event: EventInput | null,
  now: Date,
  tz: string,
  config: PriorityConfig = priorityConfig,
): Visibility {
  if (task.status !== "open") return { kind: "closed" };

  // The deadline always wins as the hard limit.
  if (task.deadlineAt && now.getTime() >= task.deadlineAt.getTime()) {
    return { kind: "check_in", cause: "overdue", since: task.deadlineAt };
  }

  if (!event || !task.eventRelation) return { kind: "visible", since: null };

  const w = eventWindow(task, task.eventRelation, event, tz, config);

  if (w.until && now.getTime() >= w.until.getTime()) {
    return {
      kind: "check_in",
      cause: task.eventRelation === "before" ? "event_started" : "event_ended",
      since: w.until,
    };
  }

  if (w.from && now.getTime() < w.from.getTime()) {
    return {
      kind: "hidden",
      cause: task.eventRelation === "before" ? "lead_time" : "waiting_for_event",
      appearsAt: w.from,
    };
  }

  return { kind: "visible", since: w.from };
}

export function isOnRadar(v: Visibility): boolean {
  return v.kind === "visible" || v.kind === "check_in";
}

/** When an unanswered check-in will be let go by Horizon, or null if not a check-in. */
export function letGoDueAt(
  v: Visibility,
  config: PriorityConfig = priorityConfig,
): Date | null {
  if (v.kind !== "check_in") return null;
  return new Date(v.since.getTime() + config.visibility.checkInGraceDays * DAY_MS);
}

/**
 * Gentle save-time warning: the deadline falls before the task can first appear.
 * Returns the moment the task would appear, or null if there's no conflict.
 */
export function deadlineConflict(
  task: Pick<TaskInput, "effort" | "leadDays" | "deadlineAt" | "eventRelation">,
  event: EventInput | null,
  tz: string,
  config: PriorityConfig = priorityConfig,
): { appearsAt: Date } | null {
  if (!task.deadlineAt || !event || !task.eventRelation) return null;
  const w = eventWindow(task, task.eventRelation, event, tz, config);
  if (w.from && task.deadlineAt.getTime() <= w.from.getTime()) {
    return { appearsAt: w.from };
  }
  return null;
}

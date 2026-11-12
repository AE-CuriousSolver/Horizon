/**
 * Decisions Horizon makes on the user's behalf. Pure: the caller applies them
 * and writes the Notes.
 */
import { priorityConfig, type PriorityConfig } from "./config";
import type { AdjustmentId, OrderedItem } from "./order";
import { letGoDueAt, visibility } from "./visibility";
import type { EventInput, TaskInput, Visibility } from "./types";

/** Unanswered check-ins that have passed their grace period. */
export function dueForLetGo(
  tasks: TaskInput[],
  eventsById: ReadonlyMap<string, EventInput>,
  now: Date,
  tz: string,
  config: PriorityConfig = priorityConfig,
): { taskId: string; letGoAt: Date }[] {
  const out: { taskId: string; letGoAt: Date }[] = [];
  for (const t of tasks) {
    const event = t.eventId ? (eventsById.get(t.eventId) ?? null) : null;
    const due = letGoDueAt(visibility(t, event, now, tz, config), config);
    if (due && now.getTime() >= due.getTime()) out.push({ taskId: t.id, letGoAt: due });
  }
  return out;
}

export type OrderingNoteKind = "brought_forward" | "light_run_boost" | "heavy_run_boost" | "quick_win";

const NOTE_FOR: Partial<Record<AdjustmentId, OrderingNoteKind>> = {
  brought_forward: "brought_forward",
  light_run: "light_run_boost",
  heavy_run: "heavy_run_boost",
  quick_win: "quick_win",
};

/** The adjustment a note kind reverses, for "Put it back". */
export const ADJUSTMENT_FOR_NOTE: Record<OrderingNoteKind, AdjustmentId> = {
  brought_forward: "brought_forward",
  light_run_boost: "light_run",
  heavy_run_boost: "heavy_run",
  quick_win: "quick_win",
};

/**
 * Big-picture ordering notes for the tasks currently shown (top `listSize`).
 * Mix and low-energy don't write notes; they're small and shown in the reason line.
 */
export function orderingNoteCandidates(
  ordered: OrderedItem[],
  listSize: number,
): Map<OrderingNoteKind, string[]> {
  const out = new Map<OrderingNoteKind, string[]>();
  for (const item of ordered.slice(0, listSize)) {
    for (const adj of item.adjustments) {
      const kind = NOTE_FOR[adj.id];
      if (!kind) continue;
      const ids = out.get(kind) ?? [];
      if (!ids.includes(item.task.id)) ids.push(item.task.id);
      out.set(kind, ids);
    }
  }
  return out;
}

/** Tasks that were on the Radar before an edit and are hidden by an event rule after it. */
export function newlyHiddenByEvent(
  before: ReadonlyMap<string, Visibility>,
  after: ReadonlyMap<string, Visibility>,
): string[] {
  const out: string[] = [];
  for (const [id, prev] of before) {
    const next = after.get(id);
    if ((prev.kind === "visible" || prev.kind === "check_in") && next?.kind === "hidden") {
      out.push(id);
    }
  }
  return out;
}

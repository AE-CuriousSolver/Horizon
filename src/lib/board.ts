/**
 * Builds the Radar and Orbit from rows + the pure priority model.
 * No I/O here: everything (including `now`) is passed in, and the output is
 * plain serialisable data for the UI.
 */
import { adjustmentNames, checkIn as checkInCopy, orbit as orbitCopy } from "@/lib/copy/en-GB";
import { capitalise, formatDay, formatWhen, reasonText } from "@/lib/format";
import type { PriorityConfig } from "@/lib/priority/config";
import { orderingNoteCandidates, type OrderingNoteKind } from "@/lib/priority/housekeeping";
import { orderTasks, type OrderInputItem, type OrderedItem } from "@/lib/priority/order";
import { pickReason } from "@/lib/priority/reasons";
import { localDayDiff } from "@/lib/priority/time";
import type { DoneRecord, EventInput, Visibility } from "@/lib/priority/types";
import { leadDaysFor, visibility } from "@/lib/priority/visibility";
import { nextOpenStep, statusOf, toTaskInput, type ListItemRow, type TaskRow } from "@/lib/data/rows";

export interface RadarFilters {
  environmentIds: string[];
  stateIds: string[];
  overdueOnly: boolean;
}

export const NO_FILTERS: RadarFilters = { environmentIds: [], stateIds: [], overdueOnly: false };

export function hasFilters(f: RadarFilters): boolean {
  return f.environmentIds.length > 0 || f.stateIds.length > 0 || f.overdueOnly;
}

/**
 * A task with no environment or state matches every filter.
 * Within a filter, any selected item matches (OR); across filters, all must match (AND).
 */
export function matchesFilters(
  task: Pick<TaskRow, "environment_id" | "state_id">,
  v: Visibility,
  f: RadarFilters,
): boolean {
  if (f.environmentIds.length && task.environment_id && !f.environmentIds.includes(task.environment_id)) {
    return false;
  }
  if (f.stateIds.length && task.state_id && !f.stateIds.includes(task.state_id)) return false;
  if (f.overdueOnly && !(v.kind === "check_in" && v.cause === "overdue")) return false;
  return true;
}

export interface WorkingLine {
  label: string;
  points: number;
}

export interface CardModel {
  id: string;
  title: string;
  /** Next open step if any, else the title. */
  headline: string;
  /** Task title, when the headline is a step. */
  subheading: string | null;
  hasOpenStep: boolean;
  effort: number;
  impact: number;
  urgency: number;
  reason: string;
  checkIn: { cause: "overdue" | "event_started" | "event_ended"; text: string } | null;
  workings: { lines: WorkingLine[]; total: number; effectiveDeadline: string | null } | null;
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function checkInText(item: OrderedItem, row: TaskRow, tz: string, now: Date): string {
  const v = item.visibility;
  if (v.kind !== "check_in") return "";
  const eventName = item.event?.name ?? "The event";
  if (v.cause === "event_started") return checkInCopy.eventStarted(eventName);
  if (v.cause === "event_ended") return checkInCopy.eventEnded(eventName);
  // Overdue: name the day the user chose.
  const anchor = row.deadline_precision === "day" ? new Date(v.since.getTime() - 1) : v.since;
  return checkInCopy.overdue(capitalise(formatDay(anchor, tz, now)));
}

function toCard(item: OrderedItem, row: TaskRow, tz: string, now: Date, showWorkings: boolean, config: PriorityConfig): CardModel {
  const step = nextOpenStep(row);
  const reason = pickReason(item, now, config);
  const deadline = row.deadline_precision
    ? { precision: row.deadline_precision, part: row.deadline_part }
    : null;
  const s = item.score;
  return {
    id: row.id,
    title: row.title,
    headline: step ? step.title : row.title,
    subheading: step ? row.title : null,
    hasOpenStep: !!step,
    effort: row.effort,
    impact: row.impact,
    urgency: row.urgency,
    reason: reasonText(reason, deadline, tz, now),
    checkIn:
      item.visibility.kind === "check_in"
        ? { cause: item.visibility.cause, text: checkInText(item, row, tz, now) }
        : null,
    workings: showWorkings
      ? {
          lines: [
            { label: "Urgency", points: round(s.urgency) },
            { label: "Impact", points: round(s.impact) },
            { label: "Deadline pressure", points: round(s.deadline) },
            { label: "Event pressure", points: round(s.event) },
            ...item.adjustments.map((a) => ({
              label:
                a.id === "brought_forward" && a.shiftDays
                  ? `${adjustmentNames[a.id]} (${round(a.shiftDays)} days earlier)`
                  : adjustmentNames[a.id],
              points: round(a.points),
            })),
          ],
          total: round(item.adjusted),
          effectiveDeadline: item.effectiveDeadline
            ? formatWhen(item.effectiveDeadline, "exact", null, tz, now)
            : null,
        }
      : null,
  };
}

export interface RadarInput {
  tasks: TaskRow[];
  events: ReadonlyMap<string, EventInput>;
  states: ListItemRow[];
  filters: RadarFilters;
  recentDone: DoneRecord[];
  suppressed: ReadonlySet<string>;
  listSize: number;
  /** How many cards to show (list size × pages). */
  limit: number;
  showWorkings: boolean;
  now: Date;
  tz: string;
  config: PriorityConfig;
}

export interface RadarModel {
  cards: CardModel[];
  total: number;
  /** Open tasks on the Radar before filters (for the all-clear message). */
  unfilteredTotal: number;
  noteCandidates: [OrderingNoteKind, string[]][];
}

export function buildRadar(input: RadarInput): RadarModel {
  const { now, tz, config } = input;
  const rowsById = new Map(input.tasks.map((t) => [t.id, t]));
  const lowEnergyIds = new Set(input.states.filter((s) => s.preset_key === "low_energy").map((s) => s.id));

  const onRadar: OrderInputItem[] = [];
  let unfilteredTotal = 0;
  for (const row of input.tasks) {
    if (statusOf(row) !== "open") continue;
    const task = toTaskInput(row);
    const event = task.eventId ? (input.events.get(task.eventId) ?? null) : null;
    const v = visibility(task, event, now, tz, config);
    if (v.kind !== "visible" && v.kind !== "check_in") continue;
    unfilteredTotal += 1;
    if (!matchesFilters(row, v, input.filters)) continue;
    onRadar.push({ task, event, visibility: v });
  }

  const ordered = orderTasks(onRadar, {
    now,
    recentDone: input.recentDone,
    lowEnergy: input.filters.stateIds.some((id) => lowEnergyIds.has(id)),
    suppressed: input.suppressed,
    listSize: input.listSize,
    config,
  });

  const shown = ordered.slice(0, input.limit);
  return {
    cards: shown.map((item) => toCard(item, rowsById.get(item.task.id)!, tz, now, input.showWorkings, config)),
    total: ordered.length,
    unfilteredTotal,
    noteCandidates: [...orderingNoteCandidates(ordered, input.listSize).entries()],
  };
}

// ---------------------------------------------------------------------------
// Orbit
// ---------------------------------------------------------------------------

export interface OrbitItem {
  id: string;
  title: string;
  effort: number;
  impact: number;
  urgency: number;
  note: string | null;
  stepsDone: number;
  stepsTotal: number;
}

export interface OrbitModel {
  visible: OrbitItem[];
  hidden: OrbitItem[];
  done: OrbitItem[];
  letGo: OrbitItem[];
}

function hiddenNote(row: TaskRow, v: Visibility, event: EventInput | null, tz: string, now: Date, config: PriorityConfig) {
  if (v.kind !== "hidden" || !event) return null;
  if (row.event_relation === "before") {
    return orbitCopy.appearsBefore(leadDaysFor({ effort: row.effort, leadDays: row.lead_days }, config), event.name);
  }
  if (row.event_relation === "during") return orbitCopy.appearsWhen(event.name);
  if (row.event_relation === "after") {
    return localDayDiff(now, v.appearsAt, tz) > 6
      ? orbitCopy.appearsAfter(event.name)
      : orbitCopy.appearsOn(formatWhen(v.appearsAt, "exact", null, tz, now, "start"));
  }
  return null;
}

export function buildOrbit(
  tasks: TaskRow[],
  events: ReadonlyMap<string, EventInput>,
  now: Date,
  tz: string,
  config: PriorityConfig,
): OrbitModel {
  const out: OrbitModel = { visible: [], hidden: [], done: [], letGo: [] };
  for (const row of tasks) {
    const status = statusOf(row);
    const base = {
      id: row.id,
      title: row.title,
      effort: row.effort,
      impact: row.impact,
      urgency: row.urgency,
      stepsDone: (row.steps ?? []).filter((s) => s.done_at).length,
      stepsTotal: (row.steps ?? []).length,
    };
    if (status === "done") {
      out.done.push({ ...base, note: formatWhen(new Date(row.done_at!), "day", null, tz, now, "start") });
    } else if (status === "let_go") {
      out.letGo.push({ ...base, note: orbitCopy.letGoBy[row.let_go_by ?? "user"] });
    } else if (status === "open") {
      const task = toTaskInput(row);
      const event = task.eventId ? (events.get(task.eventId) ?? null) : null;
      const v = visibility(task, event, now, tz, config);
      if (v.kind === "hidden") out.hidden.push({ ...base, note: hiddenNote(row, v, event, tz, now, config) });
      else out.visible.push({ ...base, note: null });
    }
  }
  const byRecent = (key: "done_at" | "let_go_at") => (a: OrbitItem, b: OrbitItem) => {
    const ra = tasks.find((t) => t.id === a.id)![key]!;
    const rb = tasks.find((t) => t.id === b.id)![key]!;
    return rb.localeCompare(ra);
  };
  out.done.sort(byRecent("done_at"));
  out.letGo.sort(byRecent("let_go_at"));
  return out;
}

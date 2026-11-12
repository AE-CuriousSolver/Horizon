import { visibility } from "../visibility";
import type { OrderInputItem } from "../order";
import type { EventInput, TaskInput } from "../types";
import { DAY_MS } from "../time";

export const TZ = "Australia/Sydney";
/** Thursday 12 Nov 2026, 10:00 in Sydney (AEDT, UTC+11). */
export const NOW = new Date("2026-11-11T23:00:00Z");

export const days = (n: number, from: Date = NOW) => new Date(from.getTime() + n * DAY_MS);

let seq = 0;
export function task(overrides: Partial<TaskInput> = {}): TaskInput {
  seq += 1;
  return {
    id: overrides.id ?? `t${seq}`,
    title: overrides.title ?? `Task ${seq}`,
    effort: 3,
    impact: 3,
    urgency: 3,
    deadlineAt: null,
    eventId: null,
    eventRelation: null,
    leadDays: null,
    status: "open",
    createdAt: days(-1),
    waitingSince: days(-1),
    openSteps: 0,
    ...overrides,
  };
}

export function event(overrides: Partial<EventInput> = {}): EventInput {
  seq += 1;
  return {
    id: overrides.id ?? `e${seq}`,
    name: overrides.name ?? "Holiday",
    startsAt: days(10),
    endsAt: null,
    ...overrides,
  };
}

/** Wrap tasks as order input, computing their real visibility at NOW. */
export function items(
  list: { task: TaskInput; event?: EventInput | null }[],
  now: Date = NOW,
): OrderInputItem[] {
  return list.map(({ task: t, event: e = null }) => {
    const v = visibility(t, e, now, TZ);
    if (v.kind !== "visible" && v.kind !== "check_in") {
      throw new Error(`fixture task ${t.title} is not on the Radar (${v.kind})`);
    }
    return { task: t, event: e, visibility: v };
  });
}

export const baseCtx = {
  now: NOW,
  recentDone: [],
  lowEnergy: false,
  suppressed: new Set<string>(),
  listSize: 10,
};

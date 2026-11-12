import "server-only";
import { getEvents, getLists, getSession } from "@/lib/data/load";
import { toWhenInput } from "@/lib/priority/time";
import { sortedSteps, statusOf, type TaskRow } from "@/lib/data/rows";
import type { TaskValue } from "@/lib/validation";

export async function editorOptions() {
  const [{ tz }, lists, { rows }] = await Promise.all([getSession(), getLists(), getEvents()]);
  const now = Date.now();
  // Upcoming and current events first; past ones after.
  const events = rows
    .map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at, endsAt: e.ends_at }))
    .sort((a, b) => {
      const aPast = new Date(a.endsAt ?? a.startsAt).getTime() < now;
      const bPast = new Date(b.endsAt ?? b.startsAt).getTime() < now;
      return Number(aPast) - Number(bPast) || a.startsAt.localeCompare(b.startsAt);
    });
  return {
    tz,
    environments: lists.environments.map((e) => ({ id: e.id, name: e.name, hidden: !!e.hidden_at })),
    states: lists.states.map((s) => ({ id: s.id, name: s.name, hidden: !!s.hidden_at })),
    events,
  };
}

export function taskToValue(t: TaskRow, tz: string): TaskValue {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    doneWhen: t.done_when,
    effort: t.effort,
    impact: t.impact,
    urgency: t.urgency,
    environmentId: t.environment_id,
    stateId: t.state_id,
    deadline:
      t.deadline_at && t.deadline_precision
        ? toWhenInput("end", new Date(t.deadline_at), t.deadline_precision, t.deadline_part, tz)
        : null,
    eventId: t.event_id,
    eventRelation: t.event_relation,
    leadDays: t.lead_days,
    steps: sortedSteps(t).map((s) => ({ id: s.id, title: s.title, done: !!s.done_at })),
  };
}

export { statusOf };

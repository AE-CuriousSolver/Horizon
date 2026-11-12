import { describe, expect, it } from "vitest";
import { buildOrbit, buildRadar, matchesFilters, NO_FILTERS } from "../board";
import { priorityConfig } from "../priority/config";
import { resolveWhen } from "../priority/time";
import type { ListItemRow, TaskRow } from "../data/rows";
import type { EventInput } from "../priority/types";

const TZ = "Australia/Sydney";
const NOW = new Date("2026-11-11T23:00:00Z"); // Thu 12 Nov, 10:00 Sydney
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

let n = 0;
function row(over: Partial<TaskRow> = {}): TaskRow {
  n += 1;
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    title: `Task ${n}`,
    description: null,
    done_when: null,
    effort: 3,
    impact: 3,
    urgency: 3,
    environment_id: null,
    state_id: null,
    deadline_at: null,
    deadline_precision: null,
    deadline_part: null,
    event_id: null,
    event_relation: null,
    lead_days: null,
    done_at: null,
    let_go_at: null,
    let_go_by: null,
    deleted_at: null,
    waiting_since: day(-1),
    shaping_hint_dismissed_at: null,
    created_at: day(-1),
    updated_at: day(-1),
    steps: [],
    ...over,
  };
}

const states: ListItemRow[] = [
  { id: "s-focused", name: "Focused", preset_key: "focused", hidden_at: null },
  { id: "s-low", name: "Running on empty", preset_key: "low_energy", hidden_at: null },
];

const base = {
  events: new Map<string, EventInput>(),
  states,
  filters: NO_FILTERS,
  recentDone: [],
  suppressed: new Set<string>(),
  listSize: 10,
  limit: 10,
  showWorkings: false,
  now: NOW,
  tz: TZ,
  config: priorityConfig,
};

describe("filters", () => {
  const visible = { kind: "visible", since: null } as const;
  const overdue = { kind: "check_in", cause: "overdue", since: NOW } as const;

  it("a task with no environment or state matches every filter", () => {
    expect(matchesFilters(row(), visible, { environmentIds: ["e1"], stateIds: ["s1"], overdueOnly: false })).toBe(true);
  });

  it("environments and states are exact, multi-select (OR within, AND across)", () => {
    const t = row({ environment_id: "e1", state_id: "s1" });
    expect(matchesFilters(t, visible, { environmentIds: ["e1", "e2"], stateIds: [], overdueOnly: false })).toBe(true);
    expect(matchesFilters(t, visible, { environmentIds: ["e2"], stateIds: [], overdueOnly: false })).toBe(false);
    expect(matchesFilters(t, visible, { environmentIds: ["e1"], stateIds: ["s2"], overdueOnly: false })).toBe(false);
  });

  it("overdue only shows overdue check-ins", () => {
    expect(matchesFilters(row(), visible, { ...NO_FILTERS, overdueOnly: true })).toBe(false);
    expect(matchesFilters(row(), overdue, { ...NO_FILTERS, overdueOnly: true })).toBe(true);
  });
});

describe("Radar", () => {
  it("shows the next open step as the headline and the title as the subheading", () => {
    const t = row({
      title: "Tax return",
      steps: [
        { id: "a", task_id: "x", title: "Gather receipts", position: 1, done_at: day(-1) },
        { id: "b", task_id: "x", title: "Download statements", position: 2, done_at: null },
      ],
    });
    const plain = row({ title: "Plain task" });
    const { cards } = buildRadar({ ...base, tasks: [t, plain] });
    const tax = cards.find((c) => c.id === t.id)!;
    expect(tax.headline).toBe("Download statements");
    expect(tax.subheading).toBe("Tax return");
    const p = cards.find((c) => c.id === plain.id)!;
    expect(p.headline).toBe("Plain task");
    expect(p.subheading).toBeNull();
  });

  it("caps the list and reports the total", () => {
    const tasks = Array.from({ length: 14 }, () => row());
    const m = buildRadar({ ...base, tasks });
    expect(m.cards).toHaveLength(10);
    expect(m.total).toBe(14);
  });

  it("leaves out closed and hidden tasks", () => {
    const ev = { id: "ev", name: "Holiday", startsAt: new Date(day(30)), endsAt: null };
    const tasks = [
      row({ done_at: day(-1) }),
      row({ let_go_at: day(-1), let_go_by: "user" }),
      row({ deleted_at: day(-1) }),
      row({ event_id: "ev", event_relation: "after" }),
      row({ title: "Visible" }),
    ];
    const m = buildRadar({ ...base, tasks, events: new Map([["ev", ev]]) });
    expect(m.cards.map((c) => c.title)).toEqual(["Visible"]);
  });

  it("recognises the Low energy preset even after renaming", () => {
    const tasks = [row({ title: "Heavy", effort: 5, urgency: 4 }), row({ title: "Light", effort: 1, urgency: 3 })];
    const m = buildRadar({ ...base, tasks, filters: { ...NO_FILTERS, stateIds: ["s-low"] } });
    expect(m.cards[0]!.title).toBe("Light");
    expect(m.cards[0]!.reason).toMatch(/low-energy/);
  });

  it("phrases check-ins about the situation", () => {
    const sunday = resolveWhen("end", { date: "2026-11-08", precision: "day" }, TZ).toISOString();
    const m = buildRadar({ ...base, tasks: [row({ deadline_at: sunday, deadline_precision: "day" })] });
    expect(m.cards[0]!.checkIn?.text).toBe("Sun 8 Nov has been and gone. Still need this?");
  });

  it("explains the workings when asked", () => {
    const m = buildRadar({ ...base, showWorkings: true, tasks: [row()] });
    expect(m.cards[0]!.workings?.lines.map((l) => l.label)).toEqual([
      "Urgency",
      "Impact",
      "Deadline pressure",
      "Event pressure",
    ]);
  });
});

describe("Orbit", () => {
  it("groups everything, with the reason a task is hidden", () => {
    const ev = { id: "ev", name: "Holiday", startsAt: new Date(day(30)), endsAt: new Date(day(37)) };
    const tasks = [
      row({ title: "Visible" }),
      row({ title: "Pack", effort: 5, event_id: "ev", event_relation: "before" }),
      row({ title: "Done", done_at: day(-1) }),
      row({ title: "Gone", let_go_at: day(-1), let_go_by: "horizon" }),
      row({ title: "Deleted", deleted_at: day(-1) }),
    ];
    const o = buildOrbit(tasks, new Map([["ev", ev]]), NOW, TZ, priorityConfig);
    expect(o.visible.map((t) => t.title)).toEqual(["Visible"]);
    expect(o.hidden[0]!.note).toBe("Appears 21 days before Holiday");
    expect(o.done.map((t) => t.title)).toEqual(["Done"]);
    expect(o.letGo[0]!.note).toBe("Let go by Horizon");
  });
});

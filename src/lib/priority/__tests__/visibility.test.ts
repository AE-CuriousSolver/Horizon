import { describe, expect, it } from "vitest";
import { deadlineConflict, leadDaysFor, letGoDueAt, visibility } from "../visibility";
import { scoreTask } from "../score";
import { resolveWhen } from "../time";
import { days, event, NOW, task, TZ } from "./fixtures";

const at = (d: Date) => (t: ReturnType<typeof task>, e: ReturnType<typeof event> | null) =>
  visibility(t, e, d, TZ);

describe("layer 1: no links", () => {
  it("a plain task is always visible", () => {
    expect(visibility(task(), null, NOW, TZ).kind).toBe("visible");
  });

  it("deadline only: visible until the deadline, then a check-in (overdue)", () => {
    const t = task({ deadlineAt: days(3) });
    expect(visibility(t, null, NOW, TZ).kind).toBe("visible");
    const later = visibility(t, null, days(4), TZ);
    expect(later).toMatchObject({ kind: "check_in", cause: "overdue" });
  });

  it.each(["done", "let_go", "deleted"] as const)("a %s task is never visible", (status) => {
    expect(visibility(task({ status }), null, NOW, TZ).kind).toBe("closed");
    expect(visibility(task({ status, deadlineAt: days(-3) }), null, NOW, TZ).kind).toBe("closed");
  });
});

describe("layer 1: before", () => {
  const holiday = event({ startsAt: days(30), endsAt: days(40) });

  it("lead time follows effort: 1–2 → 7 days, 3 → 14, 4–5 → 21", () => {
    expect([1, 2, 3, 4, 5].map((effort) => leadDaysFor({ effort, leadDays: null }))).toEqual([
      7, 7, 14, 21, 21,
    ]);
  });

  it("a user-set number of days overrides the effort default", () => {
    expect(leadDaysFor({ effort: 5, leadDays: 3 })).toBe(3);
    expect(leadDaysFor({ effort: 1, leadDays: 0 })).toBe(0);
  });

  it("is hidden until the lead time, then visible", () => {
    const small = task({ effort: 1, eventId: holiday.id, eventRelation: "before" });
    const big = task({ effort: 5, eventId: holiday.id, eventRelation: "before" });
    // 22 days before: neither
    expect(at(days(8))(small, holiday)).toMatchObject({ kind: "hidden", cause: "lead_time" });
    expect(at(days(8))(big, holiday).kind).toBe("hidden");
    // 20 days before: big only
    expect(at(days(10))(big, holiday).kind).toBe("visible");
    expect(at(days(10))(small, holiday).kind).toBe("hidden");
    // 6 days before: both
    expect(at(days(24))(small, holiday).kind).toBe("visible");
  });

  it("reports when a hidden task will appear", () => {
    const t = task({ effort: 5, eventId: holiday.id, eventRelation: "before" });
    const v = visibility(t, holiday, NOW, TZ);
    expect(v.kind === "hidden" && v.appearsAt.toISOString()).toBe(days(9).toISOString());
  });

  it("once the event starts it becomes a check-in, never 'overdue'", () => {
    const t = task({ effort: 1, eventId: holiday.id, eventRelation: "before" });
    expect(at(days(31))(t, holiday)).toMatchObject({ kind: "check_in", cause: "event_started" });
  });

  it("urgency rises gently as the event nears", () => {
    const t = task({ effort: 5, eventId: holiday.id, eventRelation: "before" });
    const far = scoreTask(t, holiday, days(10)).event;
    const near = scoreTask(t, holiday, days(28)).event;
    expect(far).toBe(0);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(15);
  });
});

describe("layer 1: during", () => {
  const range = event({ startsAt: days(10), endsAt: days(17) });

  it("range: visible only while the event is on", () => {
    const t = task({ eventId: range.id, eventRelation: "during" });
    expect(at(days(9))(t, range)).toMatchObject({ kind: "hidden", cause: "waiting_for_event" });
    expect(at(days(12))(t, range).kind).toBe("visible");
    expect(at(days(18))(t, range)).toMatchObject({ kind: "check_in", cause: "event_ended" });
  });

  it("single day with an exact time: visible for that whole local day", () => {
    // Dinner with John, Sat 21 Nov 7pm
    const dinner = event({
      name: "Dinner with John",
      startsAt: resolveWhen("start", { date: "2026-11-21", precision: "exact", time: "19:00" }, TZ),
    });
    const t = task({ eventId: dinner.id, eventRelation: "during" });
    const morning = resolveWhen("start", { date: "2026-11-21", precision: "exact", time: "08:00" }, TZ);
    const dayBefore = resolveWhen("start", { date: "2026-11-20", precision: "exact", time: "23:00" }, TZ);
    const nextDay = resolveWhen("start", { date: "2026-11-22", precision: "exact", time: "00:30" }, TZ);
    expect(visibility(t, dinner, dayBefore, TZ).kind).toBe("hidden");
    expect(visibility(t, dinner, morning, TZ).kind).toBe("visible");
    expect(visibility(t, dinner, nextDay, TZ)).toMatchObject({ kind: "check_in", cause: "event_ended" });
  });
});

describe("layer 1: after", () => {
  it("range: visible once the event has ended", () => {
    const range = event({ startsAt: days(10), endsAt: days(17) });
    const t = task({ eventId: range.id, eventRelation: "after" });
    expect(at(days(12))(t, range).kind).toBe("hidden");
    expect(at(days(17.5))(t, range).kind).toBe("visible");
    expect(at(days(400))(t, range).kind).toBe("visible");
  });

  it("single day: visible once it has started", () => {
    const dinner = event({
      startsAt: resolveWhen("start", { date: "2026-11-21", precision: "exact", time: "19:00" }, TZ),
    });
    const t = task({ eventId: dinner.id, eventRelation: "after" });
    const before7 = resolveWhen("start", { date: "2026-11-21", precision: "exact", time: "18:59" }, TZ);
    const after7 = resolveWhen("start", { date: "2026-11-21", precision: "exact", time: "19:00" }, TZ);
    expect(visibility(t, dinner, before7, TZ).kind).toBe("hidden");
    expect(visibility(t, dinner, after7, TZ).kind).toBe("visible");
  });
});

describe("layer 1: event + deadline", () => {
  it("the birthday-card example", () => {
    // Holiday Mon 16 – Sat 21 Nov. Card linked `during`, deadline Sunday 22 Nov by evening.
    const holiday = event({
      startsAt: resolveWhen("start", { date: "2026-11-16", precision: "day" }, TZ),
      endsAt: resolveWhen("end", { date: "2026-11-21", precision: "day" }, TZ),
    });
    const card = task({
      title: "Send birthday card",
      impact: 4,
      urgency: 2,
      eventId: holiday.id,
      eventRelation: "during",
      deadlineAt: resolveWhen(
        "end",
        { date: "2026-11-22", precision: "part_of_day", part: "evening" },
        TZ,
      ),
    });
    const local = (date: string, time = "10:00") =>
      resolveWhen("start", { date, precision: "exact", time }, TZ);

    // Hidden until the holiday starts.
    expect(visibility(card, holiday, local("2026-11-15"), TZ).kind).toBe("hidden");
    // Visible during it, with urgency driven by Sunday.
    const tue = local("2026-11-17");
    const fri = local("2026-11-20");
    expect(visibility(card, holiday, tue, TZ).kind).toBe("visible");
    expect(scoreTask(card, holiday, fri).deadline).toBeGreaterThan(scoreTask(card, holiday, tue).deadline);
    expect(scoreTask(card, holiday, fri).event).toBe(0);
    // Holiday over, Sunday not yet passed: a check-in about the holiday.
    expect(visibility(card, holiday, local("2026-11-22", "09:00"), TZ)).toMatchObject({
      kind: "check_in",
      cause: "event_ended",
    });
    // After Sunday evening: overdue, which takes precedence.
    expect(visibility(card, holiday, local("2026-11-22", "22:30"), TZ)).toMatchObject({
      kind: "check_in",
      cause: "overdue",
    });
  });

  it("an overdue task shows even when its event window hasn't opened", () => {
    const later = event({ startsAt: days(10) });
    const t = task({ eventId: later.id, eventRelation: "after", deadlineAt: days(-1) });
    expect(visibility(t, later, NOW, TZ)).toMatchObject({ kind: "check_in", cause: "overdue" });
  });
});

describe("conflicts", () => {
  it("warns when the deadline comes before the task can appear", () => {
    const e = event({ startsAt: days(10) });
    const t = { effort: 3, leadDays: null, deadlineAt: days(5), eventRelation: "after" as const };
    expect(deadlineConflict(t, e, TZ)?.appearsAt.toISOString()).toBe(days(10).toISOString());
  });

  it("no warning when the deadline is reachable", () => {
    const e = event({ startsAt: days(10) });
    expect(
      deadlineConflict({ effort: 3, leadDays: null, deadlineAt: days(12), eventRelation: "after" }, e, TZ),
    ).toBeNull();
    expect(
      deadlineConflict({ effort: 3, leadDays: null, deadlineAt: days(8), eventRelation: "before" }, e, TZ),
    ).toBeNull();
  });
});

describe("check-in grace", () => {
  it("is let go after 14 days, not 13", () => {
    const t = task({ deadlineAt: days(-1) });
    const v = visibility(t, null, NOW, TZ);
    const due = letGoDueAt(v)!;
    expect(due.toISOString()).toBe(days(13).toISOString());
    expect(days(12).getTime() < due.getTime()).toBe(true);
  });

  it("visible tasks have no let-go date", () => {
    expect(letGoDueAt(visibility(task(), null, NOW, TZ))).toBeNull();
  });
});

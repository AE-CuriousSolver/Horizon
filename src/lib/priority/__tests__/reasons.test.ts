import { describe, expect, it } from "vitest";
import { orderTasks } from "../order";
import { pickReason } from "../reasons";
import {
  dueForLetGo,
  newlyHiddenByEvent,
  orderingNoteCandidates,
} from "../housekeeping";
import { visibility } from "../visibility";
import { baseCtx, days, event, items, NOW, task, TZ } from "./fixtures";

const reasonOf = (list: ReturnType<typeof items>, ctx = baseCtx) =>
  orderTasks(list, ctx).map((i) => [i.task.title, pickReason(i, ctx.now).key]);

describe("why it's here", () => {
  it("picks one line per task, by precedence", () => {
    const holiday = event({ name: "Holiday", startsAt: days(3) });
    const during = event({ name: "Fair", startsAt: days(-1), endsAt: days(3) });
    const out = Object.fromEntries(
      reasonOf(
        items([
          { task: task({ title: "overdue", deadlineAt: days(-1) }) },
          { task: task({ title: "due", urgency: 1, impact: 5, deadlineAt: days(2) }) },
          { task: task({ title: "urgent", urgency: 5, impact: 2 }) },
          { task: task({ title: "matters", urgency: 2, impact: 5 }) },
          { task: task({ title: "plain", urgency: 2, impact: 2 }) },
          { task: task({ title: "quick", effort: 1, impact: 1, urgency: 2, waitingSince: days(-10) }) },
          { task: task({ title: "before", urgency: 1, impact: 1, effort: 1, eventId: holiday.id, eventRelation: "before" }), event: holiday },
          { task: task({ title: "during", urgency: 2, impact: 2, eventId: during.id, eventRelation: "during" }), event: during },
        ]),
      ),
    );
    expect(out).toMatchObject({
      overdue: "check_in_overdue",
      due: "due",
      urgent: "urgent",
      matters: "matters",
      plain: "ready",
      quick: "quick_win",
      before: "before_event",
      during: "during_event",
    });
  });

  it("names the event for event check-ins", () => {
    const holiday = event({ name: "Holiday", startsAt: days(-5), endsAt: days(-1) });
    const ordered = orderTasks(
      items([{ task: task({ eventId: holiday.id, eventRelation: "during" }), event: holiday }]),
      baseCtx,
    );
    expect(pickReason(ordered[0]!, NOW)).toEqual({ key: "check_in_event_ended", eventName: "Holiday" });
  });
});

describe("housekeeping", () => {
  it("lets go unanswered check-ins after the grace period, stamped at the grace end", () => {
    const old = task({ id: "old", deadlineAt: days(-15) });
    const recent = task({ id: "recent", deadlineAt: days(-13) });
    const fine = task({ id: "fine" });
    const out = dueForLetGo([old, recent, fine], new Map(), NOW, TZ);
    expect(out.map((o) => o.taskId)).toEqual(["old"]);
    expect(out[0]!.letGoAt.toISOString()).toBe(days(-1).toISOString());
  });

  it("includes passed-event check-ins", () => {
    const e = event({ id: "ev", startsAt: days(-30), endsAt: days(-20) });
    const t = task({ id: "x", eventId: "ev", eventRelation: "during" });
    expect(dueForLetGo([t], new Map([["ev", e]]), NOW, TZ).map((o) => o.taskId)).toEqual(["x"]);
  });

  it("writes ordering note candidates only for tasks in the shown list", () => {
    const ordered = orderTasks(
      items([
        { task: task({ id: "q1", title: "q1", effort: 1, impact: 1, waitingSince: days(-10) }) },
        { task: task({ id: "top", title: "top", urgency: 5, impact: 5 }) },
      ]),
      baseCtx,
    );
    expect(orderingNoteCandidates(ordered, 10).get("quick_win")).toEqual(["q1"]);
    const onlyTop = orderingNoteCandidates(ordered, 1);
    expect(onlyTop.get("quick_win") ?? []).toEqual(ordered[0]!.task.id === "q1" ? ["q1"] : []);
  });

  it("detects tasks hidden by an event edit", () => {
    const t = task({ id: "a", eventRelation: "after", eventId: "e" });
    const before = new Map([["a", visibility(t, event({ id: "e", startsAt: days(-1) }), NOW, TZ)]]);
    const after = new Map([["a", visibility(t, event({ id: "e", startsAt: days(5) }), NOW, TZ)]]);
    expect(newlyHiddenByEvent(before, after)).toEqual(["a"]);
    expect(newlyHiddenByEvent(after, before)).toEqual([]);
  });
});

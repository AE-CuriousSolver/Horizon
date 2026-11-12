import { describe, expect, it } from "vitest";
import { priorityConfig, withFlags } from "../config";
import { orderTasks, suppressionKey, type OrderedItem } from "../order";
import { baseCtx, days, event, items, NOW, task } from "./fixtures";

const ids = (list: OrderedItem[]) => list.map((i) => i.task.title);
const adj = (list: OrderedItem[], title: string) =>
  list.find((i) => i.task.title === title)!.adjustments.map((a) => a.id);
const off = (key: string) => withFlags({ [key]: false });

describe("layer 3: sorting basics", () => {
  it("orders by score, highest first", () => {
    const out = orderTasks(
      items([
        { task: task({ title: "low", urgency: 1, impact: 1 }) },
        { task: task({ title: "high", urgency: 5, impact: 5 }) },
        { task: task({ title: "mid", urgency: 3, impact: 3 }) },
      ]),
      baseCtx,
    );
    expect(ids(out)).toEqual(["high", "mid", "low"]);
  });

  it("check-ins stay on top regardless of score, overdue first", () => {
    const holiday = event({ startsAt: days(-10), endsAt: days(-2) });
    const out = orderTasks(
      items([
        { task: task({ title: "important", urgency: 5, impact: 5 }) },
        { task: task({ title: "holiday over", urgency: 1, impact: 1, eventId: holiday.id, eventRelation: "during" }), event: holiday },
        { task: task({ title: "overdue", urgency: 1, impact: 1, deadlineAt: days(-1) }) },
      ]),
      baseCtx,
    );
    expect(ids(out)).toEqual(["overdue", "holiday over", "important"]);
  });

  it("is stable: ties break on deadline, then age", () => {
    const out = orderTasks(
      items([
        { task: task({ title: "newer", createdAt: days(-1) }) },
        { task: task({ title: "older", createdAt: days(-3) }) },
      ]),
      { ...baseCtx, config: withFlags({ quickWin: false, mixEffort: false }) },
    );
    expect(ids(out)).toEqual(["older", "newer"]);
  });
});

describe("layer 3: quick-win bump", () => {
  const waiting = () =>
    task({ title: "quick", effort: 1, impact: 1, urgency: 2, waitingSince: days(-10) });

  it("fires for a small, low-impact task that has waited a while", () => {
    const peer = task({ title: "peer", effort: 3, impact: 2, urgency: 2, waitingSince: days(-10) });
    const out = orderTasks(items([{ task: peer }, { task: waiting() }]), baseCtx);
    expect(adj(out, "quick")).toContain("quick_win");
    expect(ids(out)[0]).toBe("quick");
  });

  it("grows with the wait, up to a maximum", () => {
    const at = (d: number) =>
      orderTasks(items([{ task: task({ title: "q", effort: 1, impact: 1, waitingSince: days(-d) }) }]), baseCtx)[0]!
        .adjustments[0]!.points;
    expect(at(14)).toBeGreaterThan(at(7));
    expect(at(60)).toBe(priorityConfig.ordering.quickWin.maxBump);
  });

  it("doesn't fire for a fresh task", () => {
    const out = orderTasks(items([{ task: task({ title: "q", effort: 1, impact: 1, waitingSince: days(-2) }) }]), baseCtx);
    expect(adj(out, "q")).not.toContain("quick_win");
  });

  it("doesn't fire for an important or heavy task", () => {
    const out = orderTasks(
      items([
        { task: task({ title: "big", effort: 4, impact: 1, waitingSince: days(-30) }) },
        { task: task({ title: "matters", effort: 1, impact: 4, waitingSince: days(-30) }) },
      ]),
      baseCtx,
    );
    expect(adj(out, "big")).not.toContain("quick_win");
    expect(adj(out, "matters")).not.toContain("quick_win");
  });

  it("counts the wait from when the task became visible", () => {
    const e = event({ startsAt: days(-3), endsAt: days(5) });
    const t = task({ title: "q", effort: 1, impact: 1, waitingSince: days(-60), eventId: e.id, eventRelation: "during" });
    const out = orderTasks(items([{ task: t, event: e }]), baseCtx);
    expect(adj(out, "q")).not.toContain("quick_win");
  });

  it("respects its flag and a per-task suppression", () => {
    const t = waiting();
    expect(adj(orderTasks(items([{ task: t }]), { ...baseCtx, config: off("quickWin") }), "quick")).toEqual([]);
    const suppressed = new Set([suppressionKey(t.id, "quick_win")]);
    expect(adj(orderTasks(items([{ task: t }]), { ...baseCtx, suppressed }), "quick")).toEqual([]);
  });
});

describe("layer 3: effort balance", () => {
  const done = (effort: number, ago = 1) => ({ effort, at: days(-ago) });
  const list = () =>
    items([
      { task: task({ title: "light", effort: 1, impact: 3, urgency: 3, waitingSince: days(-1) }) },
      { task: task({ title: "heavy", effort: 5, impact: 3, urgency: 3, waitingSince: days(-10) }) },
    ]);

  it("after a heavy run, lighter tasks get a boost", () => {
    const out = orderTasks(list(), { ...baseCtx, recentDone: [done(5), done(4), done(5)] });
    expect(adj(out, "light")).toContain("heavy_run");
    expect(adj(out, "heavy")).not.toContain("heavy_run");
  });

  it("after a run of light wins, a heavy task that's been waiting gets a boost", () => {
    const out = orderTasks(list(), { ...baseCtx, recentDone: [done(1), done(2), done(1), done(1)] });
    expect(adj(out, "heavy")).toContain("light_run");
    expect(ids(out)[0]).toBe("heavy");
  });

  it("a fresh heavy task isn't pushed after a light run", () => {
    const fresh = items([{ task: task({ title: "heavy", effort: 5, waitingSince: days(-1) }) }]);
    const out = orderTasks(fresh, { ...baseCtx, recentDone: [done(1), done(1), done(1)] });
    expect(adj(out, "heavy")).not.toContain("light_run");
  });

  it("doesn't fire with too few or too old completions, or a mixed run", () => {
    for (const recentDone of [
      [done(5), done(5)],
      [done(5, 5), done(5, 6), done(5, 7)],
      [done(5), done(1), done(3)],
    ]) {
      const out = orderTasks(list(), { ...baseCtx, recentDone });
      expect(adj(out, "light")).not.toContain("heavy_run");
      expect(adj(out, "heavy")).not.toContain("light_run");
    }
  });

  it("the Low energy filter lifts lighter tasks", () => {
    const out = orderTasks(list(), { ...baseCtx, lowEnergy: true });
    expect(adj(out, "light")).toContain("low_energy");
    expect(adj(out, "heavy")).not.toContain("low_energy");
    expect(orderTasks(list(), baseCtx).flatMap((i) => i.adjustments.map((a) => a.id))).not.toContain(
      "low_energy",
    );
  });

  it("respects its flag", () => {
    const out = orderTasks(list(), {
      ...baseCtx,
      lowEnergy: true,
      recentDone: [done(5), done(5), done(5)],
      config: off("effortBalance"),
    });
    expect(out.flatMap((i) => i.adjustments)).toEqual([]);
  });
});

describe("layer 3: spread deadline clusters", () => {
  const cluster = () =>
    items([
      { task: task({ title: "big", effort: 5, openSteps: 4, deadlineAt: days(8) }) },
      { task: task({ title: "medium", effort: 3, deadlineAt: days(9) }) },
      { task: task({ title: "small", effort: 1, deadlineAt: days(10) }) },
    ]);

  it("brings the heavier tasks in a bunch forward, the lightest stays put", () => {
    const out = orderTasks(cluster(), baseCtx);
    const big = out.find((i) => i.task.title === "big")!;
    const medium = out.find((i) => i.task.title === "medium")!;
    expect(adj(out, "big")).toContain("brought_forward");
    expect(adj(out, "medium")).toContain("brought_forward");
    expect(adj(out, "small")).not.toContain("brought_forward");
    const shift = (i: OrderedItem) => i.adjustments.find((a) => a.id === "brought_forward")!.shiftDays!;
    expect(shift(big)).toBeGreaterThan(shift(medium));
    expect(shift(big)).toBeLessThanOrEqual(priorityConfig.ordering.spreadClusters.maxShiftDays);
    expect(big.effectiveDeadline!.getTime()).toBeLessThan(big.task.deadlineAt!.getTime());
  });

  it("doesn't fire for two deadlines, spread-out deadlines, or far-off ones", () => {
    for (const list of [
      items([
        { task: task({ title: "a", effort: 5, deadlineAt: days(8) }) },
        { task: task({ title: "b", effort: 5, deadlineAt: days(9) }) },
      ]),
      items([
        { task: task({ title: "a", effort: 5, deadlineAt: days(2) }) },
        { task: task({ title: "b", effort: 5, deadlineAt: days(6) }) },
        { task: task({ title: "c", effort: 5, deadlineAt: days(10) }) },
      ]),
      items([
        { task: task({ title: "a", effort: 5, deadlineAt: days(30) }) },
        { task: task({ title: "b", effort: 5, deadlineAt: days(31) }) },
        { task: task({ title: "c", effort: 5, deadlineAt: days(32) }) },
      ]),
    ]) {
      expect(orderTasks(list, baseCtx).flatMap((i) => i.adjustments.map((a) => a.id))).not.toContain(
        "brought_forward",
      );
    }
  });

  it("respects its flag", () => {
    const out = orderTasks(cluster(), { ...baseCtx, config: off("spreadClusters") });
    expect(out.flatMap((i) => i.adjustments.map((a) => a.id))).not.toContain("brought_forward");
  });
});

describe("layer 3: mix effort", () => {
  const list = (lightUrgency = 4) =>
    items([
      { task: task({ title: "heavy A", effort: 5, urgency: 5, impact: 4 }) },
      { task: task({ title: "heavy B", effort: 5, urgency: 5, impact: 4 }) },
      { task: task({ title: "light", effort: 2, urgency: lightUrgency, impact: 4 }) },
    ]);
  const noOthers = withFlags({ quickWin: false, effortBalance: false, spreadClusters: false });

  it("interleaves a lighter task between heavy ones", () => {
    const out = orderTasks(list(), { ...baseCtx, config: noOthers });
    expect(ids(out)).toEqual(["heavy A", "light", "heavy B"]);
    expect(adj(out, "light")).toContain("mix");
  });

  it("never displaces a much more important heavy task", () => {
    const out = orderTasks(list(1), { ...baseCtx, config: noOthers });
    expect(ids(out)).toEqual(["heavy A", "heavy B", "light"]);
  });

  it("does nothing when heavy tasks aren't back to back", () => {
    const out = orderTasks(
      items([
        { task: task({ title: "heavy", effort: 5, urgency: 5 }) },
        { task: task({ title: "light", effort: 1, urgency: 4 }) },
      ]),
      { ...baseCtx, config: noOthers },
    );
    expect(out.flatMap((i) => i.adjustments)).toEqual([]);
  });

  it("respects its flag", () => {
    const out = orderTasks(list(), {
      ...baseCtx,
      config: withFlags({ quickWin: false, effortBalance: false, spreadClusters: false, mixEffort: false }),
    });
    expect(ids(out)).toEqual(["heavy A", "heavy B", "light"]);
  });
});

describe("layer 3: inputs", () => {
  it("only orders what it's given (filtering happens first)", () => {
    expect(orderTasks([], baseCtx)).toEqual([]);
  });

  it("uses `now` from the context", () => {
    const t = task({ title: "d", deadlineAt: days(3) });
    const early = orderTasks(items([{ task: t }]), baseCtx)[0]!.adjusted;
    const late = orderTasks(items([{ task: t }], days(2)), { ...baseCtx, now: days(2) })[0]!.adjusted;
    expect(late).toBeGreaterThan(early);
    expect(NOW).toBeInstanceOf(Date);
  });
});

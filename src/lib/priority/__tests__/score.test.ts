import { describe, expect, it } from "vitest";
import { scoreTask } from "../score";
import { resolveWhen } from "../time";
import { days, NOW, task, TZ } from "./fixtures";

const HIGH = 50;

const toiletPaper = task({ title: "Buy toilet paper", urgency: 5, impact: 2, effort: 1 });
const taxReturn = task({ title: "Submit tax return", urgency: 4, impact: 4, effort: 4, deadlineAt: days(120) });
// Wednesday 18 Nov 2026, by end of day.
const wednesday = resolveWhen("end", { date: "2026-11-18", precision: "day" }, TZ);
const zoo = task({ title: "Book zoo tickets", urgency: 1, impact: 1, effort: 1, deadlineAt: wednesday });
const ordinary = task({ urgency: 2, impact: 2 });

describe("layer 2: the brief's three examples", () => {
  it("toilet paper is high, driven by urgency", () => {
    const s = scoreTask(toiletPaper, null, NOW);
    expect(s.total).toBeGreaterThanOrEqual(HIGH);
    expect(s.urgency).toBeGreaterThan(s.impact + s.deadline);
  });

  it("tax return is high now, driven by urgency, not the far deadline", () => {
    const s = scoreTask(taxReturn, null, NOW);
    expect(s.total).toBeGreaterThanOrEqual(HIGH);
    expect(s.deadline).toBe(0);
    expect(s.urgency).toBeGreaterThan(s.impact);
  });

  it("zoo tickets rise to moderate near Wednesday, but only as a nudge", () => {
    const farAway = scoreTask({ ...zoo, deadlineAt: days(30) }, null, NOW).total;
    const now = scoreTask(zoo, null, NOW).total; // 6 days out
    const tuesday = scoreTask(zoo, null, days(5)).total;
    const wedMorning = scoreTask(zoo, null, days(6)).total;
    expect(now).toBeGreaterThan(farAway);
    expect(tuesday).toBeGreaterThan(now);
    expect(wedMorning).toBeGreaterThan(tuesday);
    // moderate: around an ordinary task, never near the high band
    expect(wedMorning).toBeGreaterThanOrEqual(scoreTask(ordinary, null, days(6)).total);
    expect(wedMorning).toBeLessThan(scoreTask(toiletPaper, null, days(6)).total);
    expect(wedMorning).toBeLessThan(scoreTask(taxReturn, null, days(6)).total);
  });

  it("deadline pressure is scaled by impact: a high-impact deadline pushes hard", () => {
    const lowGain = scoreTask(zoo, null, days(5)).deadline;
    const highGain = scoreTask({ ...zoo, impact: 5 }, null, days(5)).deadline;
    expect(lowGain).toBeLessThan(highGain / 2);
  });
});

describe("layer 2: properties", () => {
  it("effort is neutral: E1 and E5 score identically", () => {
    for (const t of [toiletPaper, taxReturn, zoo]) {
      expect(scoreTask({ ...t, effort: 5 } as typeof t, null, NOW).total).toBe(
        scoreTask({ ...t, effort: 1 } as typeof t, null, NOW).total,
      );
    }
  });

  it("overdue is the highest deadline pressure", () => {
    const overdue = scoreTask(task({ impact: 3, deadlineAt: days(-2) }), null, NOW).deadline;
    const tomorrow = scoreTask(task({ impact: 3, deadlineAt: days(1) }), null, NOW).deadline;
    expect(overdue).toBeGreaterThan(tomorrow);
  });

  it("deadlines beyond the horizon add nothing", () => {
    expect(scoreTask(task({ deadlineAt: days(15) }), null, NOW).deadline).toBe(0);
  });

  it("urgency and impact both raise the score", () => {
    const base = scoreTask(task(), null, NOW).total;
    expect(scoreTask(task({ urgency: 4 }), null, NOW).total).toBeGreaterThan(base);
    expect(scoreTask(task({ impact: 4 }), null, NOW).total).toBeGreaterThan(base);
  });

  it("the deadline wins over a before-event's soft pressure", () => {
    const e = { id: "e", name: "Holiday", startsAt: days(2), endsAt: null };
    const withDeadline = scoreTask(
      task({ eventId: "e", eventRelation: "before", deadlineAt: days(30) }),
      e,
      NOW,
    );
    expect(withDeadline.event).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  endOfLocalDay,
  localDateString,
  resolveWhen,
  startOfLocalDay,
  toWhenInput,
} from "../time";

const TZ = "Australia/Sydney";

describe("part-of-day conversions", () => {
  // 15 Nov 2026 is AEDT (UTC+11)
  it("'on the day' deadline is due at the next local midnight", () => {
    const d = resolveWhen("end", { date: "2026-11-15", precision: "day" }, TZ);
    expect(d.toISOString()).toBe("2026-11-15T13:00:00.000Z");
  });

  it("deadline parts resolve to the end of the part", () => {
    const m = resolveWhen("end", { date: "2026-11-15", precision: "part_of_day", part: "morning" }, TZ);
    const md = resolveWhen("end", { date: "2026-11-15", precision: "part_of_day", part: "midday" }, TZ);
    const e = resolveWhen("end", { date: "2026-11-15", precision: "part_of_day", part: "evening" }, TZ);
    expect(m.toISOString()).toBe("2026-11-15T01:00:00.000Z"); // 12:00
    expect(md.toISOString()).toBe("2026-11-15T06:00:00.000Z"); // 17:00
    expect(e.toISOString()).toBe("2026-11-15T11:00:00.000Z"); // 22:00
  });

  it("event starts resolve to the start of the part", () => {
    const day = resolveWhen("start", { date: "2026-11-15", precision: "day" }, TZ);
    const ev = resolveWhen("start", { date: "2026-11-15", precision: "part_of_day", part: "evening" }, TZ);
    expect(day.toISOString()).toBe("2026-11-14T13:00:00.000Z"); // local midnight
    expect(ev.toISOString()).toBe("2026-11-15T06:00:00.000Z"); // 17:00
  });

  it("exact time is used as given", () => {
    const d = resolveWhen("end", { date: "2026-11-15", precision: "exact", time: "15:30" }, TZ);
    expect(d.toISOString()).toBe("2026-11-15T04:30:00.000Z");
  });

  it("rolls over month ends", () => {
    const d = resolveWhen("end", { date: "2026-11-30", precision: "day" }, TZ);
    expect(localDateString(d, TZ)).toBe("2026-12-01");
  });

  it("round-trips through the picker values", () => {
    const cases = [
      ["end", { date: "2026-11-15", precision: "day", part: null, time: null }],
      ["end", { date: "2026-11-15", precision: "part_of_day", part: "evening", time: null }],
      ["start", { date: "2026-11-15", precision: "exact", part: null, time: "07:05" }],
    ] as const;
    for (const [kind, when] of cases) {
      const instant = resolveWhen(kind, when, TZ);
      expect(toWhenInput(kind, instant, when.precision, when.part, TZ)).toEqual(when);
    }
  });

  it("handles the Sydney DST start (4 Oct 2026, 02:00 → 03:00)", () => {
    const start = resolveWhen("start", { date: "2026-10-04", precision: "day" }, TZ);
    const end = resolveWhen("end", { date: "2026-10-04", precision: "day" }, TZ);
    expect(start.toISOString()).toBe("2026-10-03T14:00:00.000Z"); // +10
    expect(end.toISOString()).toBe("2026-10-04T13:00:00.000Z"); // +11
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("handles the Sydney DST end (5 Apr 2026)", () => {
    const start = resolveWhen("start", { date: "2026-04-05", precision: "day" }, TZ);
    const end = resolveWhen("end", { date: "2026-04-05", precision: "day" }, TZ);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it("local day helpers", () => {
    const t = new Date("2026-11-15T20:00:00Z"); // 16 Nov 07:00 local
    expect(localDateString(t, TZ)).toBe("2026-11-16");
    expect(startOfLocalDay(t, TZ).toISOString()).toBe("2026-11-15T13:00:00.000Z");
    expect(endOfLocalDay(t, TZ).toISOString()).toBe("2026-11-16T13:00:00.000Z");
    // 21 local days earlier is 26 Oct 07:00 local, still AEDT
    expect(addLocalDays(t, -21, TZ).toISOString()).toBe("2026-10-25T20:00:00.000Z");
  });

  it("works in other timezones", () => {
    const d = resolveWhen("end", { date: "2026-11-15", precision: "day" }, "Europe/London");
    expect(d.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
});

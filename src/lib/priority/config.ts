/**
 * Every weight, threshold, boundary and on/off flag used by the priority model.
 * The README explains the model in plain language; PLAN.md §5 explains the maths.
 * Tune here. Nothing else in the codebase hard-codes these numbers.
 */

export type AdjustmentKey =
  | "quickWin"
  | "effortBalance"
  | "spreadClusters"
  | "mixEffort";

export const ADJUSTMENT_KEYS: AdjustmentKey[] = [
  "quickWin",
  "effortBalance",
  "spreadClusters",
  "mixEffort",
];

export const priorityConfig = {
  /** Part-of-day boundaries, in local hours. Starts are used for event starts; ends for deadlines and event ends. */
  partOfDay: {
    morning: { start: 0, end: 12 },
    midday: { start: 12, end: 17 },
    evening: { start: 17, end: 22 },
  },

  /** Layer 1: visibility */
  visibility: {
    /** `before` lead time in days, by effort. */
    leadDaysByEffort: { 1: 7, 2: 7, 3: 14, 4: 21, 5: 21 } as Record<number, number>,
    /** Days a check-in can go unanswered before Horizon lets the task go. */
    checkInGraceDays: 14,
  },

  /** Layer 2: priority score */
  score: {
    urgencyWeight: 45,
    impactWeight: 35,
    deadlineWeight: 60,
    deadlineHorizonDays: 14,
    eventWeight: 15,
    eventHorizonDays: 7,
    /** Share of deadline/event pressure a low-impact (1) task still gets. */
    impactFloor: 0.4,
    /** Exponent of the pressure curve: higher = flatter early, steeper late. */
    curveShape: 2,
  },

  /** Layer 3: ordering. Each adjustment has an on/off flag. */
  ordering: {
    flags: {
      quickWin: true,
      effortBalance: true,
      spreadClusters: true,
      mixEffort: true,
    } as Record<AdjustmentKey, boolean>,

    quickWin: {
      maxEffort: 2,
      maxImpact: 2,
      afterDays: 7,
      fullAfterDays: 21,
      minBump: 8,
      maxBump: 20,
    },

    effortBalance: {
      windowDays: 3,
      minDone: 3,
      /** Share of recent completions that makes a "run". */
      runShare: 2 / 3,
      heavyEffort: 4,
      lightEffort: 2,
      heavyRunBump: 10,
      lightRunBump: 10,
      /** A heavy task must have waited this long before a light run lifts it. */
      lightRunMinWaitDays: 7,
      /** Low energy: +perPoint for each effort point below 5. */
      lowEnergyPerPoint: 4,
    },

    spreadClusters: {
      lookaheadDays: 14,
      windowDays: 3,
      minTasks: 3,
      /** How much each open step counts towards a task's load (effort counts 1 per point). */
      stepLoad: 0.5,
      daysPerTask: 1,
      maxShiftDays: 5,
    },

    mixEffort: {
      heavyEffort: 4,
      lightMaxEffort: 3,
      maxHeavyInARow: 1,
      lookahead: 3,
      maxScoreGap: 15,
      /** Scan depth as a multiple of the Radar list size. */
      scanMultiple: 2,
    },

    /** Days an ordering adjustment stays switched off for a task after "Put it back". */
    suppressionDays: 7,
  },

  reasons: {
    dueWithinDays: 7,
    urgentAtLeast: 4,
    mattersAtLeast: 4,
  },

  /** Quick capture defaults. */
  defaultScores: { effort: 3, impact: 3, urgency: 3 },
  defaultListSize: 10,
  defaultTimezone: "Australia/Sydney",
} as const;

export type PriorityConfig = typeof priorityConfig;

/** Merge a user's on/off overrides (profiles.adjustment_flags) over the defaults. */
export function withFlags(
  overrides: Partial<Record<string, unknown>> | null | undefined,
  base: PriorityConfig = priorityConfig,
): PriorityConfig {
  const flags = { ...base.ordering.flags };
  for (const key of ADJUSTMENT_KEYS) {
    const v = overrides?.[key];
    if (typeof v === "boolean") flags[key] = v;
  }
  return { ...base, ordering: { ...base.ordering, flags } };
}

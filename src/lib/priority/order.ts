/**
 * Layer 3: given everything visible (and filtered), and what's been happening,
 * what's a good sequence? Starts from the layer 2 score and applies gentle,
 * explainable, individually switchable adjustments.
 */
import { priorityConfig, type AdjustmentKey, type PriorityConfig } from "./config";
import { scoreTask, type ScoreBreakdown } from "./score";
import { DAY_MS, daysBetween, maxDate } from "./time";
import type { DoneRecord, EventInput, TaskInput, Visibility } from "./types";

export type AdjustmentId =
  | "quick_win"
  | "heavy_run"
  | "light_run"
  | "low_energy"
  | "brought_forward"
  | "mix";

/** Which config flag controls each adjustment. */
export const ADJUSTMENT_FLAG: Record<AdjustmentId, AdjustmentKey> = {
  quick_win: "quickWin",
  heavy_run: "effortBalance",
  light_run: "effortBalance",
  low_energy: "effortBalance",
  brought_forward: "spreadClusters",
  mix: "mixEffort",
};

export interface Adjustment {
  id: AdjustmentId;
  points: number;
  /** For brought_forward: how many days earlier. */
  shiftDays?: number;
}

export interface OrderInputItem {
  task: TaskInput;
  event: EventInput | null;
  /** Must be "visible" or "check_in". */
  visibility: Extract<Visibility, { kind: "visible" } | { kind: "check_in" }>;
}

export interface OrderContext {
  now: Date;
  /** Recent completions, with effort at the time. Older entries are ignored. */
  recentDone: DoneRecord[];
  /** True when the active State filter includes the "Low energy" preset. */
  lowEnergy: boolean;
  /** `${taskId}:${adjustmentId}` pairs the user has asked to put back. */
  suppressed: ReadonlySet<string>;
  listSize: number;
  config?: PriorityConfig;
}

export interface OrderedItem extends OrderInputItem {
  score: ScoreBreakdown;
  adjustments: Adjustment[];
  adjusted: number;
  effectiveDeadline: Date | null;
}

export const suppressionKey = (taskId: string, id: AdjustmentId) => `${taskId}:${id}`;

/** How long a task has been visible and waiting, in days. */
export function waitingDays(item: OrderInputItem, now: Date): number {
  const since =
    item.visibility.kind === "visible"
      ? maxDate(item.task.waitingSince, item.visibility.since)
      : item.task.waitingSince;
  return Math.max(0, daysBetween(since ?? item.task.waitingSince, now));
}

function isCheckIn(i: OrderedItem) {
  return i.visibility.kind === "check_in";
}

function checkInRank(i: OrderedItem) {
  return i.visibility.kind === "check_in" && i.visibility.cause === "overdue" ? 0 : 1;
}

function compare(a: OrderedItem, b: OrderedItem): number {
  if (b.adjusted !== a.adjusted) return b.adjusted - a.adjusted;
  const ad = a.task.deadlineAt?.getTime() ?? Infinity;
  const bd = b.task.deadlineAt?.getTime() ?? Infinity;
  if (ad !== bd) return ad - bd;
  return a.task.createdAt.getTime() - b.task.createdAt.getTime();
}

export function orderTasks(items: OrderInputItem[], ctx: OrderContext): OrderedItem[] {
  const config = ctx.config ?? priorityConfig;
  const flags = config.ordering.flags;
  const { now } = ctx;
  const allowed = (taskId: string, id: AdjustmentId) =>
    flags[ADJUSTMENT_FLAG[id]] && !ctx.suppressed.has(suppressionKey(taskId, id));

  // 1. Score.
  const scored: OrderedItem[] = items.map((it) => {
    const score = scoreTask(it.task, it.event, now, config);
    return { ...it, score, adjustments: [], adjusted: score.total, effectiveDeadline: null };
  });

  const add = (item: OrderedItem, adj: Adjustment) => {
    if (adj.points <= 0) return;
    item.adjustments.push(adj);
    item.adjusted += adj.points;
  };

  // 2. Quick-win bump.
  {
    const q = config.ordering.quickWin;
    for (const item of scored) {
      if (isCheckIn(item) || !allowed(item.task.id, "quick_win")) continue;
      if (item.task.effort > q.maxEffort || item.task.impact > q.maxImpact) continue;
      const days = waitingDays(item, now);
      if (days < q.afterDays) continue;
      const t = Math.min(1, (days - q.afterDays) / (q.fullAfterDays - q.afterDays));
      add(item, { id: "quick_win", points: q.minBump + t * (q.maxBump - q.minBump) });
    }
  }

  // 3. Effort balance, based on what's actually been happening.
  {
    const b = config.ordering.effortBalance;
    const windowStart = now.getTime() - b.windowDays * DAY_MS;
    const recent = ctx.recentDone.filter(
      (d) => d.at.getTime() >= windowStart && d.at.getTime() <= now.getTime(),
    );
    const heavyShare = recent.filter((d) => d.effort >= b.heavyEffort).length / (recent.length || 1);
    const lightShare = recent.filter((d) => d.effort <= b.lightEffort).length / (recent.length || 1);
    const enough = recent.length >= b.minDone;

    for (const item of scored) {
      if (isCheckIn(item)) continue;
      const e = item.task.effort;
      if (enough && heavyShare >= b.runShare && e <= b.lightEffort && allowed(item.task.id, "heavy_run")) {
        add(item, { id: "heavy_run", points: b.heavyRunBump });
      }
      if (
        enough &&
        lightShare >= b.runShare &&
        e >= b.heavyEffort &&
        waitingDays(item, now) >= b.lightRunMinWaitDays &&
        allowed(item.task.id, "light_run")
      ) {
        add(item, { id: "light_run", points: b.lightRunBump });
      }
      if (ctx.lowEnergy && allowed(item.task.id, "low_energy")) {
        add(item, { id: "low_energy", points: b.lowEnergyPerPoint * (5 - e) });
      }
    }
  }

  // 4. Spread deadline clusters. No daily capacity: uses task count, effort and open steps.
  {
    const c = config.ordering.spreadClusters;
    const horizon = now.getTime() + c.lookaheadDays * DAY_MS;
    const candidates = scored
      .filter(
        (i) =>
          !isCheckIn(i) &&
          i.task.deadlineAt &&
          i.task.deadlineAt.getTime() > now.getTime() &&
          i.task.deadlineAt.getTime() <= horizon,
      )
      .sort((a, b) => a.task.deadlineAt!.getTime() - b.task.deadlineAt!.getTime());

    const clusters: OrderedItem[][] = [];
    for (const item of candidates) {
      const current = clusters[clusters.length - 1];
      const first = current?.[0];
      if (
        current &&
        first &&
        item.task.deadlineAt!.getTime() - first.task.deadlineAt!.getTime() <= c.windowDays * DAY_MS
      ) {
        current.push(item);
      } else {
        clusters.push([item]);
      }
    }

    for (const cluster of clusters) {
      if (cluster.length < c.minTasks) continue;
      const load = (i: OrderedItem) => i.task.effort + c.stepLoad * i.task.openSteps;
      const avg = cluster.reduce((s, i) => s + load(i), 0) / cluster.length;
      const ranked = [...cluster].sort(
        (a, b) => load(b) - load(a) || a.task.deadlineAt!.getTime() - b.task.deadlineAt!.getTime(),
      );
      const n = ranked.length;
      ranked.forEach((item, r) => {
        if (!allowed(item.task.id, "brought_forward")) return;
        const shiftDays = Math.min(c.maxShiftDays, c.daysPerTask * (n - 1 - r) * (load(item) / avg));
        if (shiftDays <= 0) return;
        const effective = new Date(item.task.deadlineAt!.getTime() - shiftDays * DAY_MS);
        const rescored = scoreTask(item.task, item.event, now, config, { effectiveDeadline: effective });
        const points = rescored.total - item.score.total;
        if (points <= 0) return;
        item.effectiveDeadline = effective;
        add(item, { id: "brought_forward", points, shiftDays });
      });
    }
  }

  // 5. Sort: check-ins on top (overdue first), then by adjusted score.
  const checkIns = scored.filter(isCheckIn).sort((a, b) => checkInRank(a) - checkInRank(b) || compare(a, b));
  const rest = scored.filter((i) => !isCheckIn(i)).sort(compare);

  // 6. Mix effort: no long runs of heavy tasks near the top.
  if (flags.mixEffort) {
    const m = config.ordering.mixEffort;
    const scan = Math.min(rest.length, ctx.listSize * m.scanMultiple);
    let run = 0;
    for (let i = 0; i < scan; i++) {
      const cur = rest[i]!;
      const heavy = cur.task.effort >= m.heavyEffort;
      if (heavy && run >= m.maxHeavyInARow) {
        let swapped = false;
        for (let j = i + 1; j <= i + m.lookahead && j < rest.length; j++) {
          const cand = rest[j]!;
          if (
            cand.task.effort <= m.lightMaxEffort &&
            cur.adjusted - cand.adjusted <= m.maxScoreGap &&
            !ctx.suppressed.has(suppressionKey(cand.task.id, "mix"))
          ) {
            rest.splice(j, 1);
            rest.splice(i, 0, cand);
            cand.adjustments.push({ id: "mix", points: 0 });
            swapped = true;
            break;
          }
        }
        run = swapped ? 0 : run + 1;
      } else {
        run = heavy ? run + 1 : 0;
      }
    }
  }

  return [...checkIns, ...rest];
}

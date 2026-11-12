/**
 * Layer 2: how much does this task matter, on its own?
 * Effort is deliberately absent: it only affects ordering (layer 3).
 */
import { priorityConfig, type PriorityConfig } from "./config";
import { daysBetween } from "./time";
import type { EventInput, TaskInput } from "./types";

export interface ScoreBreakdown {
  urgency: number;
  impact: number;
  deadline: number;
  event: number;
  total: number;
}

/** Map a 1–5 score onto 0–1. */
export function norm(x: number): number {
  return Math.min(1, Math.max(0, (x - 1) / 4));
}

/** 0 beyond the horizon, rising to 1 at the moment itself; 1 once passed. */
export function pressureCurve(daysLeft: number, horizonDays: number, shape: number): number {
  if (daysLeft <= 0) return 1;
  const x = Math.min(1, Math.max(0, 1 - daysLeft / horizonDays));
  return Math.pow(x, shape);
}

export function impactScaling(impact: number, config: PriorityConfig = priorityConfig): number {
  const f = config.score.impactFloor;
  return f + (1 - f) * norm(impact);
}

export function scoreTask(
  task: Pick<TaskInput, "urgency" | "impact" | "deadlineAt" | "eventRelation">,
  event: EventInput | null,
  now: Date,
  config: PriorityConfig = priorityConfig,
  options: { effectiveDeadline?: Date } = {},
): ScoreBreakdown {
  const s = config.score;
  const urgency = s.urgencyWeight * norm(task.urgency);
  const impact = s.impactWeight * norm(task.impact);
  const scale = impactScaling(task.impact, config);

  const deadlineAt = options.effectiveDeadline ?? task.deadlineAt;
  let deadline = 0;
  if (deadlineAt) {
    const curve = pressureCurve(daysBetween(now, deadlineAt), s.deadlineHorizonDays, s.curveShape);
    deadline = s.deadlineWeight * curve * scale;
  }

  // A `before` event warms the task gently, but only when there's no deadline:
  // the deadline is the hard limit and wins.
  let eventTerm = 0;
  if (!task.deadlineAt && event && task.eventRelation === "before") {
    const daysToStart = daysBetween(now, event.startsAt);
    if (daysToStart > 0) {
      eventTerm =
        s.eventWeight * pressureCurve(daysToStart, s.eventHorizonDays, s.curveShape) * scale;
    }
  }

  return {
    urgency,
    impact,
    deadline,
    event: eventTerm,
    total: urgency + impact + deadline + eventTerm,
  };
}

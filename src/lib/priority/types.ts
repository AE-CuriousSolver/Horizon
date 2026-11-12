export type Part = "morning" | "midday" | "evening";
export type Precision = "day" | "part_of_day" | "exact";
export type Relation = "before" | "during" | "after";
export type TaskStatus = "open" | "done" | "let_go" | "deleted";

/** A point in time as the user chose it: a local date, how precise, and optionally a part or time. */
export interface WhenInput {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  precision: Precision;
  part?: Part | null;
  /** Local time HH:MM, only for precision "exact" */
  time?: string | null;
}

export interface EventInput {
  id: string;
  name: string;
  startsAt: Date;
  /** null = single-day event */
  endsAt: Date | null;
}

export interface TaskInput {
  id: string;
  title: string;
  effort: number;
  impact: number;
  urgency: number;
  deadlineAt: Date | null;
  eventId: string | null;
  eventRelation: Relation | null;
  leadDays: number | null;
  status: TaskStatus;
  createdAt: Date;
  waitingSince: Date;
  openSteps: number;
}

export type Visibility =
  | { kind: "closed" }
  | { kind: "visible"; since: Date | null }
  | {
      kind: "hidden";
      cause: "lead_time" | "waiting_for_event";
      appearsAt: Date;
    }
  | {
      kind: "check_in";
      cause: "overdue" | "event_started" | "event_ended";
      since: Date;
    };

export interface DoneRecord {
  effort: number;
  at: Date;
}

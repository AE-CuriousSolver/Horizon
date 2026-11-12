/** Row shapes as stored in Supabase (see supabase/migrations), and mappers to the pure model. */
import type { EventInput, Part, Precision, Relation, TaskInput, TaskStatus } from "@/lib/priority/types";

export interface ProfileRow {
  user_id: string;
  timezone: string;
  focus_list_size: number;
  show_workings: boolean;
  adjustment_flags: Record<string, unknown>;
  notes_seen_at: string | null;
  is_demo: boolean;
}

export interface ListItemRow {
  id: string;
  name: string;
  preset_key: string | null;
  hidden_at: string | null;
}

export interface EventRow {
  id: string;
  name: string;
  starts_at: string;
  start_precision: Precision;
  start_part: Part | null;
  ends_at: string | null;
  end_precision: Precision | null;
  end_part: Part | null;
}

export interface StepRow {
  id: string;
  task_id: string;
  title: string;
  position: number;
  done_at: string | null;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  done_when: string | null;
  effort: number;
  impact: number;
  urgency: number;
  environment_id: string | null;
  state_id: string | null;
  deadline_at: string | null;
  deadline_precision: Precision | null;
  deadline_part: Part | null;
  event_id: string | null;
  event_relation: Relation | null;
  lead_days: number | null;
  done_at: string | null;
  let_go_at: string | null;
  let_go_by: "user" | "horizon" | null;
  deleted_at: string | null;
  waiting_since: string;
  shaping_hint_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  steps?: StepRow[];
}

export interface SavedFilterRow {
  id: string;
  name: string;
  filters: { environment_ids?: string[]; state_ids?: string[]; overdue_only?: boolean };
}

export interface NoteRow {
  id: string;
  kind:
    | "auto_let_go"
    | "hidden_by_event"
    | "deleted"
    | "brought_forward"
    | "light_run_boost"
    | "heavy_run_boost"
    | "quick_win";
  local_day: string;
  task_ids: string[];
  details: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const TASK_COLUMNS =
  "id,title,description,done_when,effort,impact,urgency,environment_id,state_id,deadline_at,deadline_precision,deadline_part,event_id,event_relation,lead_days,done_at,let_go_at,let_go_by,deleted_at,waiting_since,shaping_hint_dismissed_at,created_at,updated_at";

export const EVENT_COLUMNS = "id,name,starts_at,start_precision,start_part,ends_at,end_precision,end_part";

export function statusOf(t: Pick<TaskRow, "done_at" | "let_go_at" | "deleted_at">): TaskStatus {
  if (t.deleted_at) return "deleted";
  if (t.done_at) return "done";
  if (t.let_go_at) return "let_go";
  return "open";
}

export function sortedSteps(t: TaskRow): StepRow[] {
  return [...(t.steps ?? [])].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function nextOpenStep(t: TaskRow): StepRow | null {
  return sortedSteps(t).find((s) => !s.done_at) ?? null;
}

export function toTaskInput(t: TaskRow): TaskInput {
  return {
    id: t.id,
    title: t.title,
    effort: t.effort,
    impact: t.impact,
    urgency: t.urgency,
    deadlineAt: t.deadline_at ? new Date(t.deadline_at) : null,
    eventId: t.event_id,
    eventRelation: t.event_relation,
    leadDays: t.lead_days,
    status: statusOf(t),
    createdAt: new Date(t.created_at),
    waitingSince: new Date(t.waiting_since),
    openSteps: (t.steps ?? []).filter((s) => !s.done_at).length,
  };
}

export function toEventInput(e: EventRow): EventInput {
  return {
    id: e.id,
    name: e.name,
    startsAt: new Date(e.starts_at),
    endsAt: e.ends_at ? new Date(e.ends_at) : null,
  };
}

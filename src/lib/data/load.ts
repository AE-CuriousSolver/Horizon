import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, type Supabase } from "@/lib/supabase/server";
import { priorityConfig, withFlags, type PriorityConfig } from "@/lib/priority/config";
import { dueForLetGo } from "@/lib/priority/housekeeping";
import type { DoneRecord, EventInput } from "@/lib/priority/types";
import {
  EVENT_COLUMNS,
  TASK_COLUMNS,
  toEventInput,
  toTaskInput,
  type EventRow,
  type ListItemRow,
  type NoteRow,
  type ProfileRow,
  type SavedFilterRow,
  type TaskRow,
} from "./rows";

export class DataError extends Error {}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new DataError(res.error.message);
  return res.data as T;
}

/** The signed-in user and their profile. Redirects to /login when signed out. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const profile = check(
    await supabase
      .from("profiles")
      .select("user_id,timezone,focus_list_size,show_workings,adjustment_flags,notes_seen_at,is_demo")
      .eq("user_id", data.user.id)
      .maybeSingle(),
  ) as ProfileRow | null;
  if (!profile) throw new DataError("Profile missing");
  const config: PriorityConfig = withFlags(profile.adjustment_flags, priorityConfig);
  return { supabase, user: data.user, profile, tz: profile.timezone, config };
});

export const getLists = cache(async () => {
  const { supabase } = await getSession();
  const [envs, states] = await Promise.all([
    supabase.from("environments").select("id,name,preset_key,hidden_at").order("created_at").order("name"),
    supabase.from("states").select("id,name,preset_key,hidden_at").order("created_at").order("name"),
  ]);
  const order = (rows: ListItemRow[], presets: string[]) =>
    [...rows].sort((a, b) => {
      const ai = a.preset_key ? presets.indexOf(a.preset_key) : 999;
      const bi = b.preset_key ? presets.indexOf(b.preset_key) : 999;
      return ai - bi || a.name.localeCompare(b.name);
    });
  return {
    environments: order(check(envs) as ListItemRow[], [
      "home",
      "computer",
      "errands",
      "office",
      "open_hours",
      "privacy",
    ]),
    states: order(check(states) as ListItemRow[], ["focused", "productive", "social", "low_energy"]),
  };
});

export const getEvents = cache(async () => {
  const { supabase } = await getSession();
  const rows = check(
    await supabase.from("events").select(EVENT_COLUMNS).order("starts_at"),
  ) as EventRow[];
  const byId = new Map<string, EventInput>(rows.map((r) => [r.id, toEventInput(r)]));
  return { rows, byId };
});

/**
 * All tasks that aren't deleted, with their steps. Once per request.
 *
 * Also runs housekeeping, because there's no backend timer: unanswered check-ins
 * past their grace period are let go by Horizon (stamped at the grace end), and a
 * Note is written. This uses the user's own session, so RLS applies.
 */
export const getTasks = cache(async (): Promise<TaskRow[]> => {
  const { supabase, tz, config } = await getSession();
  const [rows, { byId }] = await Promise.all([
    supabase
      .from("tasks")
      .select(`${TASK_COLUMNS},steps(id,task_id,title,position,done_at)`)
      .is("deleted_at", null)
      .order("created_at"),
    getEvents(),
  ]);
  const tasks = check(rows) as TaskRow[];

  const now = new Date();
  const open = tasks.map(toTaskInput).filter((t) => t.status === "open");
  const due = dueForLetGo(open, byId, now, tz, config);
  if (due.length > 0) {
    const letGone: string[] = [];
    for (const d of due) {
      const { error } = await supabase
        .from("tasks")
        .update({ let_go_at: d.letGoAt.toISOString(), let_go_by: "horizon" })
        .eq("id", d.taskId)
        .is("let_go_at", null)
        .is("done_at", null);
      if (error) continue;
      letGone.push(d.taskId);
      const row = tasks.find((t) => t.id === d.taskId);
      if (row) {
        row.let_go_at = d.letGoAt.toISOString();
        row.let_go_by = "horizon";
      }
    }
    if (letGone.length > 0) {
      await supabase.rpc("record_note", { p_kind: "auto_let_go", p_task_ids: letGone, p_details: {} });
    }
  }
  return tasks;
});

export async function getTask(id: string): Promise<TaskRow | null> {
  const { supabase } = await getSession();
  const row = check(
    await supabase
      .from("tasks")
      .select(`${TASK_COLUMNS},steps(id,task_id,title,position,done_at)`)
      .eq("id", id)
      .maybeSingle(),
  ) as TaskRow | null;
  return row;
}

export async function getRecentDone(supabase: Supabase, now: Date, days: number): Promise<DoneRecord[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const rows = check(
    await supabase
      .from("task_activity")
      .select("details,occurred_at")
      .eq("kind", "done")
      .gte("occurred_at", since),
  ) as { details: { effort?: number }; occurred_at: string }[];
  return rows
    .filter((r) => typeof r.details?.effort === "number")
    .map((r) => ({ effort: r.details.effort as number, at: new Date(r.occurred_at) }));
}

export async function getSuppressions(supabase: Supabase, now: Date): Promise<Set<string>> {
  const rows = check(
    await supabase
      .from("ordering_suppressions")
      .select("task_id,adjustment")
      .gt("until", now.toISOString()),
  ) as { task_id: string; adjustment: string }[];
  return new Set(rows.map((r) => `${r.task_id}:${r.adjustment}`));
}

export const getViews = cache(async () => {
  const { supabase } = await getSession();
  return check(await supabase.from("saved_filters").select("id,name,filters").order("name")) as SavedFilterRow[];
});

export async function getNotes(): Promise<NoteRow[]> {
  const { supabase } = await getSession();
  return check(
    await supabase
      .from("system_notes")
      .select("id,kind,local_day,task_ids,details,resolved_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
  ) as NoteRow[];
}

export async function hasUnseenNotes(): Promise<boolean> {
  const { supabase, profile } = await getSession();
  let q = supabase.from("system_notes").select("id", { count: "exact", head: true }).is("resolved_at", null);
  if (profile.notes_seen_at) q = q.gt("updated_at", profile.notes_seen_at);
  const { count } = await q;
  return (count ?? 0) > 0;
}

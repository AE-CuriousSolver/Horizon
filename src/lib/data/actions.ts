"use server";

/**
 * Server actions. Every one runs as the signed-in user (anon key + their session),
 * so Row Level Security applies to every query. No privileged keys are used.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { errors, login as loginCopy } from "@/lib/copy/en-GB";
import { ADJUSTMENT_KEYS } from "@/lib/priority/config";
import { newlyHiddenByEvent } from "@/lib/priority/housekeeping";
import { resolveWhen } from "@/lib/priority/time";
import type { EventInput, Visibility } from "@/lib/priority/types";
import { deadlineConflict, visibility } from "@/lib/priority/visibility";
import { createClient, MissingConfigError } from "@/lib/supabase/server";
import {
  eventSchema,
  filtersSchema,
  firstError,
  nameSchema,
  quickCaptureSchema,
  taskSchema,
  type EventValue,
  type FiltersValue,
  type TaskValue,
} from "@/lib/validation";
import { DataError, getSession } from "./load";
import { EVENT_COLUMNS, TASK_COLUMNS, toEventInput, toTaskInput, type EventRow, type TaskRow } from "./rows";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const DEMO_EMAIL = "demo@example.com";

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Run an action body, turning any failure into a calm message (no stack traces). */
async function safely<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    // Next.js uses thrown errors for redirect()/notFound(): let those through.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw e;
    }
    if (e instanceof MissingConfigError) return fail(errors.setup);
    if (e instanceof DataError && /duplicate key|23505/.test(e.message)) return fail(errors.duplicateName);
    if (e instanceof TypeError) return fail(errors.network); // fetch failures
    console.error(e);
    return fail(errors.generic);
  }
}

function dbCheck(res: { error: { message: string; code?: string } | null }) {
  if (res.error) {
    throw new DataError(res.error.code === "23505" ? `23505 ${res.error.message}` : res.error.message);
  }
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safely(async () => {
    const email = String(formData.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Please enter an email address.");
    const supabase = await createClient();
    // shouldCreateUser: false — there is no public sign-up. Unknown addresses get the
    // same calm reply, so the form doesn't reveal who has an account.
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
    });
    return { ok: true };
  });
}

export async function tryDemo(): Promise<ActionResult> {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return fail(loginCopy.demoUnavailable);
  const result = await safely(async () => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password });
    if (error) return fail(loginCopy.demoUnavailable);
    await supabase.rpc("refresh_demo_if_stale");
    return { ok: true };
  });
  if (result.ok) redirect("/");
  return result;
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function quickCapture(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safely(async () => {
    const parsed = quickCaptureSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { supabase } = await getSession();
    const res = await supabase.from("tasks").insert(parsed.data).select("id").single();
    dbCheck(res);
    refresh();
    return { ok: true, data: { id: (res.data as { id: string }).id } };
  });
}

async function loadEvent(id: string | null | undefined): Promise<EventInput | null> {
  if (!id) return null;
  const { supabase } = await getSession();
  const res = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  dbCheck(res);
  return res.data ? toEventInput(res.data as EventRow) : null;
}

async function loadTaskRow(id: string): Promise<TaskRow | null> {
  const { supabase } = await getSession();
  const res = await supabase
    .from("tasks")
    .select(`${TASK_COLUMNS},steps(id,task_id,title,position,done_at)`)
    .eq("id", id)
    .maybeSingle();
  dbCheck(res);
  return (res.data as TaskRow | null) ?? null;
}

export async function saveTask(
  input: TaskValue,
): Promise<ActionResult<{ id: string; conflict: string | null }>> {
  return safely(async () => {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const { supabase, tz, config } = await getSession();
    const now = new Date();

    const linked = v.eventId && v.eventRelation ? v.eventId : null;
    const deadlineAt = v.deadline ? resolveWhen("end", v.deadline, tz, config) : null;
    const row = {
      title: v.title,
      description: v.description,
      done_when: v.doneWhen,
      effort: v.effort,
      impact: v.impact,
      urgency: v.urgency,
      environment_id: v.environmentId ?? null,
      state_id: v.stateId ?? null,
      deadline_at: deadlineAt?.toISOString() ?? null,
      deadline_precision: v.deadline?.precision ?? null,
      deadline_part: v.deadline?.precision === "part_of_day" ? (v.deadline.part ?? null) : null,
      event_id: linked,
      event_relation: linked ? v.eventRelation : null,
      lead_days: linked && v.eventRelation === "before" ? (v.leadDays ?? null) : null,
    };

    const existing = v.id ? await loadTaskRow(v.id) : null;
    if (v.id && !existing) return fail(errors.notFound);

    let id: string;
    if (existing) {
      const res = await supabase.from("tasks").update(row).eq("id", existing.id);
      dbCheck(res);
      id = existing.id;
    } else {
      const res = await supabase.from("tasks").insert(row).select("id").single();
      dbCheck(res);
      id = (res.data as { id: string }).id;
    }

    // Steps: delete removed, update changed, insert new, then reorder if needed.
    const before = [...(existing?.steps ?? [])].sort((a, b) => a.position - b.position);
    const keepIds = new Set(v.steps.filter((s) => s.id).map((s) => s.id!));
    const removed = before.filter((s) => !keepIds.has(s.id));
    if (removed.length) {
      dbCheck(await supabase.from("steps").delete().in("id", removed.map((s) => s.id)));
    }
    const finalIds: string[] = [];
    for (const [index, s] of v.steps.entries()) {
      const prev = s.id ? before.find((b) => b.id === s.id) : undefined;
      if (prev) {
        const patch: Record<string, unknown> = {};
        if (prev.title !== s.title) patch.title = s.title;
        if (!!prev.done_at !== s.done) patch.done_at = s.done ? now.toISOString() : null;
        if (Object.keys(patch).length) dbCheck(await supabase.from("steps").update(patch).eq("id", prev.id));
        finalIds.push(prev.id);
      } else {
        const res = await supabase
          .from("steps")
          .insert({ task_id: id, title: s.title, position: index + 1, done_at: s.done ? now.toISOString() : null })
          .select("id")
          .single();
        dbCheck(res);
        finalIds.push((res.data as { id: string }).id);
      }
    }
    const keptBefore = before.filter((s) => keepIds.has(s.id)).map((s) => s.id);
    const keptAfter = finalIds.filter((fid) => keptBefore.includes(fid));
    const orderChanged = keptBefore.some((fid, i) => keptAfter[i] !== fid);
    const positionsStale = finalIds.some((fid, i) => {
      const b = before.find((s) => s.id === fid);
      return b ? b.position !== i + 1 : false;
    });
    if (orderChanged || positionsStale) {
      // A real reorder is logged once; tidying positions after a removal isn't logged.
      dbCheck(
        await supabase.rpc("reorder_steps", { p_task_id: id, p_step_ids: finalIds, p_log: orderChanged }),
      );
    }

    // Gentle conflict warning (saved anyway) and a Note if this edit hid a task.
    const event = await loadEvent(linked);
    const updated = await loadTaskRow(id);
    let conflict: string | null = null;
    if (updated) {
      const input2 = toTaskInput(updated);
      const c = deadlineConflict(input2, event, tz, config);
      conflict = c ? c.appearsAt.toISOString() : null;
      if (existing) {
        const prevEvent = await loadEvent(existing.event_id);
        const was = visibility(toTaskInput(existing), prevEvent, now, tz, config);
        const is = visibility(input2, event, now, tz, config);
        const hidden = newlyHiddenByEvent(new Map([[id, was]]), new Map([[id, is]]));
        if (hidden.length) {
          await supabase.rpc("record_note", {
            p_kind: "hidden_by_event",
            p_task_ids: hidden,
            p_details: event ? { event_name: event.name } : {},
          });
        }
      }
    }
    refresh();
    return { ok: true, data: { id, conflict } };
  });
}

export type LifecycleAction = "done" | "undone" | "let_go" | "restore" | "delete" | "undelete";

export async function setTaskStatus(id: string, action: LifecycleAction): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    const now = new Date().toISOString();
    const patch: Record<LifecycleAction, Record<string, unknown>> = {
      done: { done_at: now, let_go_at: null, let_go_by: null },
      undone: { done_at: null },
      let_go: { let_go_at: now, let_go_by: "user", done_at: null },
      restore: { let_go_at: null, let_go_by: null, deleted_at: null },
      delete: { deleted_at: now },
      undelete: { deleted_at: null },
    };
    const res = await supabase.from("tasks").update(patch[action]).eq("id", id).select("id");
    dbCheck(res);
    if (!res.data?.length) return fail(errors.notFound);
    if (action === "delete") {
      await supabase.rpc("record_note", { p_kind: "deleted", p_task_ids: [id], p_details: {} });
    }
    refresh();
    return { ok: true };
  });
}

export async function completeNextStep(taskId: string): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    const res = await supabase
      .from("steps")
      .select("id")
      .eq("task_id", taskId)
      .is("done_at", null)
      .order("position")
      .limit(1);
    dbCheck(res);
    const step = (res.data as { id: string }[] | null)?.[0];
    if (!step) return fail(errors.notFound);
    dbCheck(await supabase.from("steps").update({ done_at: new Date().toISOString() }).eq("id", step.id));
    refresh();
    return { ok: true };
  });
}

export async function adjustScore(
  taskId: string,
  field: "effort" | "impact" | "urgency",
  delta: 1 | -1,
): Promise<ActionResult<{ value: number }>> {
  return safely(async () => {
    if (!["effort", "impact", "urgency"].includes(field) || ![1, -1].includes(delta)) {
      return fail(errors.scoreRange);
    }
    const { supabase } = await getSession();
    const res = await supabase.from("tasks").select(field).eq("id", taskId).maybeSingle();
    dbCheck(res);
    if (!res.data) return fail(errors.notFound);
    const current = (res.data as Record<string, number>)[field]!;
    const value = Math.min(5, Math.max(1, current + delta));
    if (value !== current) dbCheck(await supabase.from("tasks").update({ [field]: value }).eq("id", taskId));
    refresh();
    return { ok: true, data: { value } };
  });
}

export async function dismissShapingHint(taskId: string): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    dbCheck(
      await supabase.from("tasks").update({ shaping_hint_dismissed_at: new Date().toISOString() }).eq("id", taskId),
    );
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function saveEvent(input: EventValue): Promise<ActionResult<{ id: string }>> {
  return safely(async () => {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const { supabase, tz, config } = await getSession();
    const startsAt = resolveWhen("start", v.start, tz, config);
    const endsAt = v.end ? resolveWhen("end", v.end, tz, config) : null;
    if (endsAt && endsAt.getTime() < startsAt.getTime()) return fail(errors.endBeforeStart);

    const row = {
      name: v.name,
      starts_at: startsAt.toISOString(),
      start_precision: v.start.precision,
      start_part: v.start.precision === "part_of_day" ? (v.start.part ?? null) : null,
      ends_at: endsAt?.toISOString() ?? null,
      end_precision: v.end ? v.end.precision : null,
      end_part: v.end?.precision === "part_of_day" ? (v.end.part ?? null) : null,
    };

    if (!v.id) {
      const res = await supabase.from("events").insert(row).select("id").single();
      dbCheck(res);
      refresh();
      return { ok: true, data: { id: (res.data as { id: string }).id } };
    }

    // Editing: note any linked task that this change takes out of view.
    const prev = await loadEvent(v.id);
    if (!prev) return fail(errors.notFound);
    const linkedRes = await supabase
      .from("tasks")
      .select(`${TASK_COLUMNS},steps(id,task_id,title,position,done_at)`)
      .eq("event_id", v.id)
      .is("deleted_at", null);
    dbCheck(linkedRes);
    const linked = ((linkedRes.data ?? []) as TaskRow[]).map(toTaskInput);

    dbCheck(await supabase.from("events").update(row).eq("id", v.id));

    const next: EventInput = { ...prev, name: v.name, startsAt, endsAt };
    const now = new Date();
    const before = new Map<string, Visibility>(linked.map((t) => [t.id, visibility(t, prev, now, tz, config)]));
    const after = new Map<string, Visibility>(linked.map((t) => [t.id, visibility(t, next, now, tz, config)]));
    const hidden = newlyHiddenByEvent(before, after);
    if (hidden.length) {
      await supabase.rpc("record_note", {
        p_kind: "hidden_by_event",
        p_task_ids: hidden,
        p_details: { event_name: v.name },
      });
    }
    refresh();
    return { ok: true, data: { id: v.id } };
  });
}

/** Deleting unlinks any linked tasks (they keep their deadline). The UI asks first. */
export async function deleteEvent(id: string): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    const res = await supabase.from("events").delete().eq("id", id).select("id");
    dbCheck(res);
    if (!res.data?.length) return fail(errors.notFound);
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export async function saveView(name: string, filters: FiltersValue): Promise<ActionResult<{ id: string }>> {
  return safely(async () => {
    const n = nameSchema.safeParse(name);
    if (!n.success) return fail(firstError(n.error));
    const f = filtersSchema.safeParse(filters);
    if (!f.success) return fail(errors.generic);
    const { supabase } = await getSession();
    const res = await supabase.from("saved_filters").insert({ name: n.data, filters: f.data }).select("id").single();
    dbCheck(res);
    refresh();
    return { ok: true, data: { id: (res.data as { id: string }).id } };
  });
}

export async function renameView(id: string, name: string): Promise<ActionResult> {
  return safely(async () => {
    const n = nameSchema.safeParse(name);
    if (!n.success) return fail(firstError(n.error));
    const { supabase } = await getSession();
    dbCheck(await supabase.from("saved_filters").update({ name: n.data }).eq("id", id));
    refresh();
    return { ok: true };
  });
}

export async function deleteView(id: string): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    dbCheck(await supabase.from("saved_filters").delete().eq("id", id));
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const PUT_BACK_ADJUSTMENTS = ["quick_win", "heavy_run", "light_run", "brought_forward"] as const;

export async function putBack(taskId: string, adjustment: string): Promise<ActionResult> {
  return safely(async () => {
    if (!PUT_BACK_ADJUSTMENTS.includes(adjustment as (typeof PUT_BACK_ADJUSTMENTS)[number])) {
      return fail(errors.generic);
    }
    const { supabase, config } = await getSession();
    const until = new Date(Date.now() + config.ordering.suppressionDays * 86_400_000).toISOString();
    dbCheck(
      await supabase
        .from("ordering_suppressions")
        .upsert({ task_id: taskId, adjustment, until }, { onConflict: "user_id,task_id,adjustment" }),
    );
    refresh();
    return { ok: true };
  });
}

export async function resolveNote(id: string): Promise<ActionResult> {
  return safely(async () => {
    const { supabase } = await getSession();
    dbCheck(await supabase.from("system_notes").update({ resolved_at: new Date().toISOString() }).eq("id", id));
    refresh();
    return { ok: true };
  });
}

export async function markNotesSeen(): Promise<void> {
  try {
    const { supabase, user } = await getSession();
    await supabase.from("profiles").update({ notes_seen_at: new Date().toISOString() }).eq("user_id", user.id);
  } catch {
    // Not important enough to bother anyone about.
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(input: {
  timezone?: string;
  focusListSize?: number;
  showWorkings?: boolean;
  flags?: Record<string, boolean>;
}): Promise<ActionResult> {
  return safely(async () => {
    const patch: Record<string, unknown> = {};
    if (input.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: input.timezone });
      } catch {
        return fail("That timezone isn't recognised.");
      }
      patch.timezone = input.timezone;
    }
    if (input.focusListSize !== undefined) {
      const n = Math.round(Number(input.focusListSize));
      if (!Number.isFinite(n) || n < 1 || n > 100) return fail("Choose a number from 1 to 100.");
      patch.focus_list_size = n;
    }
    if (input.showWorkings !== undefined) patch.show_workings = !!input.showWorkings;
    if (input.flags) {
      const flags: Record<string, boolean> = {};
      for (const k of ADJUSTMENT_KEYS) if (typeof input.flags[k] === "boolean") flags[k] = input.flags[k]!;
      patch.adjustment_flags = flags;
    }
    const { supabase, user } = await getSession();
    dbCheck(await supabase.from("profiles").update(patch).eq("user_id", user.id));
    refresh();
    return { ok: true };
  });
}

type ListKind = "environments" | "states";
const isListKind = (k: string): k is ListKind => k === "environments" || k === "states";

export async function addListItem(kind: string, name: string): Promise<ActionResult> {
  return safely(async () => {
    if (!isListKind(kind)) return fail(errors.generic);
    const n = nameSchema.safeParse(name);
    if (!n.success) return fail(firstError(n.error));
    const { supabase } = await getSession();
    dbCheck(await supabase.from(kind).insert({ name: n.data }));
    refresh();
    return { ok: true };
  });
}

export async function renameListItem(kind: string, id: string, name: string): Promise<ActionResult> {
  return safely(async () => {
    if (!isListKind(kind)) return fail(errors.generic);
    const n = nameSchema.safeParse(name);
    if (!n.success) return fail(firstError(n.error));
    const { supabase } = await getSession();
    dbCheck(await supabase.from(kind).update({ name: n.data }).eq("id", id));
    refresh();
    return { ok: true };
  });
}

export async function setListItemHidden(kind: string, id: string, hidden: boolean): Promise<ActionResult> {
  return safely(async () => {
    if (!isListKind(kind)) return fail(errors.generic);
    const { supabase } = await getSession();
    dbCheck(
      await supabase
        .from(kind)
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq("id", id),
    );
    refresh();
    return { ok: true };
  });
}

export async function resetDemo(): Promise<ActionResult> {
  return safely(async () => {
    const { supabase, profile } = await getSession();
    if (!profile.is_demo) return fail(errors.generic);
    dbCheck(await supabase.rpc("seed_demo_data"));
    refresh();
    return { ok: true };
  });
}

import { NotesList, type NoteModel, type NoteTask } from "@/components/NotesList";
import { EmptyState, PageHeader } from "@/components/ui";
import { notes as copy } from "@/lib/copy/en-GB";
import { markNotesSeen } from "@/lib/data/actions";
import { getNotes, getSession } from "@/lib/data/load";
import { statusOf, type NoteRow, type TaskRow } from "@/lib/data/rows";
import { capitalise, formatDay, joinTitles } from "@/lib/format";
import { ADJUSTMENT_FOR_NOTE, type OrderingNoteKind } from "@/lib/priority/housekeeping";
import { resolveWhen } from "@/lib/priority/time";

const ORDERING = new Set<NoteRow["kind"]>(["brought_forward", "light_run_boost", "heavy_run_boost", "quick_win"]);

export default async function NotesPage() {
  const { supabase, tz } = await getSession();
  const rows = await getNotes();
  const ids = [...new Set(rows.flatMap((n) => n.task_ids))];
  const { data } = ids.length
    ? await supabase.from("tasks").select("id,title,done_at,let_go_at,deleted_at").in("id", ids)
    : { data: [] };
  const tasks = new Map(((data ?? []) as Pick<TaskRow, "id" | "title" | "done_at" | "let_go_at" | "deleted_at">[]).map((t) => [t.id, t]));
  const now = new Date();

  const notes: NoteModel[] = rows.map((n) => {
    const known = n.task_ids.map((id) => tasks.get(id)).filter((t) => !!t);
    const titles = known.map((t) => t.title);
    const eventName = typeof n.details?.event_name === "string" ? n.details.event_name : undefined;
    const message = copy.kinds[n.kind]!(titles.length ? joinTitles(titles) : copy.gone, titles.length, eventName);
    const items: NoteTask[] = known.map((t) => {
      const status = statusOf(t);
      let action: NoteTask["action"] = null;
      if ((n.kind === "auto_let_go" && status === "let_go") || (n.kind === "deleted" && status === "deleted")) {
        action = "restore";
      } else if (n.kind === "hidden_by_event" && status === "open") {
        action = "edit";
      } else if (ORDERING.has(n.kind) && status === "open") {
        action = "put_back";
      }
      return {
        id: t.id,
        title: t.title,
        action,
        adjustment: ORDERING.has(n.kind) ? ADJUSTMENT_FOR_NOTE[n.kind as OrderingNoteKind] : undefined,
      };
    });
    return {
      id: n.id,
      // The note's own local day (midday avoids any timezone edge).
      when: capitalise(formatDay(resolveWhen("start", { date: n.local_day, precision: "exact", time: "12:00" }, tz), tz, now)),
      message,
      resolved: !!n.resolved_at,
      tasks: items,
    };
  });

  await markNotesSeen();

  return (
    <div>
      <PageHeader title={copy.heading} intro={copy.intro} />
      {notes.length ? <NotesList notes={notes} /> : <EmptyState title={copy.empty} />}
    </div>
  );
}

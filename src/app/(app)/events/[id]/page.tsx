import { notFound } from "next/navigation";
import { EventEditor } from "@/components/EventEditor";
import { PageHeader } from "@/components/ui";
import { events as copy } from "@/lib/copy/en-GB";
import { getEvents, getSession, getTasks } from "@/lib/data/load";
import { statusOf } from "@/lib/data/rows";
import { toWhenInput } from "@/lib/priority/time";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tz } = await getSession();
  const [{ rows }, tasks] = await Promise.all([getEvents(), getTasks()]);
  const e = rows.find((r) => r.id === id);
  if (!e) notFound();
  const linkedCount = tasks.filter((t) => t.event_id === id && statusOf(t) !== "deleted").length;
  return (
    <div>
      <PageHeader title={copy.editEvent} />
      <EventEditor
        initial={{
          id: e.id,
          name: e.name,
          start: toWhenInput("start", new Date(e.starts_at), e.start_precision, e.start_part, tz),
          end:
            e.ends_at && e.end_precision
              ? toWhenInput("end", new Date(e.ends_at), e.end_precision, e.end_part, tz)
              : null,
        }}
        linkedCount={linkedCount}
      />
    </div>
  );
}

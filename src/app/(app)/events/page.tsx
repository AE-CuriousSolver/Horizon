import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { events as copy } from "@/lib/copy/en-GB";
import { getEvents, getSession, getTasks } from "@/lib/data/load";
import { formatWhen } from "@/lib/format";
import { statusOf, type EventRow } from "@/lib/data/rows";

export default async function EventsPage() {
  const { tz } = await getSession();
  const [{ rows }, tasks] = await Promise.all([getEvents(), getTasks()]);
  const now = new Date();
  const linked = new Map<string, number>();
  for (const t of tasks) {
    if (t.event_id && statusOf(t) === "open") linked.set(t.event_id, (linked.get(t.event_id) ?? 0) + 1);
  }
  const endOf = (e: EventRow) => new Date(e.ends_at ?? e.starts_at).getTime();
  const groups = [
    { title: copy.now, items: rows.filter((e) => new Date(e.starts_at) <= now && e.ends_at && endOf(e) > now.getTime()) },
    { title: copy.upcoming, items: rows.filter((e) => new Date(e.starts_at) > now) },
    {
      title: copy.past,
      items: rows.filter((e) => new Date(e.starts_at) <= now && !(e.ends_at && endOf(e) > now.getTime())).reverse(),
    },
  ];

  const when = (e: EventRow) => {
    const s = formatWhen(new Date(e.starts_at), e.start_precision, e.start_part, tz, now, "start");
    if (!e.ends_at || !e.end_precision) return s;
    return `${s} → ${formatWhen(new Date(e.ends_at), e.end_precision, e.end_part, tz, now, "end")}`;
  };

  return (
    <div>
      <PageHeader
        title={copy.heading}
        intro={copy.intro}
        action={
          <LinkButton href="/events/new" variant="primary" className="shrink-0">
            {copy.newEvent}
          </LinkButton>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={copy.empty} />
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.title}>
              <SectionTitle>{g.title}</SectionTitle>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="block p-3 hover:bg-surface-2">
                      <p className="break-words">{e.name}</p>
                      <p className="text-xs text-muted">
                        {when(e)}
                        {linked.get(e.id) ? ` · ${copy.linkedTasks(linked.get(e.id)!)}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}

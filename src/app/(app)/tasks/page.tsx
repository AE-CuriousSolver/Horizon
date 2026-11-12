import { OrbitList } from "@/components/OrbitList";
import { EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { buildOrbit } from "@/lib/board";
import { orbit as copy } from "@/lib/copy/en-GB";
import { getEvents, getSession, getTasks } from "@/lib/data/load";

export default async function OrbitPage() {
  const { tz, config } = await getSession();
  const [tasks, { byId }] = await Promise.all([getTasks(), getEvents()]);
  const model = buildOrbit(tasks, byId, new Date(), tz, config);
  const groups = [
    { key: "visible", title: copy.visible, items: model.visible },
    { key: "hidden", title: copy.hidden, items: model.hidden },
    { key: "done", title: copy.done, items: model.done },
    { key: "letGo", title: copy.letGo, items: model.letGo },
  ] as const;
  const empty = groups.every((g) => g.items.length === 0);
  return (
    <div>
      <PageHeader
        title={copy.heading}
        intro={copy.intro}
        action={
          <LinkButton href="/tasks/new" variant="primary" className="shrink-0">
            {copy.newTask}
          </LinkButton>
        }
      />
      {empty ? (
        <EmptyState title={copy.empty} />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key}>
              <SectionTitle>
                {g.title} · {g.items.length}
              </SectionTitle>
              <OrbitList items={g.items} kind={g.key} />
            </section>
          ))
      )}
    </div>
  );
}

import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ViewsList } from "@/components/ViewsList";
import { filters as filterCopy, names, views as copy } from "@/lib/copy/en-GB";
import { getLists, getViews } from "@/lib/data/load";
import { filtersToSearch } from "@/lib/searchParams";

export default async function ViewsPage() {
  const [views, lists] = await Promise.all([getViews(), getLists()]);
  const nameOf = (id: string) =>
    lists.environments.find((e) => e.id === id)?.name ?? lists.states.find((s) => s.id === id)?.name ?? null;
  const items = views.map((v) => {
    const f = {
      environmentIds: v.filters.environment_ids ?? [],
      stateIds: v.filters.state_ids ?? [],
      overdueOnly: !!v.filters.overdue_only,
    };
    const parts = [...f.environmentIds, ...f.stateIds].map(nameOf).filter(Boolean) as string[];
    if (f.overdueOnly) parts.push(filterCopy.overdueOnly);
    return { id: v.id, name: v.name, summary: parts.join(" · ") || filterCopy.any, href: `/${filtersToSearch(f, v.id)}` };
  });
  return (
    <div>
      <PageHeader title={copy.heading} intro={copy.intro} />
      {items.length ? (
        <ViewsList items={items} />
      ) : (
        <EmptyState title={copy.empty}>
          <LinkButton href="/" variant="secondary">
            {names.radar}
          </LinkButton>
        </EmptyState>
      )}
    </div>
  );
}

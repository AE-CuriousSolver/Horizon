import Link from "next/link";
import { FilterBar, filtersToSearch } from "@/components/FilterBar";
import { QuickCapture } from "@/components/QuickCapture";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/ui";
import { buildRadar, hasFilters } from "@/lib/board";
import { radar as copy } from "@/lib/copy/en-GB";
import { getEvents, getLists, getRecentDone, getSession, getSuppressions, getTasks, getViews } from "@/lib/data/load";
import { first, parseFilters, parsePages, type SearchParams } from "@/lib/searchParams";

export default async function RadarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const pages = parsePages(sp);
  const viewId = first(sp.view) ?? null;

  const { supabase, profile, tz, config } = await getSession();
  const now = new Date();
  const [tasks, { byId }, lists, views, recentDone, suppressed] = await Promise.all([
    getTasks(),
    getEvents(),
    getLists(),
    getViews(),
    getRecentDone(supabase, now, config.ordering.effortBalance.windowDays),
    getSuppressions(supabase, now),
  ]);

  const listSize = profile.focus_list_size;
  const model = buildRadar({
    tasks,
    events: byId,
    states: lists.states,
    filters,
    recentDone,
    suppressed,
    listSize,
    limit: listSize * pages,
    showWorkings: profile.show_workings,
    now,
    tz,
    config,
  });

  // Big-picture ordering Notes: at most one per kind per day (merged in the database).
  await Promise.all(
    model.noteCandidates.map(([kind, ids]) =>
      supabase.rpc("record_note", { p_kind: kind, p_task_ids: ids, p_details: {} }),
    ),
  );

  const visibleLists = {
    environments: lists.environments.filter((e) => !e.hidden_at || filters.environmentIds.includes(e.id)),
    states: lists.states.filter((s) => !s.hidden_at || filters.stateIds.includes(s.id)),
  };
  const viewItems = views.map((v) => ({
    id: v.id,
    name: v.name,
    filters: {
      environmentIds: v.filters.environment_ids ?? [],
      stateIds: v.filters.state_ids ?? [],
      overdueOnly: !!v.filters.overdue_only,
    },
  }));
  const activeView = viewItems.find((v) => v.id === viewId) ?? null;
  const moreHref = `/${filtersToSearch(filters, activeView?.id)}${filtersToSearch(filters, activeView?.id) ? "&" : "?"}pages=${pages + 1}`;

  return (
    <div>
      <h1 className="sr-only">{copy.heading}</h1>
      <QuickCapture />
      <FilterBar
        environments={visibleLists.environments}
        states={visibleLists.states}
        views={viewItems}
        filters={filters}
        activeViewId={activeView?.id ?? null}
      />

      {model.cards.length > 0 ? (
        <>
          <ul className="space-y-3">
            {model.cards.map((card) => (
              <TaskCard key={card.id} card={card} graceDays={config.visibility.checkInGraceDays} />
            ))}
          </ul>
          {model.total > model.cards.length && (
            <div className="mt-6 text-center">
              <Link href={moreHref} scroll={false} className="text-sm text-accent hover:underline">
                {copy.showMore}
              </Link>
            </div>
          )}
        </>
      ) : hasFilters(filters) && model.unfilteredTotal > 0 ? (
        <EmptyState title={copy.filteredEmpty} />
      ) : (
        <div className="px-2 py-16 text-center">
          <p className="text-lg font-medium">{copy.allClearTitle}</p>
          <p className="mt-1 text-muted">{copy.allClearBody}</p>
          <Link href="/look-ahead" className="mt-16 inline-block text-xs text-muted/80 hover:text-accent">
            {copy.allClearLink}
          </Link>
        </div>
      )}
    </div>
  );
}

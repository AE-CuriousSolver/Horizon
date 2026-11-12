import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { lookAhead as copy } from "@/lib/copy/en-GB";

// Blocks (v2) are deliberately not listed until they exist.
const items = [
  { href: "/notes", title: copy.reviewNotes, hint: copy.reviewNotesHint },
  { href: "/events/new", title: copy.addEvents, hint: copy.addEventsHint },
  { href: "/views", title: copy.createViews, hint: copy.createViewsHint },
];

export default function LookAheadPage() {
  return (
    <div>
      <PageHeader title={copy.heading} intro={copy.intro} />
      <ol className="space-y-3">
        {items.map((i, n) => (
          <li key={i.href}>
            <Link href={i.href} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
              <span className="text-muted">{n + 1}</span>
              <span>
                <span className="block font-medium">{i.title}</span>
                <span className="block text-sm text-muted">{i.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

import { EventEditor } from "@/components/EventEditor";
import { PageHeader } from "@/components/ui";
import { events as copy } from "@/lib/copy/en-GB";
import { getSession } from "@/lib/data/load";
import { localDateString } from "@/lib/priority/time";

export default async function NewEventPage() {
  const { tz } = await getSession();
  const today = localDateString(new Date(), tz);
  return (
    <div>
      <PageHeader title={copy.newEvent} />
      <EventEditor
        initial={{ name: "", start: { date: today, precision: "day", part: null, time: null }, end: null }}
        linkedCount={0}
      />
    </div>
  );
}

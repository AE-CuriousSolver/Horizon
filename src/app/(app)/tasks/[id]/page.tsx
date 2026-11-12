import { notFound } from "next/navigation";
import { TaskEditor } from "@/components/TaskEditor";
import { PageHeader } from "@/components/ui";
import { editor as copy } from "@/lib/copy/en-GB";
import { getTask } from "@/lib/data/load";
import { editorOptions, statusOf, taskToValue } from "@/lib/editorData";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [task, opts] = await Promise.all([getTask(id), editorOptions()]);
  if (!task) notFound();
  return (
    <div>
      <PageHeader title={copy.editTitle} />
      <TaskEditor
        key={task.updated_at}
        initial={taskToValue(task, opts.tz)}
        status={statusOf(task)}
        shapingDismissed={!!task.shaping_hint_dismissed_at}
        {...opts}
      />
    </div>
  );
}

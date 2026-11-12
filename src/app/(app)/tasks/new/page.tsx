import { TaskEditor } from "@/components/TaskEditor";
import { PageHeader } from "@/components/ui";
import { editor as copy } from "@/lib/copy/en-GB";
import { editorOptions } from "@/lib/editorData";
import { priorityConfig } from "@/lib/priority/config";

export default async function NewTaskPage() {
  const opts = await editorOptions();
  return (
    <div>
      <PageHeader title={copy.newTitle} />
      <TaskEditor
        initial={{
          title: "",
          description: null,
          doneWhen: null,
          ...priorityConfig.defaultScores,
          environmentId: null,
          stateId: null,
          deadline: null,
          eventId: null,
          eventRelation: null,
          leadDays: null,
          steps: [],
        }}
        status={null}
        shapingDismissed={false}
        {...opts}
      />
    </div>
  );
}

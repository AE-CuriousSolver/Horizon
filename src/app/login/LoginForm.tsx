"use client";

import { useActionState, useState, useTransition } from "react";
import { sendMagicLink, tryDemo, type ActionResult } from "@/lib/data/actions";
import { login as copy } from "@/lib/copy/en-GB";
import { inputClass } from "@/components/ui";

export function LoginForm({ linkProblem }: { linkProblem: boolean }) {
  const [state, action, sending] = useActionState<ActionResult | null, FormData>(sendMagicLink, null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoPending, startDemo] = useTransition();

  if (state?.ok) {
    return <p className="rounded-2xl bg-accent-soft p-4 text-sm">{copy.sent}</p>;
  }

  return (
    <div className="space-y-6">
      {linkProblem && <p className="rounded-2xl bg-warm-soft p-3 text-sm">{copy.linkProblem}</p>}
      <form action={action} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium">
          {copy.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className={inputClass}
        />
        <button
          type="submit"
          disabled={sending}
          className="min-h-11 w-full rounded-full bg-accent px-4 font-medium text-accent-ink disabled:opacity-60"
        >
          {sending ? copy.sending : copy.send}
        </button>
        {state && !state.ok && <p className="text-sm text-warm">{state.error}</p>}
      </form>

      <div className="border-t border-line pt-6 text-center">
        <button
          type="button"
          disabled={demoPending}
          onClick={() =>
            startDemo(async () => {
              setDemoError(null);
              const res = await tryDemo();
              if (res && !res.ok) setDemoError(res.error);
            })
          }
          className="min-h-11 rounded-full border border-line px-5 font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {copy.tryDemo}
        </button>
        <p className="mt-2 text-xs text-muted">{copy.demoHint}</p>
        {demoError && <p className="mt-2 text-sm text-warm">{demoError}</p>}
      </div>
    </div>
  );
}

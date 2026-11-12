"use client";

import Link from "next/link";
import { errors } from "@/lib/copy/en-GB";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <main className="mx-auto max-w-sm px-4 py-24 text-center">
      <p className="font-medium">{offline ? errors.network : errors.generic}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
          {errors.tryAgain}
        </button>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-full bg-surface-2 px-4 text-sm font-medium">
          {errors.home}
        </Link>
      </div>
    </main>
  );
}

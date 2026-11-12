import { errors, login as copy, names } from "@/lib/copy/en-GB";
import { supabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold tracking-tight text-accent">{names.product}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mb-8 mt-2 text-muted">{copy.intro}</p>
      {supabaseEnv() ? <LoginForm linkProblem={sp.error === "link"} /> : <p className="text-warm">{errors.setup}</p>}
    </main>
  );
}

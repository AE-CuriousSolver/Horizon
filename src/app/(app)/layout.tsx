import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import { errors } from "@/lib/copy/en-GB";
import { hasUnseenNotes } from "@/lib/data/load";
import { supabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnv()) {
    return <main className="mx-auto max-w-sm px-4 py-24 text-center font-medium">{errors.setup}</main>;
  }
  let dot = false;
  try {
    dot = await hasUnseenNotes();
  } catch {
    // The page itself shows any problem; the dot is optional.
  }
  return (
    <ToastProvider>
      <Nav notesDot={dot} />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 sm:pb-12">{children}</main>
    </ToastProvider>
  );
}

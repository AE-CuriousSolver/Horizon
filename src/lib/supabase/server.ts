import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export class MissingConfigError extends Error {
  constructor() {
    super("Supabase environment variables are missing");
  }
}

/** A Supabase client acting as the signed-in user (anon key + their session cookie). RLS always applies. */
export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new MissingConfigError();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

export type Supabase = Awaited<ReturnType<typeof createClient>>;

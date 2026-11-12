# Security and privacy

Horizon has no backend of its own. The browser and the Next.js server talk to Supabase using the public **anon key** plus the signed-in person's session. What keeps your data private is **Postgres Row Level Security (RLS)**, not the app code.

## The rules

- **RLS is enabled on every table** in the `public` schema. A database test fails if any table is ever added without it.
- **Every row has a `user_id`.** Each table's policies allow `select`, `insert`, `update` and `delete` only where `user_id = auth.uid()`, for signed-in users only. Anonymous visitors get no access to any table.
- **Links can't cross users.** Foreign keys between tables are composite (`user_id`, `id`), so a task can't point at someone else's event, environment or state, even through a hand-crafted request.
- **The activity log can't be forged.** `task_activity` is written only by database triggers. Signed-in users can read their own entries, and can't insert, change or delete any.
- **Protected settings.** A user can't change their own `user_id` or make themselves the demo account (column-level grants on `profiles`).
- **Functions act only on the caller.** `seed_demo_data()` works only for the demo account and only on its own rows. `reorder_steps()` checks that the task belongs to the caller.
- **Keys.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by the app. The `service_role` key is never used anywhere. `DEMO_PASSWORD` is server-only and never sent to the browser. `.env*` files are git-ignored.
- **No sign-up.** Public sign-up is disabled in Supabase, and the login form asks Supabase not to create users (`shouldCreateUser: false`). The form gives the same reply whether or not an address has an account.
- **No third parties.** Task data never goes to analytics, AI or any other service.

## Automated proof

[`supabase/tests/rls.test.sql`](supabase/tests/rls.test.sql) creates two users. As user B, it checks that user A's tasks, steps, events, views, notes, suppressions, activity, environments, states and settings:

- are invisible
- can't be updated or deleted (the statements affect 0 rows)
- can't be created on A's behalf
- can't be linked to

It also checks that anonymous requests are refused. CI runs this on every pull request against a throwaway local database:

```bash
supabase test db
```

## Manual check: the demo account can't see your data

You can do this on the live site at any time. It takes about five minutes.

1. **Make something recognisable in your own account.** Sign in with your magic link and add a task titled `PRIVATE CHECK`. Sign out.
2. **Sign in as the demo account.** Use **Try the demo**. Look through the Radar, Orbit, Events, Views and Notes. `PRIVATE CHECK` must not appear anywhere.
3. **Try to read your data directly, using the demo's own login.** Your project URL and anon key are public values, shown in Supabase under *Project Settings → API*. In a terminal, fill in the placeholders and run:

   ```bash
   curl -s "https://YOUR-PROJECT.supabase.co/auth/v1/token?grant_type=password" -H "apikey: YOUR-ANON-KEY" -H "Content-Type: application/json" -d '{"email":"demo@example.com","password":"THE-DEMO-PASSWORD"}'
   ```

   Copy the `access_token` from the reply. Then fill in the placeholders, including that token, and run:

   ```bash
   curl -s "https://YOUR-PROJECT.supabase.co/rest/v1/tasks?select=title&title=eq.PRIVATE%20CHECK" -H "apikey: YOUR-ANON-KEY" -H "Authorization: Bearer THE-ACCESS-TOKEN"
   ```

   The reply must be `[]`. The demo can only ever see its own rows.
4. **Try with no login at all.** Fill in the placeholders and run:

   ```bash
   curl -s "https://YOUR-PROJECT.supabase.co/rest/v1/tasks?select=title" -H "apikey: YOUR-ANON-KEY"
   ```

   The reply must be an error (`permission denied`), or `[]`. It must never be a list of tasks.
5. **Tidy up.** Delete `PRIVATE CHECK` from your account if you like.

If any step shows your data, stop using the app and check that the migrations ran: in Supabase, *Database → Tables*, every table should show "RLS enabled".

## Reporting a problem

This is a personal project. If you spot a security issue, please open a GitHub issue without including any personal data, or contact the owner directly.

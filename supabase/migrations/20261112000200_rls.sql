-- Row Level Security on every table: each user can only read and write their own rows.
-- `anon` gets nothing. Policies use (select auth.uid()) so it's evaluated once per query.

alter table public.profiles enable row level security;
alter table public.environments enable row level security;
alter table public.states enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.steps enable row level security;
alter table public.saved_filters enable row level security;
alter table public.system_notes enable row level security;
alter table public.ordering_suppressions enable row level security;
alter table public.task_activity enable row level security;

alter table public.profiles force row level security;
alter table public.environments force row level security;
alter table public.states force row level security;
alter table public.events force row level security;
alter table public.tasks force row level security;
alter table public.steps force row level security;
alter table public.saved_filters force row level security;
alter table public.system_notes force row level security;
alter table public.ordering_suppressions force row level security;
alter table public.task_activity force row level security;

-- Nothing for anonymous visitors.
revoke all on all tables in schema public from anon;

-- Owner-only, full CRUD.
do $$
declare
  t text;
begin
  foreach t in array array[
    'environments', 'states', 'events', 'tasks', 'steps',
    'saved_filters', 'system_notes', 'ordering_suppressions'
  ] loop
    execute format(
      'create policy %1$I on public.%2$I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %1$I on public.%2$I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %1$I on public.%2$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %1$I on public.%2$I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;

-- profiles: created by the sign-up trigger; the owner can read and change settings only.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (timezone, focus_list_size, show_workings, adjustment_flags, notes_seen_at)
  on public.profiles to authenticated;

-- task_activity: the owner can read; nobody can write directly.
create policy task_activity_select_own on public.task_activity
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.task_activity from authenticated;

-- Rows can't be moved to another user: every update policy's WITH CHECK
-- requires user_id = auth.uid(), and composite foreign keys keep links in-user.

-- Privacy: one user can never read, change, delete or link to another user's rows.
-- Run with `supabase test db` (CI does this on every pull request).
begin;
select plan(40);

-- Two ordinary users. The sign-up trigger gives each a profile and their own lists.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');

-- Every table in public has RLS enabled (a new table without it fails this test).
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every public table has RLS enabled');

-- ---------------------------------------------------------------- user A's data
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

insert into public.events (id, name, starts_at)
  values ('eeeeeeee-0000-0000-0000-00000000000a', 'A holiday', now() + interval '10 days');
insert into public.tasks (id, title, event_id, event_relation, environment_id)
  values ('11111111-0000-0000-0000-00000000000a', 'A task', 'eeeeeeee-0000-0000-0000-00000000000a', 'before',
          (select id from public.environments where preset_key = 'home'));
insert into public.steps (id, task_id, title)
  values ('55555555-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000a', 'A step');
insert into public.saved_filters (name, filters) values ('A view', '{}');
insert into public.environments (id, name) values ('cccccccc-0000-0000-0000-00000000000a', 'Garden');
select public.record_note('deleted', array['11111111-0000-0000-0000-00000000000a']::uuid[]);
insert into public.ordering_suppressions (task_id, adjustment, until)
  values ('11111111-0000-0000-0000-00000000000a', 'quick_win', now() + interval '7 days');

select is((select count(*)::int from public.environments), 7, 'A sees their own 6 preset environments plus Garden');
select is((select count(*)::int from public.states), 4, 'A sees their own 4 states');
select is((select count(*)::int from public.profiles), 1, 'A sees only their own profile');
select ok((select count(*) from public.task_activity) > 0, 'A sees their own activity');

-- ---------------------------------------------------------------- user B looks for A's data
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';

select is((select count(*)::int from public.tasks), 0, 'B cannot see A''s tasks');
select is((select count(*)::int from public.steps), 0, 'B cannot see A''s steps');
select is((select count(*)::int from public.events), 0, 'B cannot see A''s events');
select is((select count(*)::int from public.saved_filters), 0, 'B cannot see A''s views');
select is((select count(*)::int from public.system_notes), 0, 'B cannot see A''s notes');
select is((select count(*)::int from public.ordering_suppressions), 0, 'B cannot see A''s suppressions');
select is((select count(*)::int from public.task_activity), 0, 'B cannot see A''s activity');
select is((select count(*)::int from public.profiles), 1, 'B sees only their own profile');
select is((select count(*)::int from public.environments where user_id <> auth.uid()), 0, 'B cannot see A''s environments');
select is((select count(*)::int from public.states where user_id <> auth.uid()), 0, 'B cannot see A''s states');

-- Changing or deleting A's rows silently affects nothing.
with u as (update public.tasks set title = 'hacked' returning 1) select is(count(*)::int, 0, 'B cannot update A''s tasks') from u;
with u as (update public.events set name = 'hacked' returning 1) select is(count(*)::int, 0, 'B cannot update A''s events') from u;
with u as (update public.steps set title = 'hacked' returning 1) select is(count(*)::int, 0, 'B cannot update A''s steps') from u;
with d as (delete from public.tasks returning 1) select is(count(*)::int, 0, 'B cannot delete A''s tasks') from d;
with d as (delete from public.events returning 1) select is(count(*)::int, 0, 'B cannot delete A''s events') from d;
with d as (delete from public.saved_filters returning 1) select is(count(*)::int, 0, 'B cannot delete A''s views') from d;
with d as (delete from public.system_notes returning 1) select is(count(*)::int, 0, 'B cannot delete A''s notes') from d;
with u as (update public.profiles set timezone = 'UTC' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select is(count(*)::int, 0, 'B cannot change A''s settings') from u;

-- Writing rows as A is refused.
select throws_ok($$ insert into public.tasks (user_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'B cannot create a task owned by A');
select throws_ok($$ insert into public.events (user_id, name, starts_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', now()) $$,
  '42501', null, 'B cannot create an event owned by A');

-- Linking to A's rows is refused by the composite foreign keys.
select throws_ok($$ insert into public.tasks (title, event_id, event_relation) values ('x', 'eeeeeeee-0000-0000-0000-00000000000a', 'after') $$,
  '23503', null, 'B cannot link a task to A''s event');
select throws_ok($$ insert into public.tasks (title, environment_id) values ('x', 'cccccccc-0000-0000-0000-00000000000a') $$,
  '23503', null, 'B cannot use A''s environment');
select throws_ok($$ insert into public.steps (task_id, title) values ('11111111-0000-0000-0000-00000000000a', 'x') $$,
  '23503', null, 'B cannot add a step to A''s task');
select throws_ok($$ insert into public.ordering_suppressions (task_id, adjustment, until)
  values ('11111111-0000-0000-0000-00000000000a', 'quick_win', now()) $$,
  '23503', null, 'B cannot suppress ordering on A''s task');

-- Functions only ever act on the caller's own rows.
select throws_ok($$ select public.reorder_steps('11111111-0000-0000-0000-00000000000a', array['55555555-0000-0000-0000-00000000000a']::uuid[]) $$,
  'P0002', null, 'B cannot reorder A''s steps');
select throws_ok($$ select public.seed_demo_data() $$, '42501', null, 'B is not the demo account, so cannot reset it');

-- The activity log and protected profile columns can't be written directly.
select throws_ok($$ insert into public.task_activity (user_id, task_id, kind) values (auth.uid(), gen_random_uuid(), 'done') $$,
  '42501', null, 'nobody can write the activity log directly');
select throws_ok($$ update public.profiles set is_demo = true $$, '42501', null, 'B cannot make themselves the demo account');
select throws_ok($$ delete from public.task_activity $$, '42501', null, 'nobody can delete activity history');

-- ---------------------------------------------------------------- anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.tasks $$, '42501', null, 'anon cannot read tasks');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.record_note('deleted', '{}') $$, '42501', null, 'anon cannot call functions');

-- ---------------------------------------------------------------- A's data is untouched
reset role;
select is((select title from public.tasks where id = '11111111-0000-0000-0000-00000000000a'), 'A task', 'A''s task is unchanged');
select is((select count(*)::int from public.events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'A''s event still exists');
select is((select count(*)::int from public.tasks where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0, 'nothing was created for B by the failed attempts');

select * from finish();
rollback;

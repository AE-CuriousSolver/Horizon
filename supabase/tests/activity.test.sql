-- Activity history, lifecycle bookkeeping, notes and the demo seed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('dddddddd-0000-0000-0000-00000000000d', 'demo@example.com');

select ok(not (select is_demo from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'a normal user is not the demo');
select ok((select is_demo from public.profiles where user_id = 'dddddddd-0000-0000-0000-00000000000d'), 'demo@example.com is flagged as the demo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';

insert into public.tasks (id, title) values ('11111111-0000-0000-0000-000000000001', 'Write letter');
select is((select kind from public.task_activity order by id desc limit 1), 'created', 'creating a task is logged');

update public.tasks set urgency = 5 where id = '11111111-0000-0000-0000-000000000001';
select is((select kind from public.task_activity order by id desc limit 1), 'scores_changed', 'score changes are logged');

update public.tasks set deadline_at = now() + interval '2 days', deadline_precision = 'day' where id = '11111111-0000-0000-0000-000000000001';
select is((select kind from public.task_activity order by id desc limit 1), 'deadline_changed', 'deadline changes are logged');

update public.tasks set title = 'Write a letter', done_when = 'Posted' where id = '11111111-0000-0000-0000-000000000001';
select is((select details->'fields' from public.task_activity order by id desc limit 1), '["title", "done_when"]'::jsonb,
  'edits are logged with the fields that changed');

update public.tasks set done_at = now() where id = '11111111-0000-0000-0000-000000000001';
select is((select kind from public.task_activity order by id desc limit 1), 'done', 'done is logged');
select is((select (details->>'effort')::int from public.task_activity order by id desc limit 1), 3, 'done carries an effort snapshot');

update public.tasks set waiting_since = now() - interval '30 days' where id = '11111111-0000-0000-0000-000000000001';
update public.tasks set done_at = null where id = '11111111-0000-0000-0000-000000000001';
select is((select kind from public.task_activity order by id desc limit 1), 'undone', 'undone is logged');
select ok((select waiting_since > now() - interval '1 minute' from public.tasks where id = '11111111-0000-0000-0000-000000000001'),
  'undoing restarts the waiting clock');

update public.tasks set let_go_at = now(), let_go_by = 'horizon' where id = '11111111-0000-0000-0000-000000000001';
select is((select details->>'by' from public.task_activity where kind = 'let_go'), 'horizon', 'let go records who did it');
update public.tasks set let_go_at = null, let_go_by = null where id = '11111111-0000-0000-0000-000000000001';
select is((select details->>'from' from public.task_activity order by id desc limit 1), 'let_go', 'restoring from let go is logged');

update public.tasks set deleted_at = now() where id = '11111111-0000-0000-0000-000000000001';
select is((select kind from public.task_activity order by id desc limit 1), 'deleted', 'soft delete is logged');
update public.tasks set deleted_at = null where id = '11111111-0000-0000-0000-000000000001';
select is((select details->>'from' from public.task_activity order by id desc limit 1), 'deleted', 'restoring from deleted is logged');

select throws_ok($$ update public.tasks set done_at = now(), let_go_at = now(), let_go_by = 'user' where id = '11111111-0000-0000-0000-000000000001' $$,
  '23514', null, 'a task cannot be both done and let go');

-- Steps
insert into public.steps (id, task_id, title, position) values
  ('55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Draft', 1),
  ('55555555-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Post', 2);
update public.steps set done_at = now() where id = '55555555-0000-0000-0000-000000000001';
update public.steps set title = 'First draft' where id = '55555555-0000-0000-0000-000000000001';
select results_eq(
  $$ select kind from public.task_activity where kind like 'step%' order by id $$,
  $$ values ('step_added'), ('step_added'), ('step_done'), ('step_edited') $$,
  'step changes are logged');

select public.reorder_steps('11111111-0000-0000-0000-000000000001',
  array['55555555-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001']::uuid[]);
select is((select count(*)::int from public.task_activity where kind = 'steps_reordered'), 1, 'a reorder writes one entry');
select is((select title from public.steps order by position limit 1), 'Post', 'reorder changes positions');

-- Events: deleting unlinks tasks (they keep their deadline)
insert into public.events (id, name, starts_at) values ('eeeeeeee-0000-0000-0000-000000000001', 'Trip', now() + interval '5 days');
update public.tasks set event_id = 'eeeeeeee-0000-0000-0000-000000000001', event_relation = 'before', lead_days = 3
  where id = '11111111-0000-0000-0000-000000000001';
delete from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001';
select ok((select event_id is null and event_relation is null and lead_days is null and deadline_at is not null
  from public.tasks where id = '11111111-0000-0000-0000-000000000001'), 'deleting an event unlinks its tasks and keeps the deadline');

-- Notes: one per kind per day, task ids merged
select public.record_note('deleted', array['11111111-0000-0000-0000-000000000001']::uuid[]);
select public.record_note('deleted', array['11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002']::uuid[]);
select is((select count(*)::int from public.system_notes), 1, 'one note per kind per day');
select is((select cardinality(task_ids) from public.system_notes), 2, 'repeat notes merge their task ids');
select is(public.record_note('deleted', array['22222222-0000-0000-0000-000000000002']::uuid[]), null,
  'a note with nothing new is left alone');

-- Demo seed
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-00000000000d"}';
select ok(public.refresh_demo_if_stale(), 'an empty demo account is seeded');
select ok((select count(*) from public.tasks) >= 15, 'the demo has plenty of tasks');
select ok(not public.refresh_demo_if_stale(), 'a freshly reset demo is left alone');

select * from finish();
rollback;

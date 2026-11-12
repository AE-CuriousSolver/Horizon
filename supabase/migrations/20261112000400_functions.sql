-- RPC functions called by the app with the signed-in user's session.
-- Each acts only on auth.uid()'s own rows.

-- ---------------------------------------------------------------------------
-- record_note: add task ids to today's note of a kind (one note per kind per local day).
-- Returns the note id, or null when every task id was already in today's note.
-- Security invoker: RLS applies as usual.
-- ---------------------------------------------------------------------------
create function public.record_note(
  p_kind text,
  p_task_ids uuid[],
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  tz text;
  note_id uuid;
begin
  select p.timezone into tz from public.profiles p where p.user_id = auth.uid();
  insert into public.system_notes (user_id, kind, local_day, task_ids, details)
  values (
    auth.uid(), p_kind,
    (now() at time zone coalesce(tz, 'Australia/Sydney'))::date,
    coalesce(p_task_ids, '{}'), coalesce(p_details, '{}'::jsonb)
  )
  on conflict (user_id, kind, local_day) do update
    set task_ids = (
          select coalesce(array_agg(distinct x), '{}')
          from unnest(public.system_notes.task_ids || excluded.task_ids) as x
        ),
        details = public.system_notes.details || excluded.details,
        resolved_at = null
    -- Nothing new: leave the note alone (so it isn't flagged as unseen again).
    where not (excluded.task_ids <@ public.system_notes.task_ids)
  returning id into note_id;
  return note_id;
end;
$$;
revoke all on function public.record_note(text, uuid[], jsonb) from public, anon;
grant execute on function public.record_note(text, uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- reorder_steps: one steps_reordered entry instead of one per row.
-- p_log = false just tidies positions (e.g. after a step is removed) without logging a reorder.
-- ---------------------------------------------------------------------------
create function public.reorder_steps(p_task_id uuid, p_step_ids uuid[], p_log boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  task_title text;
begin
  select t.title into task_title from public.tasks t where t.id = p_task_id and t.user_id = uid;
  if task_title is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  perform set_config('horizon.skip_activity', 'on', true);
  update public.steps s
     set position = o.ord
    from unnest(p_step_ids) with ordinality as o(step_id, ord)
   where s.id = o.step_id and s.task_id = p_task_id and s.user_id = uid;
  perform set_config('horizon.skip_activity', 'off', true);

  if p_log then
    perform public.log_activity(uid, p_task_id, 'steps_reordered',
      jsonb_build_object('title', task_title, 'order', to_jsonb(p_step_ids)));
  end if;
end;
$$;
revoke all on function public.reorder_steps(uuid, uuid[], boolean) from public, anon;
grant execute on function public.reorder_steps(uuid, uuid[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- seed_demo_data: wipe and recreate fake data for the calling user, only if
-- their profile is the demo account. Dates are relative to now, so the demo
-- never goes stale. No service key needed.
-- ---------------------------------------------------------------------------
create function public.seed_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tz text;
  today timestamp; -- local midnight today, as wall-clock time
  env_home uuid; env_computer uuid; env_errands uuid; env_privacy uuid; env_office uuid;
  st_focused uuid; st_low uuid; st_social uuid; st_productive uuid;
  ev_holiday uuid; ev_dinner uuid;
  t_tax uuid; t_cv uuid; t_report uuid; t_pack uuid; t_party uuid;
  t_comp uuid;
begin
  if uid is null or not exists (select 1 from public.profiles p where p.user_id = uid and p.is_demo) then
    raise exception 'Only the demo account can be reset' using errcode = '42501';
  end if;

  select p.timezone into tz from public.profiles p where p.user_id = uid;
  today := date_trunc('day', now() at time zone tz);

  perform set_config('horizon.skip_activity', 'on', true);

  -- Wipe
  delete from public.tasks where user_id = uid;
  delete from public.events where user_id = uid;
  delete from public.saved_filters where user_id = uid;
  delete from public.system_notes where user_id = uid;
  delete from public.task_activity where user_id = uid;
  delete from public.environments where user_id = uid and preset_key is null;
  delete from public.states where user_id = uid and preset_key is null;
  update public.environments set hidden_at = null, name = case preset_key
      when 'home' then 'Home' when 'computer' then 'Computer' when 'errands' then 'Errands'
      when 'office' then 'Office' when 'open_hours' then 'Open hours' when 'privacy' then 'Privacy' end
    where user_id = uid;
  update public.states set hidden_at = null, name = case preset_key
      when 'focused' then 'Focused' when 'productive' then 'Productive'
      when 'social' then 'Social' when 'low_energy' then 'Low energy' end
    where user_id = uid;
  update public.profiles set focus_list_size = 10, show_workings = false, adjustment_flags = '{}',
    notes_seen_at = null, demo_reset_at = now() where user_id = uid;

  select id into env_home from public.environments where user_id = uid and preset_key = 'home';
  select id into env_computer from public.environments where user_id = uid and preset_key = 'computer';
  select id into env_errands from public.environments where user_id = uid and preset_key = 'errands';
  select id into env_privacy from public.environments where user_id = uid and preset_key = 'privacy';
  select id into env_office from public.environments where user_id = uid and preset_key = 'office';
  select id into st_focused from public.states where user_id = uid and preset_key = 'focused';
  select id into st_low from public.states where user_id = uid and preset_key = 'low_energy';
  select id into st_social from public.states where user_id = uid and preset_key = 'social';
  select id into st_productive from public.states where user_id = uid and preset_key = 'productive';

  -- Events (local wall-clock times converted to UTC with `at time zone tz`)
  insert into public.events (user_id, name, starts_at, start_precision, ends_at, end_precision)
  values (uid, 'Holiday in the mountains', (today + interval '18 days') at time zone tz, 'day',
          (today + interval '26 days') at time zone tz, 'day')
  returning id into ev_holiday;

  insert into public.events (user_id, name, starts_at, start_precision, start_part)
  values (uid, 'Dinner with Alex', (today + interval '3 days 17 hours') at time zone tz, 'part_of_day', 'evening')
  returning id into ev_dinner;

  -- Tasks
  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, created_at, waiting_since)
  values (uid, 'Buy toilet paper', 1, 2, 5, env_errands, now() - interval '1 day', now() - interval '1 day');

  insert into public.tasks (user_id, title, done_when, effort, impact, urgency, environment_id, state_id,
                            deadline_at, deadline_precision, created_at, waiting_since)
  values (uid, 'Submit tax return', 'Return lodged and receipt saved', 4, 4, 4, env_computer, st_focused,
          (today + interval '121 days') at time zone tz, 'day', now() - interval '9 days', now() - interval '9 days')
  returning id into t_tax;

  insert into public.tasks (user_id, title, description, effort, impact, urgency, environment_id,
                            deadline_at, deadline_precision, deadline_part, created_at, waiting_since)
  values (uid, 'Book zoo tickets online', '30% off if booked online before the sale ends.', 1, 1, 1, env_computer,
          (today + interval '5 days 22 hours') at time zone tz, 'part_of_day', 'evening',
          now() - interval '2 days', now() - interval '2 days');

  insert into public.tasks (user_id, title, done_when, effort, impact, urgency, environment_id, state_id,
                            created_at, waiting_since)
  values (uid, 'Refresh CV', 'CV sent to three roles', 4, 4, 3, env_computer, st_focused,
          now() - interval '12 days', now() - interval '12 days')
  returning id into t_cv;

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id,
                            deadline_at, deadline_precision, deadline_part, created_at, waiting_since)
  values (uid, 'Call the bank about the new card', 2, 3, 3, env_privacy, st_productive,
          (today + interval '2 days 17 hours') at time zone tz, 'part_of_day', 'midday',
          now() - interval '3 days', now() - interval '3 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id, created_at, waiting_since)
  values (uid, 'Water the plants', 1, 1, 2, env_home, st_low, now() - interval '11 days', now() - interval '11 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id, created_at, waiting_since)
  values (uid, 'Reply to Sam about Saturday', 1, 2, 3, env_privacy, st_social, now() - interval '1 day', now() - interval '1 day');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, deadline_at, deadline_precision,
                            created_at, waiting_since)
  values (uid, 'Return library books', 1, 2, 2, env_errands, today at time zone tz, 'day', -- due by end of yesterday
          now() - interval '20 days', now() - interval '20 days');

  insert into public.tasks (user_id, title, description, effort, impact, urgency, environment_id, state_id,
                            created_at, waiting_since)
  values (uid, 'Plan the surprise party for Jo', 'Keep it quiet: only plan when on your own.', 3, 4, 2,
          env_privacy, st_focused, now() - interval '6 days', now() - interval '6 days')
  returning id into t_party;

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id,
                            deadline_at, deadline_precision, created_at, waiting_since)
  values (uid, 'Finish the quarterly report', 5, 4, 3, env_office, st_focused,
          (today + interval '10 days') at time zone tz, 'day', now() - interval '5 days', now() - interval '5 days')
  returning id into t_report;

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id,
                            deadline_at, deadline_precision, deadline_part, created_at, waiting_since)
  values (uid, 'Prepare slides for the team meeting', 3, 3, 3, env_computer, st_productive,
          (today + interval '10 days 12 hours') at time zone tz, 'part_of_day', 'morning',
          now() - interval '4 days', now() - interval '4 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id,
                            deadline_at, deadline_precision, created_at, waiting_since)
  values (uid, 'Book the car service', 1, 3, 2, env_computer,
          (today + interval '12 days') at time zone tz, 'day', now() - interval '4 days', now() - interval '4 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, state_id, created_at, waiting_since)
  values (uid, 'Fix the squeaky door', 2, 1, 1, env_home, st_low, now() - interval '15 days', now() - interval '15 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, event_id, event_relation, created_at, waiting_since)
  values (uid, 'Pack for the holiday', 4, 4, 3, ev_holiday, 'before', now() - interval '2 days', now() - interval '2 days')
  returning id into t_pack;

  insert into public.tasks (user_id, title, effort, impact, urgency, event_id, event_relation,
                            deadline_at, deadline_precision, deadline_part, created_at, waiting_since)
  values (uid, 'Send a birthday card with a holiday photo', 2, 4, 2, ev_holiday, 'during',
          (today + interval '22 days 22 hours') at time zone tz, 'part_of_day', 'evening',
          now() - interval '2 days', now() - interval '2 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, environment_id, event_id, event_relation,
                            created_at, waiting_since)
  values (uid, 'Unpack and do the laundry', 3, 2, 3, env_home, ev_holiday, 'after',
          now() - interval '2 days', now() - interval '2 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, event_id, event_relation, created_at, waiting_since)
  values (uid, 'Pick a restaurant for dinner with Alex', 1, 2, 3, ev_dinner, 'before',
          now() - interval '1 day', now() - interval '1 day');

  -- Finished and let go (they show in the Orbit)
  insert into public.tasks (user_id, title, effort, impact, urgency, done_at, created_at, waiting_since)
  values
    (uid, 'Clean out the garage', 5, 3, 2, now() - interval '2 days', now() - interval '20 days', now() - interval '20 days'),
    (uid, 'Get passport photos', 1, 3, 3, now() - interval '1 day', now() - interval '4 days', now() - interval '4 days'),
    (uid, 'Sort the recycling', 1, 1, 2, now() - interval '5 hours', now() - interval '3 days', now() - interval '3 days');

  insert into public.tasks (user_id, title, effort, impact, urgency, deadline_at, deadline_precision,
                            let_go_at, let_go_by, created_at, waiting_since)
  values (uid, 'Enter the photo competition', 3, 2, 2, (today - interval '16 days') at time zone tz, 'day',
          (today - interval '2 days') at time zone tz, 'horizon', now() - interval '40 days', now() - interval '40 days')
  returning id into t_comp;

  -- Steps
  insert into public.steps (user_id, task_id, title, position, done_at) values
    (uid, t_tax, 'Gather receipts', 1, now() - interval '3 days'),
    (uid, t_tax, 'Download bank statements', 2, null),
    (uid, t_tax, 'Fill in the return', 3, null),
    (uid, t_cv, 'Update the last two roles', 1, null),
    (uid, t_cv, 'Ask Priya to read it over', 2, null),
    (uid, t_report, 'Pull the numbers', 1, null),
    (uid, t_report, 'Write the summary', 2, null),
    (uid, t_report, 'Send for review', 3, null),
    (uid, t_party, 'Make a guest list', 1, null),
    (uid, t_party, 'Book a venue', 2, null),
    (uid, t_pack, 'Find the hiking boots', 1, null),
    (uid, t_pack, 'Pack the first-aid kit', 2, null);

  -- Views
  insert into public.saved_filters (user_id, name, filters) values
    (uid, 'At home, low energy', jsonb_build_object('environment_ids', jsonb_build_array(env_home),
      'state_ids', jsonb_build_array(st_low), 'overdue_only', false)),
    (uid, 'At the computer, focused', jsonb_build_object('environment_ids', jsonb_build_array(env_computer),
      'state_ids', jsonb_build_array(st_focused), 'overdue_only', false));

  -- Notes
  insert into public.system_notes (user_id, kind, local_day, task_ids, created_at)
  values (uid, 'auto_let_go', (today - interval '2 days')::date, array[t_comp], (today - interval '2 days') at time zone tz);

  perform set_config('horizon.skip_activity', 'off', true);

  -- History that matches the data above
  insert into public.task_activity (user_id, task_id, kind, details, occurred_at)
  select t.user_id, t.id, 'created',
         jsonb_build_object('title', t.title, 'effort', t.effort, 'impact', t.impact, 'urgency', t.urgency),
         t.created_at
    from public.tasks t where t.user_id = uid;
  insert into public.task_activity (user_id, task_id, kind, details, occurred_at)
  select t.user_id, t.id, 'done', jsonb_build_object('title', t.title, 'effort', t.effort), t.done_at
    from public.tasks t where t.user_id = uid and t.done_at is not null;
  insert into public.task_activity (user_id, task_id, kind, details, occurred_at)
  select t.user_id, t.id, 'let_go', jsonb_build_object('title', t.title, 'effort', t.effort, 'by', t.let_go_by), t.let_go_at
    from public.tasks t where t.user_id = uid and t.let_go_at is not null;
  insert into public.task_activity (user_id, task_id, kind, details, occurred_at)
  select s.user_id, s.task_id, 'step_done', jsonb_build_object('title', t.title, 'step_id', s.id, 'step', s.title), s.done_at
    from public.steps s join public.tasks t on t.id = s.task_id
   where s.user_id = uid and s.done_at is not null;
end;
$$;
revoke all on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;

-- Reset the demo if it hasn't been reset in the last 24 hours (or is empty). Called after "Try the demo".
create function public.refresh_demo_if_stale() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  last_reset timestamptz;
begin
  select p.demo_reset_at into last_reset from public.profiles p where p.user_id = uid and p.is_demo;
  if not found then
    return false;
  end if;
  if last_reset is null or last_reset < now() - interval '24 hours'
     or not exists (select 1 from public.tasks t where t.user_id = uid) then
    perform public.seed_demo_data();
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.refresh_demo_if_stale() from public, anon;
grant execute on function public.refresh_demo_if_stale() to authenticated;

-- Triggers: updated_at, task lifecycle bookkeeping, the activity log,
-- new-user bootstrap (profile + preset lists) and event unlinking.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'environments', 'states', 'events', 'tasks', 'steps', 'saved_filters', 'system_notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- tasks: keep the event link and waiting clock consistent
-- ---------------------------------------------------------------------------
create function public.tasks_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Unlinking an event (including when the event is deleted) clears the relation and lead time.
  if new.event_id is null then
    new.event_relation := null;
    new.lead_days := null;
  end if;

  if tg_op = 'UPDATE' then
    -- Undone or restored: the "been waiting a while" clock starts again.
    if (old.done_at is not null and new.done_at is null)
       or (old.let_go_at is not null and new.let_go_at is null) then
      new.waiting_since := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------------------------------------------------------------------------
-- Activity log. Security definer: clients can't write task_activity directly.
-- ---------------------------------------------------------------------------
create function public.log_activity(
  p_user_id uuid, p_task_id uuid, p_kind text, p_details jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.task_activity (user_id, task_id, kind, details)
  values (p_user_id, p_task_id, p_kind, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.log_activity(uuid, uuid, text, jsonb) from public, anon, authenticated;

create function public.tasks_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  snap jsonb := jsonb_build_object('title', new.title, 'effort', new.effort);
begin
  if current_setting('horizon.skip_activity', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.log_activity(new.user_id, new.id, 'created',
      snap || jsonb_build_object('impact', new.impact, 'urgency', new.urgency));
    return null;
  end if;

  -- Lifecycle
  if old.done_at is null and new.done_at is not null then
    perform public.log_activity(new.user_id, new.id, 'done', snap);
  elsif old.done_at is not null and new.done_at is null then
    perform public.log_activity(new.user_id, new.id, 'undone', snap);
  end if;

  if old.let_go_at is null and new.let_go_at is not null then
    perform public.log_activity(new.user_id, new.id, 'let_go', snap || jsonb_build_object('by', new.let_go_by));
  elsif old.let_go_at is not null and new.let_go_at is null then
    perform public.log_activity(new.user_id, new.id, 'restored', snap || jsonb_build_object('from', 'let_go'));
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_activity(new.user_id, new.id, 'deleted', snap);
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform public.log_activity(new.user_id, new.id, 'restored', snap || jsonb_build_object('from', 'deleted'));
  end if;

  -- Changes
  if (old.deadline_at, old.deadline_precision, old.deadline_part)
     is distinct from (new.deadline_at, new.deadline_precision, new.deadline_part) then
    perform public.log_activity(new.user_id, new.id, 'deadline_changed', snap || jsonb_build_object(
      'from', old.deadline_at, 'to', new.deadline_at,
      'from_precision', old.deadline_precision, 'to_precision', new.deadline_precision));
  end if;

  if (old.event_id, old.event_relation, old.lead_days)
     is distinct from (new.event_id, new.event_relation, new.lead_days) then
    perform public.log_activity(new.user_id, new.id, 'event_link_changed', snap || jsonb_build_object(
      'from_event', old.event_id, 'to_event', new.event_id,
      'from_relation', old.event_relation, 'to_relation', new.event_relation,
      'from_lead_days', old.lead_days, 'to_lead_days', new.lead_days));
  end if;

  if (old.effort, old.impact, old.urgency) is distinct from (new.effort, new.impact, new.urgency) then
    perform public.log_activity(new.user_id, new.id, 'scores_changed', snap || jsonb_build_object(
      'from', jsonb_build_object('effort', old.effort, 'impact', old.impact, 'urgency', old.urgency),
      'to', jsonb_build_object('effort', new.effort, 'impact', new.impact, 'urgency', new.urgency)));
  end if;

  if (old.title, old.description, old.done_when, old.environment_id, old.state_id)
     is distinct from (new.title, new.description, new.done_when, new.environment_id, new.state_id) then
    perform public.log_activity(new.user_id, new.id, 'edited', snap || jsonb_build_object(
      'fields', (
        select coalesce(jsonb_agg(f), '[]'::jsonb) from (values
          ('title', old.title is distinct from new.title),
          ('description', old.description is distinct from new.description),
          ('done_when', old.done_when is distinct from new.done_when),
          ('environment', old.environment_id is distinct from new.environment_id),
          ('state', old.state_id is distinct from new.state_id)
        ) as c(f, changed) where changed),
      'from_title', case when old.title is distinct from new.title then old.title end));
  end if;

  return null;
end;
$$;

create trigger tasks_activity
  after insert or update on public.tasks
  for each row execute function public.tasks_activity();

create function public.steps_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task_title text;
begin
  if current_setting('horizon.skip_activity', true) = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then
    select t.title into task_title from public.tasks t where t.id = old.task_id;
  else
    select t.title into task_title from public.tasks t where t.id = new.task_id;
  end if;
  if task_title is null then
    return null; -- the task itself is going (cascade); nothing to add
  end if;

  if tg_op = 'INSERT' then
    perform public.log_activity(new.user_id, new.task_id, 'step_added',
      jsonb_build_object('title', task_title, 'step_id', new.id, 'step', new.title));
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.user_id, old.task_id, 'step_deleted',
      jsonb_build_object('title', task_title, 'step_id', old.id, 'step', old.title));
  else
    if old.done_at is null and new.done_at is not null then
      perform public.log_activity(new.user_id, new.task_id, 'step_done',
        jsonb_build_object('title', task_title, 'step_id', new.id, 'step', new.title));
    elsif old.done_at is not null and new.done_at is null then
      perform public.log_activity(new.user_id, new.task_id, 'step_undone',
        jsonb_build_object('title', task_title, 'step_id', new.id, 'step', new.title));
    end if;
    if old.title is distinct from new.title then
      perform public.log_activity(new.user_id, new.task_id, 'step_edited',
        jsonb_build_object('title', task_title, 'step_id', new.id, 'from', old.title, 'to', new.title));
    end if;
    -- Position changes are logged once per reorder by public.reorder_steps().
  end if;
  return null;
end;
$$;

create trigger steps_activity
  after insert or update or delete on public.steps
  for each row execute function public.steps_activity();

-- ---------------------------------------------------------------------------
-- New user: profile, own copies of the preset lists, demo flag.
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, is_demo)
  values (new.id, lower(coalesce(new.email, '')) = 'demo@example.com')
  on conflict (user_id) do nothing;

  insert into public.environments (user_id, name, preset_key) values
    (new.id, 'Home', 'home'),
    (new.id, 'Computer', 'computer'),
    (new.id, 'Errands', 'errands'),
    (new.id, 'Office', 'office'),
    (new.id, 'Open hours', 'open_hours'),
    (new.id, 'Privacy', 'privacy')
  on conflict do nothing;

  insert into public.states (user_id, name, preset_key) values
    (new.id, 'Focused', 'focused'),
    (new.id, 'Productive', 'productive'),
    (new.id, 'Social', 'social'),
    (new.id, 'Low energy', 'low_energy')
  on conflict do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users created before this migration (e.g. you, if already set up) get bootstrapped too.
do $$
declare u record;
begin
  for u in select id, email from auth.users loop
    insert into public.profiles (user_id, is_demo)
    values (u.id, lower(coalesce(u.email, '')) = 'demo@example.com')
    on conflict (user_id) do nothing;
    if not exists (select 1 from public.environments e where e.user_id = u.id) then
      insert into public.environments (user_id, name, preset_key) values
        (u.id, 'Home', 'home'), (u.id, 'Computer', 'computer'), (u.id, 'Errands', 'errands'),
        (u.id, 'Office', 'office'), (u.id, 'Open hours', 'open_hours'), (u.id, 'Privacy', 'privacy');
    end if;
    if not exists (select 1 from public.states s where s.user_id = u.id) then
      insert into public.states (user_id, name, preset_key) values
        (u.id, 'Focused', 'focused'), (u.id, 'Productive', 'productive'),
        (u.id, 'Social', 'social'), (u.id, 'Low energy', 'low_energy');
    end if;
  end loop;
end
$$;

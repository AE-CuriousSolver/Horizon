-- Horizon v1 schema: tables, constraints and indexes.
-- Every table is per user: each row has user_id, and RLS (next migration)
-- limits every user to their own rows. Links between tables use composite
-- foreign keys on (user_id, id) so a row can never point at another user's data.
-- Names are neutral on purpose; user-facing labels live in src/lib/copy/en-GB.ts.

-- ---------------------------------------------------------------------------
-- profiles: per-user settings
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Australia/Sydney',
  focus_list_size smallint not null default 10 check (focus_list_size between 1 and 100),
  show_workings boolean not null default false,
  adjustment_flags jsonb not null default '{}'::jsonb check (jsonb_typeof(adjustment_flags) = 'object'),
  notes_seen_at timestamptz,
  is_demo boolean not null default false,
  demo_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- environments and states: each user's own copy of the presets, plus their own
-- ---------------------------------------------------------------------------
create table public.environments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  preset_key text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create unique index environments_user_name_key on public.environments (user_id, lower(btrim(name)));

create table public.states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  preset_key text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create unique index states_user_name_key on public.states (user_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- events: soft anchors. Instants in UTC plus the precision the user chose.
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  starts_at timestamptz not null,
  start_precision text not null default 'day' check (start_precision in ('day', 'part_of_day', 'exact')),
  start_part text check (start_part in ('morning', 'midday', 'evening')),
  ends_at timestamptz,
  end_precision text check (end_precision in ('day', 'part_of_day', 'exact')),
  end_part text check (end_part in ('morning', 'midday', 'evening')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at),
  constraint events_end_precision check ((ends_at is null) = (end_precision is null)),
  constraint events_start_part check ((start_precision = 'part_of_day') = (start_part is not null)),
  constraint events_end_part check ((coalesce(end_precision, '') = 'part_of_day') = (end_part is not null))
);
create index events_user_starts_idx on public.events (user_id, starts_at);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  description text check (length(description) <= 5000),
  done_when text check (length(done_when) <= 300),

  effort smallint not null default 3 check (effort between 1 and 5),
  impact smallint not null default 3 check (impact between 1 and 5),
  urgency smallint not null default 3 check (urgency between 1 and 5),

  environment_id uuid,
  state_id uuid,

  deadline_at timestamptz,
  deadline_precision text check (deadline_precision in ('day', 'part_of_day', 'exact')),
  deadline_part text check (deadline_part in ('morning', 'midday', 'evening')),

  event_id uuid,
  event_relation text check (event_relation in ('before', 'during', 'after')),
  lead_days smallint check (lead_days between 0 and 365),

  done_at timestamptz,
  let_go_at timestamptz,
  let_go_by text check (let_go_by in ('user', 'horizon')),
  deleted_at timestamptz,

  waiting_since timestamptz not null default now(),
  shaping_hint_dismissed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, id),
  foreign key (user_id, environment_id) references public.environments (user_id, id),
  foreign key (user_id, state_id) references public.states (user_id, id),
  -- Deleting an event unlinks its tasks; a trigger clears the relation too.
  foreign key (user_id, event_id) references public.events (user_id, id) on delete set null (event_id),

  constraint tasks_deadline_precision check ((deadline_at is null) = (deadline_precision is null)),
  constraint tasks_deadline_part check ((coalesce(deadline_precision, '') = 'part_of_day') = (deadline_part is not null)),
  constraint tasks_event_link check ((event_id is null) = (event_relation is null)),
  constraint tasks_done_or_let_go check (done_at is null or let_go_at is null),
  constraint tasks_let_go_by check ((let_go_at is null) = (let_go_by is null))
);
create index tasks_user_open_idx on public.tasks (user_id) where done_at is null and let_go_at is null and deleted_at is null;
create index tasks_user_event_idx on public.tasks (user_id, event_id) where event_id is not null;

-- ---------------------------------------------------------------------------
-- steps
-- ---------------------------------------------------------------------------
create table public.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 300),
  position integer not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade
);
create index steps_task_idx on public.steps (task_id, position);

-- ---------------------------------------------------------------------------
-- saved_filters: Views
-- ---------------------------------------------------------------------------
create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index saved_filters_user_name_key on public.saved_filters (user_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- system_notes: what Horizon did and why. At most one per kind per local day.
-- ---------------------------------------------------------------------------
create table public.system_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'auto_let_go', 'hidden_by_event', 'deleted',
    'brought_forward', 'light_run_boost', 'heavy_run_boost', 'quick_win'
  )),
  local_day date not null,
  task_ids uuid[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, local_day)
);
create index system_notes_user_created_idx on public.system_notes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ordering_suppressions: "Not right? Put it back" on an ordering Note
-- ---------------------------------------------------------------------------
create table public.ordering_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  adjustment text not null check (adjustment in ('quick_win', 'heavy_run', 'light_run', 'brought_forward')),
  until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, adjustment),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- task_activity: append-only history. No FK to tasks, so it outlives them.
-- Written only by triggers and security-definer functions.
-- ---------------------------------------------------------------------------
create table public.task_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  kind text not null check (kind in (
    'created', 'done', 'undone', 'let_go', 'deleted', 'restored',
    'deadline_changed', 'event_link_changed', 'scores_changed', 'edited',
    'step_added', 'step_done', 'step_undone', 'step_edited', 'step_deleted', 'steps_reordered'
  )),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index task_activity_user_time_idx on public.task_activity (user_id, occurred_at desc);
create index task_activity_task_idx on public.task_activity (task_id, occurred_at);

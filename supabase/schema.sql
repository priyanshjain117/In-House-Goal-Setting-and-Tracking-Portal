create extension if not exists "pgcrypto";

create type app_role as enum ('employee', 'manager', 'admin');
create type goal_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type goal_uom as enum ('numeric', 'percentage', 'timeline', 'zero_based');
create type goal_type as enum ('min', 'max');
create type review_status as enum ('approved', 'rejected');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  manager_id uuid references public.users(id),
  name text not null,
  email text not null unique,
  role app_role not null default 'employee',
  department text,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  thrust_area text not null,
  title text not null,
  description text not null,
  uom goal_uom not null,
  goal_type goal_type not null,
  target text not null,
  weightage numeric(5,2) not null check (weightage >= 10 and weightage <= 100),
  status goal_status not null default 'draft',
  locked boolean not null default false,
  cycle_key text not null default 'FY26-Q1',
  parent_goal_id uuid references public.goals(id),
  shared_goal_group_id uuid,
  analytics_tags text[] not null default '{}',
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manager_reviews (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  manager_id uuid not null references public.users(id),
  status review_status not null,
  comment text,
  review_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index users_manager_id_idx on public.users(manager_id);
create index goals_owner_status_idx on public.goals(owner_id, status);
create index goals_cycle_status_idx on public.goals(cycle_key, status);
create index manager_reviews_goal_id_idx on public.manager_reviews(goal_id);

alter table public.users enable row level security;
alter table public.goals enable row level security;
alter table public.manager_reviews enable row level security;

-- Phase 1 ships with mock auth in the app. Enable Supabase Auth policies when replacing the mock user switcher.
-- Future extensibility:
-- quarterly_checkins: goal_id, checkin_period, progress_value, confidence, blocker_notes
-- audit_logs: actor_id, entity_type, entity_id, action, before_payload, after_payload
-- notifications: recipient_id, channel, template_key, payload, read_at
-- shared_goals: group_id, owner_id, contributor_id, contribution_weightage

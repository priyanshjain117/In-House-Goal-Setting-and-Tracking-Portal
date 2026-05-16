create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('employee', 'manager', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_type as enum ('min', 'max');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_action as enum ('approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.progress_status as enum ('not_started', 'on_track', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_quarter as enum ('Q1', 'Q2', 'Q3', 'Q4');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.app_role not null default 'employee',
  manager_id uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete cascade,
  thrust_area text not null,
  title text not null,
  description text not null,
  uom text not null,
  goal_type public.goal_type not null,
  target text not null,
  weightage numeric(5,2) not null check (weightage >= 10 and weightage <= 100),
  status public.goal_status not null default 'draft',
  approved boolean not null default false,
  locked boolean not null default false,
  manager_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_goals_are_locked check (approved = false or locked = true),
  constraint submitted_or_terminal_status check (status in ('draft', 'submitted', 'approved', 'rejected'))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_uom_allowed'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_uom_allowed
      check (uom in ('numeric', 'percentage', 'timeline', 'zero_based'));
  end if;
end $$;

create table if not exists public.manager_reviews (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  manager_id uuid not null references public.users(id) on delete cascade,
  comment text,
  action public.review_action not null,
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  employee_id uuid not null references public.users(id) on delete cascade,
  quarter public.goal_quarter not null,
  actual_value text not null default '',
  status public.progress_status not null default 'not_started',
  employee_comment text,
  manager_comment text,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, quarter)
);

create table if not exists public.quarterly_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete cascade,
  manager_id uuid references public.users(id) on delete set null,
  quarter public.goal_quarter not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, quarter)
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references public.achievement_updates(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  quarter public.goal_quarter not null,
  progress_percent numeric(5,2) not null check (progress_percent >= 0 and progress_percent <= 100),
  status public.progress_status not null,
  captured_at timestamptz not null default now()
);

create index if not exists users_manager_id_idx on public.users(manager_id);
create index if not exists goals_employee_status_idx on public.goals(employee_id, status);
create index if not exists goals_created_at_idx on public.goals(created_at);
create index if not exists manager_reviews_goal_id_idx on public.manager_reviews(goal_id);
create index if not exists manager_reviews_manager_id_idx on public.manager_reviews(manager_id);
create index if not exists achievement_updates_employee_quarter_idx on public.achievement_updates(employee_id, quarter);
create index if not exists achievement_updates_goal_quarter_idx on public.achievement_updates(goal_id, quarter);
create index if not exists quarterly_reviews_employee_quarter_idx on public.quarterly_reviews(employee_id, quarter);
create index if not exists check_ins_achievement_id_idx on public.check_ins(achievement_id);
create index if not exists progress_snapshots_goal_quarter_idx on public.progress_snapshots(goal_id, quarter);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists set_achievement_updates_updated_at on public.achievement_updates;
create trigger set_achievement_updates_updated_at
before update on public.achievement_updates
for each row execute function public.set_updated_at();

drop trigger if exists set_quarterly_reviews_updated_at on public.quarterly_reviews;
create trigger set_quarterly_reviews_updated_at
before update on public.quarterly_reviews
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'employee')
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists create_profile_for_auth_user on auth.users;
create trigger create_profile_for_auth_user
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.prevent_locked_goal_edits()
returns trigger
language plpgsql
as $$
begin
  if old.locked = true and new.locked = true and (
    old.thrust_area is distinct from new.thrust_area
    or old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.uom is distinct from new.uom
    or old.goal_type is distinct from new.goal_type
    or old.target is distinct from new.target
    or old.weightage is distinct from new.weightage
  ) then
    raise exception 'Locked goals must be unlocked before editing';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_goal_edits on public.goals;
create trigger prevent_locked_goal_edits
before update on public.goals
for each row execute function public.prevent_locked_goal_edits();

alter table public.users enable row level security;
alter table public.goals enable row level security;
alter table public.manager_reviews enable row level security;
alter table public.achievement_updates enable row level security;
alter table public.quarterly_reviews enable row level security;
alter table public.check_ins enable row level security;
alter table public.progress_snapshots enable row level security;

drop policy if exists "Users can read self team and admin profiles" on public.users;
create policy "Users can read self team and admin profiles"
on public.users for select
to authenticated
using (
  id = auth.uid()
  or manager_id = auth.uid()
  or public.current_user_role() in ('manager', 'admin')
);

drop policy if exists "Employees read own goals" on public.goals;
create policy "Employees read own goals"
on public.goals for select
to authenticated
using (employee_id = auth.uid());

drop policy if exists "Employees create own draft goals" on public.goals;
create policy "Employees create own draft goals"
on public.goals for insert
to authenticated
with check (
  employee_id = auth.uid()
  and locked = false
  and approved = false
  and status = 'draft'
);

drop policy if exists "Employees update editable own goals" on public.goals;
create policy "Employees update editable own goals"
on public.goals for update
to authenticated
using (
  employee_id = auth.uid()
  and locked = false
  and status in ('draft', 'rejected')
)
with check (
  employee_id = auth.uid()
  and locked = false
  and status in ('draft', 'submitted', 'rejected')
);

drop policy if exists "Employees delete editable own goals" on public.goals;
create policy "Employees delete editable own goals"
on public.goals for delete
to authenticated
using (
  employee_id = auth.uid()
  and locked = false
  and status in ('draft', 'rejected')
);

drop policy if exists "Managers view team goals" on public.goals;
create policy "Managers view team goals"
on public.goals for select
to authenticated
using (
  exists (
    select 1
    from public.users employee
    where employee.id = goals.employee_id
      and employee.manager_id = auth.uid()
  )
);

drop policy if exists "Managers update submitted team goals" on public.goals;
create policy "Managers update submitted team goals"
on public.goals for update
to authenticated
using (
  status = 'submitted'
  and exists (
    select 1
    from public.users employee
    where employee.id = goals.employee_id
      and employee.manager_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.users employee
    where employee.id = goals.employee_id
      and employee.manager_id = auth.uid()
  )
);

drop policy if exists "Admins access all goals" on public.goals;
create policy "Admins access all goals"
on public.goals for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Employees managers admins read reviews" on public.manager_reviews;
create policy "Employees managers admins read reviews"
on public.manager_reviews for select
to authenticated
using (
  manager_id = auth.uid()
  or exists (
    select 1
    from public.goals goal
    where goal.id = manager_reviews.goal_id
      and goal.employee_id = auth.uid()
  )
  or public.current_user_role() = 'admin'
);

drop policy if exists "Managers create reviews for team goals" on public.manager_reviews;
create policy "Managers create reviews for team goals"
on public.manager_reviews for insert
to authenticated
with check (
  manager_id = auth.uid()
  and exists (
    select 1
    from public.goals goal
    join public.users employee on employee.id = goal.employee_id
    where goal.id = manager_reviews.goal_id
      and employee.manager_id = auth.uid()
  )
);

drop policy if exists "Admins access all reviews" on public.manager_reviews;
create policy "Admins access all reviews"
on public.manager_reviews for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Employees view own achievement updates" on public.achievement_updates;
create policy "Employees view own achievement updates"
on public.achievement_updates for select
to authenticated
using (employee_id = auth.uid());

drop policy if exists "Employees update own approved achievement updates" on public.achievement_updates;
create policy "Employees update own approved achievement updates"
on public.achievement_updates for all
to authenticated
using (
  employee_id = auth.uid()
  and exists (
    select 1 from public.goals goal
    where goal.id = achievement_updates.goal_id
      and goal.status = 'approved'
  )
)
with check (
  employee_id = auth.uid()
  and exists (
    select 1 from public.goals goal
    where goal.id = achievement_updates.goal_id
      and goal.status = 'approved'
  )
);

drop policy if exists "Managers view and comment on team achievements" on public.achievement_updates;
create policy "Managers view and comment on team achievements"
on public.achievement_updates for all
to authenticated
using (
  exists (
    select 1
    from public.users employee
    where employee.id = achievement_updates.employee_id
      and employee.manager_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.users employee
    where employee.id = achievement_updates.employee_id
      and employee.manager_id = auth.uid()
  )
);

drop policy if exists "Admins access all achievement updates" on public.achievement_updates;
create policy "Admins access all achievement updates"
on public.achievement_updates for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Quarterly reviews visible to owners managers admins" on public.quarterly_reviews;
create policy "Quarterly reviews visible to owners managers admins"
on public.quarterly_reviews for all
to authenticated
using (
  employee_id = auth.uid()
  or manager_id = auth.uid()
  or public.current_user_role() = 'admin'
)
with check (
  employee_id = auth.uid()
  or manager_id = auth.uid()
  or public.current_user_role() = 'admin'
);

drop policy if exists "Check ins visible to related users" on public.check_ins;
create policy "Check ins visible to related users"
on public.check_ins for all
to authenticated
using (
  actor_id = auth.uid()
  or public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.achievement_updates update_row
    join public.users employee on employee.id = update_row.employee_id
    where update_row.id = check_ins.achievement_id
      and (employee.id = auth.uid() or employee.manager_id = auth.uid())
  )
)
with check (
  actor_id = auth.uid()
  or public.current_user_role() = 'admin'
);

drop policy if exists "Progress snapshots visible to related users" on public.progress_snapshots;
create policy "Progress snapshots visible to related users"
on public.progress_snapshots for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.goals goal
    join public.users employee on employee.id = goal.employee_id
    where goal.id = progress_snapshots.goal_id
      and (employee.id = auth.uid() or employee.manager_id = auth.uid())
  )
);

notify pgrst, 'reload schema';

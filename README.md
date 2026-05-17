# GoalOS: Goal Setting & Tracking Portal

Hackathon-ready enterprise goal creation, manager approval, admin unlock, and Supabase Auth workflows.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style Radix primitives
- Supabase Auth, Postgres, RLS, and middleware route protection

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the full contents of `supabase/schema.sql`.
3. Keep these values configured in `.env` or `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SMTP_EMAIL=your-gmail-address@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

`SUPABASE_SERVICE_ROLE_KEY` is used by the local seed script and, when present, by server-side notification logging so email delivery does not depend on end-user RLS. Do not expose it with a `NEXT_PUBLIC_` prefix.

`SMTP_EMAIL` and `SMTP_PASSWORD` enable Gmail SMTP sending through Nodemailer. Use a Gmail app password. If either value is missing, notification actions still create in-app notifications and record skipped email logs, which keeps the demo workflow stable.

4. Seed demo Auth users and role rows:

```bash
npm run db:seed
```

5. Start the app and open `/login`.
6. Sign in with:

```txt
Employee: employee@demo.com / Employee123
Manager:  manager@demo.com  / Manager123
Admin/HR: admin@demo.com    / Admin123
```

After login, users are redirected by role:

- Employee: `/employee`
- Manager: `/manager`
- Admin/HR: `/admin`

## Auth Architecture

- `middleware.ts` refreshes Supabase sessions and protects `/employee`, `/manager`, and `/admin`.
- Dashboard screens fetch workspace data through `app/api/workspace/route.ts`.
- `lib/services/workspace-api-client.ts` is the frontend API client. It does not contain demo records.
- `lib/services/workspace-repository.ts` is the server-side Supabase repository used by the API route.
- `lib/supabase/server.ts` creates authenticated server Supabase clients from the active session cookies.
- `lib/auth.ts` centralizes profile loading and role redirects.
- `app/login/actions.ts` handles login and logout.
- Roles live in `public.users.role` and are enforced with RLS policies.

## Demo Data Architecture

The demo follows `Frontend -> Next API -> Supabase`.

- Frontend components render only API responses and user-entered form state.
- Workspace records are read from Supabase tables: `users`, `goals`, `manager_reviews`, and `achievement_updates`.
- Notifications are read from `notifications`; delivery attempts are tracked in `email_logs`.
- `npm run db:seed` inserts the hackathon demo records into Supabase; the app runtime has no localStorage/mock JSON fallback.

## Schema Cache Fix

If Supabase returns `Could not find the table 'public.users' in the schema cache`, run `supabase/schema.sql` in the SQL Editor again. The schema ends with:

```sql
notify pgrst, 'reload schema';
```

Then run `npm run db:seed` once so the demo Auth users and `public.users` rows exist together.

## Goal Workflow

- Employees create, edit, delete, and submit goals.
- Goal edit uses controlled form state and Supabase `update` by goal id.
- Goal type supports stable `min` / `max` enum handling.
- Validation enforces max 8 goals, minimum 10% per goal, and exactly 100% total weightage before submission.
- Managers can review submitted goals and approve or reject them.
- Approved goals are locked.
- Admin/HR can unlock goals back to draft.

## Email Notifications

GoalOS sends enterprise-style workflow notifications through Gmail SMTP and Nodemailer:

- Employee submits goals -> manager gets `Goal Sheet Submitted`.
- Manager approves goals -> employee gets `Goals Approved`.
- Manager rejects goals -> employee gets `Goals Returned for Rework`.
- Manager/Admin sends quarterly reminders -> employees with pending check-ins get `Quarterly Check-in Reminder`; the sender is copied on the email.

Each event also creates a lightweight in-app notification shown in the header bell. Email attempts use a `dedupe_key` in `email_logs` to prevent duplicate sends during repeat clicks or retries.

## Escalation Governance

Admin/HR gets an escalation command center for overdue workflow actions:

- Goal submission delay after the goal-setting due date.
- Manager approval delay for submitted plans past the approval window.
- Quarterly check-in delay for approved goals missing the latest due check-in.

The module is intentionally lightweight: no cron jobs or queues. Admin syncs rules on demand from the dashboard, and the app records active/resolved items in `escalations` plus history in `escalation_logs`.

If your database was created before this module, run the latest `supabase/schema.sql` in the Supabase SQL Editor. It uses `create table if not exists`, so it adds escalation tables without resetting existing users, goals, reviews, achievements, notifications, or email logs.

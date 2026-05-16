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
```

`SUPABASE_SERVICE_ROLE_KEY` is only used server-side by the login page setup button to create demo Auth users. Do not expose it with a `NEXT_PUBLIC_` prefix.

4. Seed demo Auth users and role rows:

```bash
npm run db:seed
```

You can also click **Create demo accounts** on `/login`; both paths use the same existing env values and do not modify env files.

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
- `lib/supabase/client.ts` is for client components.
- `lib/supabase/server.ts` is for server components and actions.
- `lib/auth.ts` centralizes profile loading and role redirects.
- `app/login/actions.ts` handles login, logout, and demo account creation.
- Roles live in `public.users.role` and are enforced with RLS policies.

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

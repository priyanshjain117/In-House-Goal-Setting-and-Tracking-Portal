# GoalOS: Goal Setting & Tracking Portal

Phase 1 hackathon-ready MVP for enterprise goal creation, manager approval, and admin unlock workflows.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style Radix primitives
- Supabase schema in `supabase/schema.sql`
- Mock role switching for Employee, Manager, and Admin

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Add these environment variables when replacing mock storage with Supabase queries:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Folder Structure

```txt
app/                      App Router shell and page entry
components/ui/            Reusable shadcn/ui-style primitives
components/dashboard/     Role dashboards, tables, badges
components/goals/         Goal form dialog
lib/domain/               Types and reusable validation logic
lib/data/                 Seed users and goals
lib/services/             Mock persistence and Supabase client boundary
supabase/schema.sql       Scalable Phase 1 database schema
```

## Phase 1 Workflow

- Employee creates, edits, and deletes draft goals.
- Live validation enforces max 8 goals, minimum 10% per goal, and exactly 100% total weightage.
- Employee submits valid goals for manager approval.
- Manager reviews submitted employee goals, inline edits target and weightage, adds comments, then approves or rejects.
- Approved goals become locked.
- Admin views all users/goals and can unlock approved goals back to draft for employee edits.

The UI currently persists data in `localStorage` so the full workflow works without auth or backend setup. The Supabase schema is ready for wiring in server actions or route handlers in the next phase.
# In-House-Goal-Setting-and-Tracking-Portal

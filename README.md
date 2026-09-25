# AJL Group — Admin Dashboard

Internal admin panel for the three AJL Group partners (Alan, Jaziel, Leo):
projects, tasks, calendar, finance and notes, with live updates between
partners. Built with Next.js 14 (App Router), TypeScript, Tailwind + shadcn/ui
and Supabase (Postgres, Auth, Realtime).

## Prerequisites

- Node.js **>= 20.19** (see `engines` in `package.json`)
- A Supabase project (free tier is fine)

## 1. Install

```bash
npm install
```

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` (Supabase Dashboard > Project Settings > API):

| Variable | Used by | Set on Vercel? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run seed` only | **No — never** |
| `SEED_PASSWORD_ALAN` / `_JAZIEL` / `_LEO` | `npm run seed` only | **No — never** |

The service role key bypasses Row Level Security; keep it on your machine
only. The seed passwords are blank in the example file on purpose: the seed
script refuses to run until all of them are set.

## 3. Database setup

1. Open Supabase Dashboard > **SQL Editor**.
2. Paste and run the whole of `supabase/migrations/001_initial_schema.sql`.
   It creates the enums, tables, indexes, the `is_partner()` helper, the RLS
   policies, the `notes.updated_at` trigger, and adds the tables to the
   `supabase_realtime` publication (live updates need no extra setup).
3. Then run `supabase/migrations/002_project_color_deliverables.sql` the same way (migrations run in order).
4. Then run `supabase/migrations/003_task_details.sql` (creates the private `task-files` Storage bucket too).
5. Then run `supabase/migrations/004_clients.sql` (moves each project's client text into the new Clients section and creates the public `client-logos` bucket).

## 5. REQUIRED: disable public sign-up

Supabase Dashboard > **Authentication** > **Sign In / Providers** (named
"Providers" in older dashboards) > turn **off** "Allow new users to sign up".

The app has no registration page, but Supabase Auth accepts sign-ups from
anyone holding the (public) anon key unless this is disabled. RLS also only
grants access to users that have a row in `public.users` (via
`is_partner()`), so a stray sign-up sees nothing — but disable sign-up anyway.

## 6. Seed the partner accounts

```bash
npm run seed
```

Creates the three partner accounts in Supabase Auth plus their
`public.users` profile rows, using the `SEED_PASSWORD_*` values. Run it once;
partners should change their passwords after the first login.

## Development

```bash
npm run dev      # http://localhost:3000
npm test         # Vitest unit/component tests
npx tsc --noEmit # type check
npm run lint     # ESLint
npm run build    # production build
```

## Deploy (Vercel)

1. Import the repository in Vercel (framework preset: Next.js).
2. Add **only** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   as environment variables. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` or
   any `SEED_PASSWORD_*`.
3. Deploy. In Supabase > Authentication > URL Configuration, set the Site URL
   to your Vercel domain.

Dates such as "today" and "overdue" are computed in `America/Mexico_City`
(`APP_TIME_ZONE` in `src/lib/constants.ts`), independent of the server's
time zone.

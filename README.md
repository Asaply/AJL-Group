This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database setup

1. Open the Supabase Dashboard for this project, go to **SQL Editor**, and run the contents of [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql). This creates all tables, enums, RLS policies, the `notes.updated_at` trigger, and enables realtime on `projects`, `project_members`, `tasks`, and `transactions`.
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's API settings.
   - `SEED_PASSWORD_ALAN`, `SEED_PASSWORD_JAZIEL`, `SEED_PASSWORD_LEO` — the initial login passwords for the 3 partner accounts (Alan, Jaziel, Leo). Pick your own values; they are never committed.
3. Run `npm run seed` to create the 3 partner accounts (Supabase Auth users + `users` table rows). The script reads `.env.local` automatically and exits with an error listing any missing environment variables before contacting Supabase.
4. Verify the 3 users in Supabase Dashboard > Authentication > Users, then change passwords after first login.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

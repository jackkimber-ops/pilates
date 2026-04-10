# Re:Form Studio MVP

Private, mobile-first internal booking and package management app for Re:Form, a small Pilates studio. The app is for 2 admin users only and covers customers, packages, one-offs, trials, scheduling, bookings, attendance, recurring rules, reporting, and optional Google Calendar sync.

All pricing is in VND.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL
- FullCalendar
- Zod

## Features

- Admin-only email/password login with HTTP-only database-backed sessions
- Customers, instructors, class types, and package template management
- Package, one-off, and trial sales
- Calendar-first session management with overlap blocking
- Booking management with package, one-off, trial, and override payment sources
- Attendance with idempotent package deduction and entitlement consumption
- Recurring booking rules with conflict reporting
- Reports for sales, balances, attendance, and trials
- Optional one-way Google Calendar sync

## Local development

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and `DIRECT_URL`.
   - For local Postgres, they can use the same value.
3. Use Node.js 20 or newer.
4. Install dependencies:

```bash
npm install
```

5. Apply migrations:

```bash
npm run db:migrate:deploy
```

6. Seed the database:

```bash
npm run db:seed
```

7. Start the app:

```bash
npm run dev
```

8. Sign in with one of the seeded admin users:

- `phuong@reform.local`
- `phoebe@reform.local`
- Password: value from `SEED_ADMIN_DEFAULT_PASSWORD` (defaults to `Pilates123!`)

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run vercel-build
npm run db:generate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:push
npm run db:seed
npm run db:studio
```

## Environment variables

See [.env.example](/Users/Jack.kimber/Documents/Codex/Pilates/.env.example).

Required:

- `DATABASE_URL`
- `DIRECT_URL`

Recommended:

- `APP_URL`
- `APP_TIMEZONE`
- `SEED_ADMIN_DEFAULT_PASSWORD`

Optional:

- `CRON_SECRET`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_IMPERSONATED_USER`
- `GOOGLE_DELETE_CANCELLED_EVENTS`

Notes:

- This app uses custom database-backed session auth, so `NEXTAUTH_*` variables are not required.
- If your Postgres provider does not give you a separate direct connection string, set `DIRECT_URL` to the same value as `DATABASE_URL`.
- `APP_URL` should be your real production URL in Vercel production.
- If `APP_URL` is not set, the app can fall back to Vercel system URLs such as `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`.

## Prisma and database workflow

This project now includes committed Prisma migrations for production deploys.

Use:

- `npm run db:migrate:dev` when you change the Prisma schema in development
- `npm run db:migrate:deploy` for non-interactive production deployment
- `npm run db:push` only for quick local prototyping

If your local database was created earlier with `db push`, you may need to reset it or mark the initial migration as applied before switching fully to the migration workflow.

## Deploy

### Platform

Use Vercel.

This is a Next.js App Router app with server rendering, Prisma, PostgreSQL, and no local file storage requirements, so Vercel is the simplest production path.

### What the app needs in production

- Node.js 20
- npm
- Vercel project connected to the repo
- hosted PostgreSQL database
- Prisma migrations applied with `prisma migrate deploy`
- environment variables set in Vercel

### Stack summary

- Framework: Next.js 16
- Package manager: npm
- Build command: `npm run build`
- Start command: `npm run start`
- Production preflight: `npm run deploy:check`
- Database: PostgreSQL via Prisma
- Static/media handling: no user uploads or persistent local file storage

### Simplest production database

The simplest option is Vercel Postgres or Neon Postgres.

Set:

- `DATABASE_URL` to the pooled/runtime connection string
- `DIRECT_URL` to the direct connection string for Prisma migrations

If your provider only gives one Postgres URL, use the same value for both.

### Environment variables in Vercel

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `APP_TIMEZONE`

Recommended:

- `SEED_ADMIN_DEFAULT_PASSWORD`

Optional:

- `CRON_SECRET`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_IMPERSONATED_USER`
- `GOOGLE_DELETE_CANCELLED_EVENTS`

Recommended split:

- `Production`
  - production database
  - `APP_URL=https://your-real-domain`
- `Preview`
  - separate preview database if possible
  - otherwise previews will hit shared data
- `Development`
  - local or dev database

### Exact local commands

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Set your local Postgres values in `.env`.

4. Apply migrations:

```bash
npm run db:migrate:deploy
```

5. Seed local data if needed:

```bash
npm run db:seed
```

6. Run production preflight:

```bash
npm run deploy:check
```

7. Start locally:

```bash
npm run dev
```

### Exact Vercel deploy steps

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Vercel, create a new project from the repo.
3. Keep the framework preset as `Next.js`.
4. Use the default install command.
5. Use the default build command `npm run build`.
6. Add the required environment variables in Vercel.
7. Trigger the first deploy.
8. Run production migrations against the production database:

```bash
npm run db:migrate:deploy
```

9. Open the deployed site and verify login and core flows.

If you prefer the Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

### Post-deploy checks

Check:

1. `/login` loads
2. `/api/health` returns `ok: true`
3. admin login works
4. dashboard loads
5. create customer works
6. sell package works
7. create session works
8. booking works
9. attendance works
10. logout works

### Deployment checklist

- Node 20 selected
- Postgres connected
- `DATABASE_URL` set
- `DIRECT_URL` set
- `APP_URL` set
- `APP_TIMEZONE` set
- optional Google env vars set if needed
- `npm run db:migrate:deploy` run against production
- `/api/health` checked
- login checked
- package sale checked
- session creation checked
- booking checked
- attendance checked

### Rollback checklist

- identify the last healthy Vercel deployment
- promote or redeploy the previous healthy deployment
- do not roll back database schema manually unless you have a tested reverse migration
- if the issue is app-only, keep the current database and roll back code first
- verify `/login` and `/api/health`
- verify login, session creation, and booking after rollback
- pause further deploys until the failed release is understood

### Troubleshooting

- Build fails with Prisma client errors:
  - confirm `postinstall` ran
  - run `npm run db:generate`
- Runtime fails with missing env vars:
  - check `DATABASE_URL`, `DIRECT_URL`, and `APP_URL`
- Production deploy succeeds but schema is old:
  - run `npm run db:migrate:deploy`
- Login fails in production:
  - confirm database access and seeded or real admin users
- Google Calendar does not sync:
  - all required `GOOGLE_*` variables must be set together
- Preview deploy is using live data:
  - move preview to its own database

## Deployment checklist

- Hosted Postgres is connected
- `DATABASE_URL` is set in Vercel
- `DIRECT_URL` is set in Vercel
- `APP_URL` is set to the production domain
- Google Calendar env vars are set if needed
- `npm run db:migrate:deploy` has been run
- Seed has been run if required
- `/api/health` returns `ok: true`
- Login works
- Package sale works
- Session creation works
- Booking works
- Attendance works

## Google Calendar

Google sync is optional. The app works without it.

Detailed setup is in [GOOGLE_CALENDAR_SETUP.md](/Users/Jack.kimber/Documents/Codex/Pilates/GOOGLE_CALENDAR_SETUP.md).

## Verification

The project has been checked with:

```bash
npm run lint
npm run typecheck
npm run build
```

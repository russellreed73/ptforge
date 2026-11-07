# PTForge

Client, program and progress management for personal trainers and strength coaches,
with a phone app (PWA) for their athletes. Multi-tenant: every coaching business gets
its own private space at `ptforge.app/<business>`.

**Status: phase 1 in progress.** Done: phase 0 foundation, step 1 (emails), step 2 (team and
invitations), Jacob's Next Level theme, and step 3 (forgot/reset password, two-step login,
7-day coach sessions).

Full plan: the "PTForge — Implementation Plan" doc in the Claude project.

---

## 1. One-time setup (Windows)

Install these first:

| Tool           | Get it                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Node.js 24 LTS | https://nodejs.org                                                              |
| Git            | https://git-scm.com                                                             |
| Docker Desktop | https://www.docker.com/products/docker-desktop                                  |
| VS Code        | https://code.visualstudio.com (accept the recommended extensions when prompted) |

Then, in PowerShell:

```powershell
cd C:\devsites\ptforge

# pnpm (package manager). If corepack fails, use: npm install -g pnpm
corepack enable

pnpm install

# Your local settings file (never committed)
Copy-Item .env.example .env.local
pnpm dlx auth@latest secret        # copy the value into BETTER_AUTH_SECRET in .env.local

# Start Postgres (Docker Desktop must be running), build the tables, load demo data
pnpm db:up
pnpm db:migrate
pnpm db:seed

pnpm dev
```

Open http://localhost:3000 and sign in with a demo account. Every email the app sends
locally (confirmations, password resets, invitations) appears in Mailpit at
http://localhost:8025 instead of going out. Every demo password is
`forge-ahead-demo-2026`.

| Email             | Business       | Roles             | Sees                 |
| ----------------- | -------------- | ----------------- | -------------------- |
| jacob@example.com | Jacob Strength | admin + trainer   | all 3 athletes       |
| maya@example.com  | Jacob Strength | manager + trainer | all 3 athletes       |
| sam@example.com   | Jacob Strength | trainer           | Alex only (assigned) |
| alex@example.com  | Jacob Strength | athlete           | own profile          |
| riley@example.com | Riverside PT   | admin             | Taylor only          |

Try signing in as Sam and then as Jacob: same page, different athletes. That's
Row-Level Security at work. Riley visiting `/jacob-strength` gets a 404.

## 2. Put it on GitHub

```powershell
git init -b main
git add .
git commit -m "Phase 0: foundation"
# Create an empty private repo named ptforge on github.com, then:
git remote add origin https://github.com/<your-account>/ptforge.git
git push -u origin main
```

Then on GitHub: **Settings → Branches → Add rule** for `main`: require a pull request
and require the **CI / check** status to pass. From now on, work on a branch
(`git switch -c feat/client-profiles`), push it, and open a pull request.

## 3. Everyday commands

| Command                  | What it does                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm dev`               | Run the app at http://localhost:3000                                                 |
| `pnpm test`              | Unit tests + tenant isolation tests (needs the database running)                     |
| `pnpm lint`              | ESLint                                                                               |
| `pnpm typecheck`         | TypeScript                                                                           |
| `pnpm format`            | Prettier (VS Code also formats on save)                                              |
| `pnpm db:up` / `db:down` | Start / stop local Postgres and Mailpit                                              |
| `pnpm db:generate`       | Create a migration after changing `src/server/db/schema/*`                           |
| `pnpm db:migrate`        | Apply migrations                                                                     |
| `pnpm db:seed`           | Load demo data (safe to repeat)                                                      |
| `pnpm db:reset`          | Wipe the LOCAL database and rebuild it                                               |
| `pnpm db:studio`         | Browse the database in your browser                                                  |
| `pnpm email:preview`     | Preview the email templates at http://localhost:3001                                 |
| `pnpm auth:generate`     | Regenerate auth tables after changing `src/server/auth/index.ts`, then `pnpm format` |

**Never run `drizzle-kit push`.** It doesn't know about the security policies.
Always `db:generate` then `db:migrate`.

## 4. How it's organized

```
src/
  app/
    (auth)/sign-in, sign-up     public pages
    [tenant]/                   everything inside one business (ptforge.app/<slug>)
    api/auth/[...all]/          Better Auth endpoints
  proxy.ts                      redirects signed-out visitors to /sign-in
  server/
    auth/index.ts               Better Auth config (passwords, sessions, plugins)
    auth/permissions.ts         the five roles and can()
    auth/session.ts             getSession(), requireUser(), requireTenant()
    db/schema/auth.ts           auth tables (generated)
    db/schema/app.ts            PTForge tables
    db/tenant.ts                withTenant(): all tenant data goes through this
  lib/                          shared helpers (auth client, slugs)
drizzle/                        migrations, incl. 0001_row_level_security.sql
scripts/                        seed and reset
tests/                          Vitest tests
```

### Themes

All colours and fonts come from theme variables in `src/app/globals.css`
(`[data-theme="next-level"]` is Jacob's brand: near-black, red `#E8171A`, teal `#14B8A6`,
Bebas Neue, Barlow Condensed and Barlow). Components use theme names such as `bg-surface`,
`text-muted` and `bg-primary`, never raw colours like `slate-500`. To add a theme, copy a
`[data-theme]` block and register it in `src/lib/themes.ts`. Each business will choose its
theme in Settings (phase 1 step 4); until then everyone gets `next-level`.

### Roles

A person can hold several roles in a business (stored as `"manager,trainer"`).

| Role           | Can                                                                     |
| -------------- | ----------------------------------------------------------------------- |
| admin          | everything: settings, billing, add/remove managers, remove trainers     |
| manager        | all athletes, assign athletes to trainers, invite trainers and athletes |
| trainer        | assigned athletes only; invite athletes                                 |
| athlete        | their own data                                                          |
| platform_owner | (you, on `user.role`) support tools across all businesses               |

### Tenant security, in three layers

1. Every tenant table has `tenant_id`.
2. Pages call `requireTenant(slug)` (signed in + member of that business) and do all
   tenant queries inside `withTenant(ctx, tx => ...)`. Actions check `can(roles, ...)`.
3. Postgres Row-Level Security (`drizzle/0001_row_level_security.sql`) filters every
   query made inside `withTenant`, by tenant and by role. If code forgets a check, the
   database still refuses. `tests/tenant-isolation.test.ts` proves it on every pull request.

**Adding a new tenant table:** add it to `schema/app.ts` with `tenantId()`, run
`pnpm db:generate`, then `pnpm drizzle-kit generate --custom --name <table>_rls` and in
that file: `ENABLE ROW LEVEL SECURITY`, add policies, `GRANT ... TO ptforge_app`. Add a
test to `tenant-isolation.test.ts`.

## 5. Deploying (Vercel + Neon)

Neon holds the live database; Vercel runs the live app. Your computer keeps using the
Docker database for development, so demo data and tests never touch real data.

### Neon (live database)

Your Neon project is already created (org `org-morning-lab-69146917`, project
`sparkling-river-24910784`, branch `production`). In PowerShell, in the project folder:

```powershell
npm i -g neon@latest        # the Neon command-line tool

neon login                  # opens your browser; finish signing in there

# Link this folder to the project. --no-env-pull stops Neon from writing the live
# connection string into .env.local (which would point your local app at production).
neon link --org-id org-morning-lab-69146917 --project-id sparkling-river-24910784 --branch production --no-env-pull

# Save the live connection strings to their own file (git-ignored)
pnpm neon:env               # = neon env pull --file .env.neon

pnpm neon:migrate           # create the tables and security policies on Neon
pnpm neon:check             # prove it: connections, tables, and tenant isolation
```

`pnpm neon:check` should end with `All Neon checks passed.` It creates a few throwaway
rows inside a transaction and rolls them back, so it leaves nothing behind. Never run
`pnpm db:seed` or `pnpm db:reset` against Neon (`db:reset` refuses anyway).

Whenever a future pull request adds a migration, run `pnpm neon:migrate` after merging it.

Optional: `neon init` and `neon deploy` aren't needed. PTForge only uses Neon's
Postgres (sign-in is Better Auth in our own database), and the default `neon init -y`
also installs a Neon access key into your coding tools' settings.

### Vercel (live app)

1. https://vercel.com → **Add New → Project** → import the `ptforge` GitHub repo.
2. **Environment Variables** (Production; see step 4 for Preview):
   - `DATABASE_URL`: the `DATABASE_URL` value from `.env.neon` (the pooled one, its host
     contains `-pooler`)
   - `BETTER_AUTH_SECRET`: a new one from `pnpm dlx auth@latest secret` (not your local one)
   - `BETTER_AUTH_URL`: `https://ptforge.app`
   - `RESEND_API_KEY` and `EMAIL_FROM`: see section 6
   - `TRUSTED_ORIGINS`: any other address people open the app at, comma separated. Once
     ptforge.app is connected, add `https://ptforge.vercel.app` here so the project's
     Vercel address keeps working. Each deployment's unique and branch preview addresses
     are trusted automatically.
   - Leave `DISABLE_PWNED_CHECK` and `SMTP_URL` unset.
3. Deploy. Then **Settings → Domains**: add `ptforge.app` (primary), then `ptforge.fit`
   and `ptforge.ca` as redirects to it, and follow the DNS instructions Vercel shows for
   your registrar.
4. Every pull request gets its own preview deployment. Give the **Preview** environment
   its own settings so previews never touch real data:
   - Create a Neon branch for previews (a copy of the database you can throw away):
     `neon branches create --name preview --parent production`, then
     `neon env pull --branch preview --file .env.neon-preview`, and run migrations on it
     with `pnpm neon:migrate --env-file .env.neon-preview` and check it with
     `pnpm neon:check --env-file .env.neon-preview`.
   - In Vercel, set for **Preview** only: `DATABASE_URL` (from `.env.neon-preview`), a
     separate `BETTER_AUTH_SECRET`, and `DISABLE_PWNED_CHECK` unset. Leave
     `BETTER_AUTH_URL` unset for Preview: each preview uses its own address.
   - Without Preview settings, previews still build but show an error when opened.

## 6. Email (Resend)

How email is sent depends on the environment (see `src/server/email/send.ts`):

| Where             | Setting                    | Emails go to                        |
| ----------------- | -------------------------- | ----------------------------------- |
| Your computer     | `SMTP_URL` in `.env.local` | Mailpit, http://localhost:8025      |
| Tests and CI      | nothing set                | printed in the terminal             |
| Vercel production | `RESEND_API_KEY`           | real inboxes, from mail.ptforge.app |

Production refuses to send without `RESEND_API_KEY`, so no email is ever silently lost.

**One-time Resend setup.** Do this before deploying, because new accounts must confirm
their email before they can sign in.

1. Sign up at https://resend.com and go to **Domains → Add domain**. Enter
   `mail.ptforge.app` and pick the region closest to you (for example North Virginia).
2. Resend shows a few DNS records (MX and TXT records for SPF, and a TXT record for
   DKIM). Add each one exactly as shown, at the registrar where you bought ptforge.app
   or in Vercel → Domains if Vercel manages its DNS.
3. Add a DMARC record too: type `TXT`, name `_dmarc` (on ptforge.app), value
   `v=DMARC1; p=none; rua=mailto:you@your-email`. `p=none` only reports; tighten it to
   `p=quarantine` after a few weeks of clean reports.
4. Click **Verify** in Resend. DNS can take a few minutes up to a few hours.
5. Resend → **API Keys → Create**: permission "Sending access", domain
   `mail.ptforge.app`. Copy the key (it's shown once).
6. Vercel → Project → Settings → Environment Variables: add `RESEND_API_KEY`
   (Production) and `EMAIL_FROM` = `PTForge <no-reply@mail.ptforge.app>`. Redeploy.
7. Test: sign up on ptforge.app with a real address and check the confirmation arrives
   and isn't in spam.

Preview deployments without the key print emails to the Vercel function logs.

## 7. Sign-in rules

- Passwords: at least 16 characters, checked against known data breaches.
- New accounts confirm their email; invited people are confirmed by the invitation itself.
- Two-step login (authenticator app) is optional but every coach sees a reminder until they
  turn it on at **Account** (`/account`). Backup codes are shown once at setup.
- Sessions: athletes stay signed in for 90 days, renewed whenever they use the app. Anyone with
  a staff role signs in again 7 days after their last sign-in
  (`src/server/auth/session-policy.ts`).
- Resetting a password signs that person out on every other device.

## 8. Left for phase 1

- App shell with full navigation, the kg/lb switch, and Settings with logo upload and theme
  picker (step 4).
- Client profiles, the website enquiry form, the exercise library and imports (steps 5 to 7).

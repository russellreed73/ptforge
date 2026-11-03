# PTForge

Client, program and progress management for personal trainers and strength coaches,
with a phone app (PWA) for their athletes. Multi-tenant: every coaching business gets
its own private space at `ptforge.app/<business>`.

**Status: phase 0 (foundation).** Sign-up, sign-in, businesses, the five roles, and
database-level tenant isolation are working and tested. Client management starts in phase 1.

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

Open http://localhost:3000 and sign in with a demo account. Every demo password is
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

1. **Neon** (https://neon.tech): create a project in a region near your users (for
   example AWS US East or Canada Central). Copy the connection string.
2. Run migrations against it once from your machine:
   `$env:DATABASE_URL="<neon connection string>"; pnpm db:migrate`
   (Don't seed production.)
3. **Vercel** (https://vercel.com): "Add New Project" → import the GitHub repo. Add
   environment variables `DATABASE_URL`, `BETTER_AUTH_SECRET` (a new one, not your local
   one) and `BETTER_AUTH_URL=https://ptforge.app`. Leave `DISABLE_PWNED_CHECK` unset.
4. Vercel → Project → Settings → Domains: add `ptforge.app` (primary), then
   `ptforge.fit` and `ptforge.ca` as redirects to it. Follow the DNS instructions
   Vercel shows for your registrar.
5. Every pull request gets its own preview URL automatically.

## 6. Left for phase 1

- Send invitation and password-reset emails through Resend (now printed in the terminal).
- Accept-invitation page (`/accept-invite/[id]`) and the invite form.
- Shorter (7-day) sessions for coach roles; athletes keep 90 days.
- Two-factor setup screen (the plugin is installed; the UI isn't built yet).
- Client profiles and the exercise library.

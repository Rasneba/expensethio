# Improvement Workflow

A repeatable process for finding, prioritizing, implementing, testing, and shipping improvements to the Expense Tracker app.

## 1. Find improvement opportunities

| Source | How |
| --- | --- |
| User feedback | Capture what the user says (bugs, crashes, "it should…"). Example issues we've shipped fixes for: delete failing, plans crashing on toggle, balance formula. |
| Production monitoring | Test the live API (`https://expensethio.vercel.app/api/...`) for 4xx/5xx. Watch Vercel function errors in the dashboard. |
| Code review | Look for duplicated logic, missing error handling, hard-coded values, unguarded `.map`/`.filter` on API responses (a non-array response crashes the app — add guards). |
| Build warnings | `npm run build` prints warnings (e.g. chunk > 500 kB) — a trigger for performance work. |
| UX/accessibility | Run a Lighthouse pass (performance, accessibility, PWA). Verify dark mode, contrast, touch targets on mobile. |
| Data correctness | Re-check formulas (e.g. balance = income − expense − credit) against the real meaning. |

## 2. Capture and triage

- Keep a running list (GitHub Issues or this file's "Backlog" section).
- For each item record: **problem**, **who hit it**, **steps to reproduce**, **expected vs actual**, **affected area**.
- Mark severity:
  - **Critical** — app crashes / data wrong / core action broken (fix now).
  - **High** — feature unusable for some users.
  - **Medium** — polish, UX, performance.
  - **Low** — nice-to-have.

## 3. Prioritize

Score each candidate 1–5 on **Impact** and **Effort** (5 = high impact, low effort wins).

```
Priority = Impact − Effort
```

Rules:
- Critical bugs go to the front of the line regardless of score.
- Batch small low-risk fixes into one release.
- One feature/refactor per release after that, so it's easy to roll back.

## 4. Implement (local)

1. Create a branch: `git checkout -b feat/<name>` (or use the release branch pattern like `arena/<sha>-expensethio`).
2. Frontend: `client/` (React + Vite + framer-motion + PWA).
3. Backend: `server/src/index.ts` (Express served as Vercel serverless functions via `api/*.ts`).
4. DB changes: **never skip the migration** — add/reuse a script in `server/scripts/` and run it against the Neon DB:
   ```powershell
   node scripts/migrate-<name>.js   # run from server/ (reads server/.env)
   ```
   The migration must be idempotent (safe to re-run) because prod already has live data.
5. If the API contract changes (endpoints/fields), update `client/src/services/api.ts` types in the same change.

## 5. Test before deploying

Run these in order — every one of them has caught a real bug before:

```powershell
# 1. Typecheck + build the client (client/)
npx tsc --noEmit
npx vite build

# 2. Typecheck + build the server (server/)
npx tsc --noEmit

# 3. API smoke test
#    - restart local API server (uses the same production Neon DB via server/.env)
#    - hit every endpoint touched: create, read, update, delete, dashboard
#    - confirm balance = income - expense - credit

# 4. Headless UI test (Chrome + CDP)
#    - serve client/dist + proxy /api to localhost:3001
#    - mount app, switch every bottom-nav view
#    - create + delete a transaction, toggle a todo
#    - assert ZERO console errors (console errors == potential crash)
```

## 6. Deploy and verify (Vercel)

1. Commit and push to `master` — Vercel auto-deploys to production.
2. Wait for `vercel ls expensethio` to show a new **Production Ready** deployment.
3. Verify on the live site:
   ```powershell
   node prod-verify.cjs   # creates+deletes an expense, toggles+deletes a todo, checks dashboard
   ```
4. Test the actual screens in a browser on the production URL.

## 7. Watch for known landmines

- **Catch-all rewrite** — `vercel.json` rewrite must stay `"/((?!api/).*)"`. A bare `/(.*)` shadows `/api/<item>` routes and breaks DELETE/PUT/GET-by-id (returned 405 / app-shell HTML).
- **Non-array API responses** — if an endpoint returns HTML (auth page, error page) instead of JSON, `setState(string)` then `.map()` crashes the app. Guard against it.
- **Schema drift** — deployed code and prod DB must match. After any DB change, run the migration on prod before relying on the new code.
- **Vercel auth/protection** — deployment-specific URLs (`*-<random>-<project>.vercel.app`) are protected; test against the production alias (`expensethio.vercel.app`).

## Backlog

The canonical, sectioned backlog lives in [`BACKLOG.md`](./BACKLOG.md). It is organized by priority:

- 🔴 **Critical** — financial calculation correctness, data-loss protection, API error handling, input validation
- 🟠 **High** — credit management, plans/budgets, recurring transactions, categories, dashboard, due-date reminders
- 🟡 **Medium** — reports, search/filters, export, notifications, performance, mobile UX
- 🟢 **Low** — multiple accounts, multi-currency, authentication, data visualization, offline-first

### Financial model (source of truth)

```
Available = Income + Borrowed − Expenses − Credit Payments
Credit Owed = Borrowed − Credit Payments  (liability)
```

Borrowing is **not** an expense: it adds cash while creating a liability. Credit payments are money out.

### Maintenance reminders

- **DB schema drift** — when a feature adds columns (e.g. `due_date`, `creditor`), always ship an idempotent migration in `server/scripts/` AND run it against prod before deploying. See `migrate-credit-fields.js`.
- **Bundle size** — client bundle is > 500 kB; code-split `recharts`/`framer-motion` or lazy-load views.
- **Crash safety** — guard components against non-array API responses (an HTML/error response must never reach `.map()`).

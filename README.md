# UtiliSim UI

React + TypeScript frontend for **UtiliSim**, a debt-payoff simulator. This is the **phase-1**
client: every screen is wired to a real endpoint and verified against a running API, but the
product surface is intentionally small.

The frontend consumes the API defined in [`API_CONTRACT.md`](API_CONTRACT.md). That document covers
only what this client sends, receives, and how it handles errors; backend internals live in
[`../utilisim-api/API_CONTRACT.md`](../utilisim-api/API_CONTRACT.md). When the API changes, update
the TypeScript models, the service wrapper, and the UI contract together.

> **Documentation governance:** use synthetic placeholders only: `<PASSWORD>`, `<JWT>`,
> `<USER_ID>`, `<TOME_ID>`, `<SCENARIO_ID>`, and `<SIMULATION_ID>`. Never commit real credentials,
> tokens, email addresses, database names, connection strings, or machine-specific paths.

---

## 1. Architecture

A single-page React application with client-side routing and no server rendering.

```
src/index.tsx
  └─ StrictMode
      └─ BrowserRouter
          └─ AuthProvider            session restore, login/register/logout
              └─ App                 route table
                  ├─ Login / Register
                  └─ RequireAuth
                      └─ AppLayout    sidebar, topbar, mobile menu
                          └─ pages    data loading + forms
                              └─ services/*  ──► lib/api.ts ──► fetch('/api/...')
```

Principles:

- **Pages own their data.** There is no global store and no cache. Each page loads what it needs
  and reloads after a mutation.
- **Services are thin.** Each module in `src/services/` names the endpoint and types the response;
  it contains no UI state.
- **One transport.** `src/lib/api.ts` attaches the token, normalises errors, handles `204`, and
  signs the user out on `401`.
- **One stylesheet.** `src/styles.css` holds design tokens and utility classes; there is no CSS
  framework.
- **Build-time API origin.** `PUBLIC_API_BASE` is baked in at build time. In development, `/api` is
  proxied to the API, so the browser stays same-origin.

| Concern | Choice |
|---|---|
| UI | React 19 |
| Language | TypeScript 6 (`strict`, `noUnusedLocals`, `verbatimModuleSyntax`) |
| Routing | React Router 7 (`BrowserRouter`, nested routes) |
| Build | Rsbuild 2 (`@rsbuild/plugin-react`) |
| Linting | ESLint 10 + `typescript-eslint` + React Hooks/Refresh plugins |
| Formatting | Prettier |
| Icons | `react-icons` is installed; the shell currently uses text glyphs |
| Tests | None yet; see [Testing approach](#10-testing-approach) |

---

## 2. Setup

### Prerequisites

| Tool | Requirement |
|---|---|
| Node.js | Current LTS or newer |
| npm | Ships with Node |
| UtiliSim API | Running on `http://localhost:8080` |

### Install

From `utilisim-ui/`:

```bash
npm install
```

### API availability

Development expects the API on `http://localhost:8080`. Start it first:

```bash
cd ../utilisim-api
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

`rsbuild.config.ts` proxies `/api` to `http://localhost:8080` with `changeOrigin: true`, so the
browser only talks to `localhost:3000`.

### Environment

No `.env` file is required. `PUBLIC_API_BASE` is optional and read at build time from
`import.meta.env.PUBLIC_API_BASE`; when empty, requests stay relative (`/api/...`).

---

## 3. Build

```bash
npm run build      # production bundle in dist/
npm run preview    # serve dist/ locally
```

To target another API origin at build time:

```bash
# macOS / Linux
PUBLIC_API_BASE=https://api.example.com npm run build

# PowerShell
$env:PUBLIC_API_BASE = "https://api.example.com"; npm run build
```

The value is embedded in the bundle. There is no runtime configuration file, so one build cannot
be repointed at a different API without rebuilding.

### Quality gates

```bash
npm run typecheck   # tsc --noEmit, strict, src only
npm run lint        # ESLint on src
npm run build       # Rsbuild production build
```

Run all three before handing off a change. Notes:

- `noUnusedLocals` / `noUnusedParameters` are on — remove dead imports and parameters.
- `verbatimModuleSyntax` is on — use `import type { … }` for type-only imports.
- React 19 `StrictMode` double-invokes effects in development, so `useApiResource` may issue two
  GETs on mount. Production runs once.

---

## 4. Run

```bash
npm run dev        # http://localhost:3000, opens a browser
```

The dev server supports HMR and the `/api` proxy. If port 3000 is taken, stop the other process or
change `server.port` in `rsbuild.config.ts`.

### First-run checklist

1. API is running and the database is reachable.
2. `npm run dev` opens `http://localhost:3000`.
3. You are redirected to `/login` because there is no session.
4. Register a synthetic account (or sign in), then add an account on `/app/accounts`.
5. Run a simulation on `/app/simulate` and compare strategies on `/app/compare`.

---

## 5. Folder structure

```
src/
  index.tsx                 Entry: StrictMode > BrowserRouter > AuthProvider > App
  App.tsx                   Route table
  styles.css                Single global stylesheet (tokens, layout, components)
  types/api.ts              DTOs mirroring API_CONTRACT.md
  auth/
    auth-context.ts         Context + useAuth() guard
    AuthProvider.tsx        Session restore, login/register/logout
  lib/
    api.ts                  fetch wrapper, token/session storage, ApiError
    use-api-resource.ts     Generic load/reload hook for GET data
    accounts.ts             Balance/APR/utilization helpers, Tome -> DebtSnapshot
    format.ts               Money/percent/date/strategy labels, safe number parsing
    last-run.ts             sessionStorage for the latest simulation
  services/
    auth.ts                 POST /api/auth/login, /register
    tomes.ts                GET/POST/DELETE /api/tomes
    archive.ts              Scenario CRUD under /api/archive/scenarios
    oracle.ts               order, recommend, analyze, total-interest, determinism
    simulation.ts           POST /api/assemble/run
  layout/
    AppLayout.tsx           Sidebar, topbar, mobile menu, scroll reset, logout
    RequireAuth.tsx         Redirects anonymous users; boot spinner
  components/
    ui.tsx                  Alert, Field, PageHeader, Section, StatCard, Badge, Spinner, EmptyState
    SimulationResultView.tsx  Summary stats + amortization table
  pages/
    LoginPage.tsx           Email/password sign-in
    RegisterPage.tsx        Create account, then auto-login
    DashboardPage.tsx       Totals, last run, recent scenarios, accounts
    AccountsPage.tsx        List/create/delete tomes, utilization bars
    ScenariosPage.tsx       List/create/delete scenarios, prefill simulator
    SimulatePage.tsx        Single-balance payoff run + save-as-scenario
    ComparePage.tsx         Recommend/order/analyze over selected accounts
```

### Layer responsibilities

| Layer | Owns | Must not |
|---|---|---|
| `pages/` | Form state, validation, loading/error UI, navigation | Call `fetch` directly |
| `services/` | Endpoint paths, request/response types | Hold React state |
| `lib/api.ts` | Headers, token, JSON, error normalisation, `401` handling | Know about specific screens |
| `lib/*` | Pure helpers (accounts, formatting, last run) | Perform I/O beyond documented storage |
| `components/ui.tsx` | Reusable presentational primitives | Fetch data or own route state |

---

## 6. Routing

| Path | Screen | Guard |
|---|---|---|
| `/login` | Login | public |
| `/register` | Register | public |
| `/app/dashboard` | Dashboard | `RequireAuth` |
| `/app/accounts` | Accounts | `RequireAuth` |
| `/app/scenarios` | Scenarios | `RequireAuth` |
| `/app/simulate` | Simulate | `RequireAuth` |
| `/app/compare` | Compare | `RequireAuth` |
| `/`, `*` | Redirect to `/app` | — |

`/app` redirects to `/app/dashboard`.

`RequireAuth` reads `useAuth().status`:

- `loading` → full-screen boot spinner while a restored session is validated.
- `anonymous` → `<Navigate to="/login" state={{ from: location.pathname }} />`.
- `authenticated` → render the layout.

`LoginPage` reads `location.state.from` and returns the user to the originally requested `/app`
path when it is safe to do so; otherwise it navigates to `/app/dashboard`.

Cross-page navigation carries a scenario preset through router state:

```
ScenariosPage "Simulate" → navigate('/app/simulate', { state: { scenario } })
SimulatePage            → reads location.state.scenario as the initial form preset
```

Router state is not persisted; a refresh on `/app/simulate` loses the preset.

---

## 7. Authentication lifecycle

### Sign-in

1. `LoginPage` calls `useAuth().login(email, password)`.
2. `AuthProvider` calls `authApi.login`, which posts to `/api/auth/login` with `auth: false`.
3. The response `{ id, username, email, token }` is written to `localStorage` and the user is set
   in context.
4. `RequireAuth` stops redirecting, and the page navigates to the requested route.

### Registration

1. `RegisterPage` validates username, email shape, minimum password length (8), and confirmation.
2. `AuthProvider` posts to `/api/auth/register`, which returns no token.
3. It immediately calls `login()` with the same credentials and adopts the resulting session.

### Restore on reload

`readSession()` runs once at module load. If a stored user exists, `AuthProvider` starts in
`status: 'loading'` and validates the token with `GET /api/archive/scenarios`:

- Success → `authenticated`.
- `401` → clear storage and become `anonymous`.
- Network or other failure → stay signed in so pages can show the real error instead of hiding a
  backend outage behind a logout.

### Global 401

`lib/api.ts` clears the session and invokes the handler registered by `AuthProvider`, which flips
to `anonymous`. `RequireAuth` then redirects to `/login`. The handler is only invoked for
authenticated calls, so a failed login does not clear anything.

Only `401` triggers this path. An invalid, expired, or wrongly signed token returns `500` from the
API, so the handler never runs and the session persists. Log out manually to recover.

### Logout

Client-side only: remove `utilisim.token` and `utilisim.user`, set the user to `null`, and navigate
to `/login`. There is no logout endpoint, no refresh token, and no expiry timer.

### Token caveats

- The token lives in `localStorage` and is readable by any script on the page.
- Lifetime is about 10 days.
- The API generates a signing key at startup, so restarting the backend invalidates all sessions.
  The API currently answers the next request with **`500`** (an uncaught signature exception),
  not `401`; `lib/api.ts` only clears on `401`, so the UI stays signed in and every page fails
  until the user logs out manually.
- If `localStorage` is unavailable, the in-memory session still works for the current tab.

---

## 8. State management

There is **no state library** (no Redux, Zustand, or React Query). State is local and explicit.

| Kind | Where it lives | Pattern |
|---|---|---|
| Session | `AuthProvider` + `localStorage` | Context value: `user`, `status`, `login`, `register`, `logout` |
| Server reads | Page-local `useApiResource(loader)` | `{ data, error, loading, reload }` |
| Mutations | Page-local `useState` | `busy`/`error`, call service, then `reload()` |
| Form input | Page-local `useState` | One object per form plus a validation function |
| Latest simulation | `sessionStorage` (`utilisim.lastRun`) | Written after a successful run; read by Dashboard |
| Cross-page preset | React Router `location.state` | Scenarios → Simulate |

### `useApiResource`

```ts
const loadTomes = useCallback(() => tomesApi.list(), []);
const tomes = useApiResource(loadTomes);
```

- The loader must be stable (`useCallback`), or the effect re-runs on every render.
- Loading is derived from a version counter rather than set inside the effect, so `reload()` flips
  back to loading without an extra render cascade.
- Failures are converted with `errorMessage(error)` and stored as a string.
- There is no cache, deduplication, or background refetch. Two pages loading accounts issue two
  requests.

### Why not a cache library

Phase 1 has five pages and short-lived data. A cache layer would add invalidation rules without a
current need. Revisit when runs are persisted and the same data appears on multiple screens at
once.

---

## 9. API integration strategy

### Transport

`src/lib/api.ts` exposes `api<T>(path, options)`:

- Defaults to `GET` and `auth: true`.
- Adds `Accept: application/json` and, when a body exists, `Content-Type: application/json`.
- Serialises the body with `JSON.stringify`.
- Returns `undefined` for `204`.
- Parses JSON when possible, otherwise keeps text.
- Throws `ApiError(status, message)` for non-2xx responses.
- On a `401` from an authenticated call, clears the session and notifies `AuthProvider`.
- Converts a network failure into `ApiError(0, 'Cannot reach the UtiliSim API...')`.

### Path building

Services call `api('/api/...')`. Ids are encoded with `encodeURIComponent`. The base URL is
prepended by `api()`; never hard-code `localhost` in a service.

### Error presentation

Pages call `errorMessage(error)` and render the result in an `Alert`. Backend messages are shown
verbatim; do not replace them with invented copy. Empty `404` bodies and `500` tome-delete
responses fall back to a readable status message (see the UI contract).

### Data shaping

- `lib/accounts.ts` converts a stored `Tome` into the `DebtSnapshot` the Oracle expects.
- `effectiveApr()` prefers `apr` and falls back to `estimatedApr`. The fallback is defensive: the
  API cannot currently store a null APR, so a blank APR never reaches this code.
- `weightedApr()` produces a balance-weighted percentage for the simulator prefill.
- `lib/format.ts` centralises money, percent, date, and strategy labels.

### Unit boundaries

| Field | Unit |
|---|---|
| `Tome.apr`, `Tome.estimatedApr` | Percent (`19.99`) |
| Simulator "APR %" input | Percent, converted to decimal on submit |
| `SimulationInput.interestRate` | Annual decimal (`0.1999`) |
| `DebtSnapshot.interestRate` | Percent, as sent by this UI |

### Adding a new API area

1. Add the DTOs to `src/types/api.ts` (match the JSON exactly).
2. Add or extend a service module in `src/services/` using `api<T>()`.
3. Load reads with `useApiResource`, or call writes from a form handler.
4. Surface failures with `errorMessage(error)`; keep backend text intact.
5. Update this README and [`API_CONTRACT.md`](API_CONTRACT.md) in the same change.
6. Run typecheck, lint, and build.

---

## 10. Testing approach

There is **no automated test runner** yet. The current regression check is a manual browser smoke
test against a running API.

### Current gates

```bash
npm run typecheck
npm run lint
npm run build
```

These catch type drift, unused code, hook-rule violations, and bundling failures. They do not catch
behavioural regressions.

### Manual smoke checklist

1. **Auth:** register a new synthetic account; confirm auto-login. Log out. Try a wrong password —
   the backend message appears. Log in again.
2. **Session:** reload the app; the session restores without a flash of the login page. Restart
   the API; the next request currently fails with `500` and the UI stays signed in until you log
   out manually (gap #18).
3. **Accounts:** create an account with a numeric APR. Then try a blank APR and confirm the
   current `500` failure is shown and no account is created (known defect; see gap #17). Delete
   the account. Try deleting it twice to see the tome-delete `500` path.
4. **Scenarios:** create a scenario; reload; confirm it persists. Click "Simulate" and verify the
   strategy and extra payments are prefilled. Delete it.
5. **Simulate:** run a valid simulation and inspect summary stats plus the amortization table. Try
   a payment that does not cover monthly interest and confirm the client blocks it.
6. **Compare:** select and deselect accounts; run Recommend, Order debts, and Analyze. Confirm the
   caveat about identical projected interest is visible.
7. **Responsive:** check the mobile menu, focus order, and that tables remain usable at narrow
   widths.

### Recommended test stack

| Layer | Tool | First targets |
|---|---|---|
| Unit | Vitest | `lib/accounts.ts`, `lib/format.ts`, `lib/last-run.ts` |
| Component | Vitest + React Testing Library | `LoginPage`, `AccountsPage` form validation, `SimulatePage` guard |
| Transport | Vitest with a mocked `fetch` | `lib/api.ts` error/`204`/`401` behaviour |
| End-to-end | Playwright | Register → add account → simulate → save scenario |

Run tests in CI alongside typecheck, lint, and build. Prefer testing behaviour through accessible
roles and labels; the components already use semantic HTML and `role="alert"`.

---

## 11. Expansion guidance

### Adding a screen

1. Create the page in `src/pages/`.
2. Add the route under `/app` in `src/App.tsx`.
3. Add a nav entry in `src/layout/AppLayout.tsx`.
4. Reuse `PageHeader`, `Section`, `Field`, `Alert`, `StatCard`, and `EmptyState`.
5. Load data with `useApiResource` and surface errors with `errorMessage`.
6. Update the folder map and routing table in this README.

### Adding a multi-debt simulation

The current simulator models one balance. A real multi-debt flow needs an API that accepts a list
of debts and returns a combined schedule. Until then, the "Fill from my accounts" button is an
approximation; keep that wording honest.

### Persisting runs

When the API gains run persistence and a lookup endpoint:

1. Add the DTOs and service calls.
2. Replace `lib/last-run.ts` session storage with server data.
3. Add a runs list/detail route.
4. Remove the "kept in this browser only" copy from the Dashboard.

### Hardening the session

Move away from `localStorage` when the API supports it: an httpOnly, `SameSite` cookie or a
short-lived access token with refresh. Keep `lib/api.ts` as the single place that knows how the
credential is attached.

### Growing the app

- Add a top-level error boundary before adding more routes.
- Introduce route-level `React.lazy` + `Suspense` when the bundle grows.
- Add `AbortController` and a timeout to `lib/api.ts` when requests can be slow.
- Replace `window.confirm` with an accessible dialog component.
- Add server-side pagination before lists grow past a screenful.

Every expansion must keep the UI contract current. If a response shape changes, update
`src/types/api.ts` and `API_CONTRACT.md` in the same change.

---

## 12. Known gaps

| # | Gap | Impact | Suggested phase-2 work |
|---|---|---|---|
| 1 | No test runner | Refactors rely on manual smoke tests | Add Vitest + React Testing Library; add Playwright |
| 2 | No account editing | Users delete and re-create to change an APR | Add `PUT /api/tomes/{id}` in the API, then an edit form |
| 3 | Scenarios are global | Every user sees every scenario | Scope scenarios in the API; remove the caveat banner |
| 4 | Runs are not persisted | No history; only one run per tab | Persist runs; add a runs list/detail page |
| 5 | Projections are not strategy-sensitive | `analyze` shows identical interest per strategy | Fix the API projection; then present real savings |
| 6 | Token in `localStorage` | Readable by any XSS | Move to an httpOnly, `SameSite` cookie or short-lived access token |
| 7 | Token expiry ~10 days, no refresh | Expiry is not a clean sign-out: the API returns `500`, so the session sticks until manual logout | Add refresh/rotation after the API returns `401` for expired tokens |
| 8 | No runtime config | `PUBLIC_API_BASE` is baked in at build time | Load `/config.json` at boot or inject config at container start |
| 9 | No pagination | Lists grow unbounded | Page/filter accounts and scenarios once the API supports it |
| 10 | No request timeout or cancellation | A hung backend leaves a spinner | Add `AbortController` + timeout to `lib/api.ts` |
| 11 | No error boundary | A render error blanks the app | Add a top-level boundary with a reload action |
| 12 | No route-level code splitting | The app chunk loads every page upfront | Route-level `React.lazy` + `Suspense` |
| 13 | `window.confirm` for deletes | Inconsistent UX, hard to test | Replace with an accessible confirmation dialog |
| 14 | No role-aware UI | Everyone sees everything | Add roles to the API, then gate nav/actions |
| 15 | Simulate is single-balance | Does not model multiple accounts at once | Add a multi-debt flow once the API supports it |
| 16 | Limited accessibility testing | Keyboard/screen-reader regressions possible | Add axe checks and a keyboard pass in CI |
| 17 | Blank APR → API `500` | The Accounts form offers an APR field that cannot be left blank | Send a numeric default or wait for the API fix; remove the "estimated" promise |
| 18 | Invalid/expired token → API `500` | No `401`, so the session is not cleared and pages fail repeatedly | Fix the API to return `401`; optionally clear on auth-related `500`s as a stopgap |
| 19 | Simulation cap at `termMonths * 2` | A "completed" run can still owe a balance | Show the final `remainingBalance` and avoid "paid off" wording when it is non-zero |
| 20 | Recommend always returns `AVALANCHE` for any non-trivial APR | The recommendation looks decisive but is a unit bug | Fix the API threshold; until then, label it as a rough heuristic |

Suggested order: add a test runner and cover auth/accounts/simulate; add account editing once the
API exposes `PUT`; persist runs and make projections meaningful; harden the session and runtime
config; then add pagination, timeouts, an error boundary, and code splitting.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Cannot reach the UtiliSim API" | Backend not running on `:8080` | Start `utilisim-api`; retry the page |
| Pages fail after a backend restart but you stay signed in | Random JWT key invalidates tokens; the API returns `500`, so the UI does not clear the session | Log out and back in (gap #18) |
| Accounts form fails with `Internal Server Error` | APR was left blank; the API rejects `null` | Enter a numeric APR (gap #17) |
| A run says `COMPLETED` but the last balance is non-zero | `termMonths * 2` cap reached | Increase the term/payment; gap #19 |
| `/api/...` returns `404` in the browser | Dev server not using the proxy, or a wrong `PUBLIC_API_BASE` | Use `npm run dev`; check `rsbuild.config.ts` / the env var |
| CORS error | Calling `:8080` directly from another origin | Use the proxy, or extend the API's `CORSConfig` |
| Port 3000 already in use | Another dev server is running | Stop it or change `server.port` in `rsbuild.config.ts` |
| Typecheck fails on an unused import | `noUnusedLocals` / `noUnusedParameters` | Remove the import or parameter |
| Blank screen after login | Backend returned an unexpected shape | Check the browser console and `API_CONTRACT.md` |
| Session does not persist | `localStorage` disabled or private mode | The in-memory session still works for the current tab |
| Scenario list shows other users' rows | Scenarios are global in the API | Expected; see gap #3 |
| Simulation spinner never ends | No request timeout; backend may be stuck | Restart the API; add a timeout (gap #10) |

---

## 14. Related documents

- [`API_CONTRACT.md`](API_CONTRACT.md) — the endpoints, payloads, TypeScript models, error
  behaviour, and UI quirks this client relies on.
- [`../utilisim-api/API_CONTRACT.md`](../utilisim-api/API_CONTRACT.md) — backend source of truth.
- [`../utilisim-api/README.md`](../utilisim-api/README.md) — backend setup, architecture, and
  roadmap.
- [`AGENTS.md`](AGENTS.md) — local agent notes and Rsbuild references.

# UtiliSim UI API Contract

**Status:** Matches the UI code as of 2026-10-28 and the verified phase-1 API.
**Audience:** frontend developers and UI maintainers.
**Scope:** only the endpoints, payloads, and error behaviour the UI actually consumes.

> **Documentation governance:** every example here is synthetic. Never commit real credentials,
> tokens, email addresses, database names, connection strings, or machine-specific paths. Use
> `<PASSWORD>`, `<JWT>`, `<USER_ID>`, `<TOME_ID>`, `<SCENARIO_ID>`, and `<SIMULATION_ID>`.

The backend contract lives in [`../utilisim-api/API_CONTRACT.md`](../utilisim-api/API_CONTRACT.md).
It is the source of truth for controller behaviour, persistence, and validation. This document
deliberately does **not** repeat backend internals.

---

## 1. Transport

| Item | Value |
|---|---|
| Dev API origin | `http://localhost:8080` |
| Dev UI origin | `http://localhost:3000` |
| Request prefix | `/api/...` (proxied by Rsbuild in development) |
| Production base | `PUBLIC_API_BASE` at build time; empty means same-origin |
| Auth header | `Authorization: Bearer <JWT>` |
| Request body | JSON, sent only when a body is provided |
| Response body | JSON; `204` has no body |
| Dates | ISO-8601 with offset strings; the UI only formats them |

`src/lib/api.ts` builds every URL as `${API_BASE}${path}`. `API_BASE` comes from
`import.meta.env.PUBLIC_API_BASE`, with trailing slashes stripped. It is read once at build time;
there is no runtime config file.

The UI never calls the API cross-origin in development: `rsbuild.config.ts` proxies `/api` to
`http://localhost:8080`, so CORS is not exercised unless `PUBLIC_API_BASE` points elsewhere.

---

## 2. Authentication flow

### Login

```
LoginPage → useAuth().login(email, password)
          → authApi.login()
          → POST /api/auth/login
          → writeSession({ id, username, email }, token)
          → navigate to the originally requested /app route, else /app/dashboard
```

Login is sent with `auth: false`, so a failed login does **not** clear an existing session.

**Request**

```json
{ "email": "user@example.com", "password": "<PASSWORD>" }
```

**Response `200`**

```json
{
  "id": "<USER_ID>",
  "username": "user@example.com",
  "email": "user@example.com",
  "token": "<JWT>"
}
```

`username` is the email on the wire. The UI stores it but never presents it as a display name.

### Registration

```
RegisterPage → useAuth().register(username, email, password)
             → POST /api/auth/register  (no token returned)
             → POST /api/auth/login with the same email/password
             → navigate to /app/dashboard
```

**Request**

```json
{ "username": "example-user", "password": "<PASSWORD>", "email": "user@example.com" }
```

**Response `200`** — `{ "id", "username", "email" }`; no token. The UI signs in immediately after.

### Session storage

| Key | Storage | Contents |
|---|---|---|
| `utilisim.token` | `localStorage` | Raw JWT |
| `utilisim.user` | `localStorage` | `{ id, username, email }` |
| `utilisim.lastRun` | `sessionStorage` | Latest `SimulationResult` (browser-only) |

`readSession()` runs once at module load. When a session exists, `AuthProvider` validates it with
`GET /api/archive/scenarios`:

- `401` → clear storage and become anonymous.
- Network or other failure → stay signed in so pages can surface the real error.

Any authenticated request that returns `401` clears the session and notifies `AuthProvider`,
which flips the status to anonymous; `RequireAuth` then redirects to `/login`.

**A stale token now produces `401`.** Malformed, expired, and wrongly signed tokens are treated as
anonymous by the API, so the next request clears storage and returns the user to `/login`. This is
what makes restart-induced expiry recoverable.

### Logout and expiry

Logout is client-side only: remove both keys, set the user to `null`. There is no logout endpoint,
no refresh token, and no expiry timer. Tokens last about 10 days. The backend signs with
`JWT_SECRET` when configured, so tokens survive a restart; without it the key is ephemeral and the
next restart invalidates every session, which now results in a clean `401` sign-out rather than a
`500` lockout. See §3.

---

## 3. Error handling

`src/lib/api.ts` wraps `fetch` and throws `ApiError` for non-2xx responses:

```ts
export class ApiError extends Error {
  readonly status: number;
}
```

Rules:

1. `204` resolves to `undefined` without parsing a body.
2. The body is parsed as JSON when possible, otherwise kept as text.
3. `message` from `{ error, message }` wins; then `error`; then a raw string body; then the HTTP
   status text.
4. A network failure becomes `ApiError(0, 'Cannot reach the UtiliSim API...')`.
5. `status === 401` on an authenticated call clears the session before throwing.

Pages render `errorMessage(error)` verbatim in an `Alert`. The UI does not rewrite backend text.

### Statuses the UI must handle

| Status | Body | UI behaviour |
|---|---|---|
| `400` | `{ "error": "Bad Request", "message": "..." }` | Show the message (duplicate email, invalid strategy, malformed payload) |
| `401` | `{ "error": "Unauthorized", "message": "..." }` | Login page shows it; authenticated calls sign out |
| `403` | `{ "error": "Forbidden", "message": "..." }` | Show the message; no role-aware UI exists |
| `404` | often **empty** for scenario ids | Show a generic failure; never assume JSON |
| `500` | `{ "error": "Internal Server Error", "message": "Unexpected error" }` | Show the message; never a stack trace |

**Tome delete is special.** `DELETE /api/tomes/{id}` returns `500` for a missing or foreign id,
not `404`/`403`. `AccountsPage` surfaces the message and leaves the row in place.

**A blank APR is now accepted.** `POST /api/tomes` with `apr: null` stores the documented 16.0000
percent estimate. `AccountsPage` labels the field optional; the account is created and
`estimatedApr` is returned.

**Invalid tokens are a `401`.** A malformed, expired, or wrongly signed bearer token is treated as
anonymous by the API. `lib/api.ts` clears the session, notifies `AuthProvider`, and `RequireAuth`
redirects to `/login`. No `trace` or internal text reaches the client.

**5xx bodies are generic.** The API returns
`{"error":"Internal Server Error","message":"Unexpected error"}` and never a stack trace.

**Scenario misses are empty.** `GET`/`PUT`/`DELETE /api/archive/scenarios/{id}` return `404` with
no body, so `extractMessage` falls back to the status line.

Error example:

```json
{ "error": "Bad Request", "message": "Email already in use" }
```

---

## 4. Models used by the UI

These mirror `src/types/api.ts`. Field names are exactly what the API serialises.

### Auth

```ts
interface LoginRequest { email: string; password: string }

interface LoginResponse {
  id: string;
  username: string; // email on the wire
  email: string;
  token: string;
}

interface RegisterRequest { username: string; password: string; email: string }

interface RegisterResponse { id: string; username: string; email: string }
```

### Accounts ("tomes")

```ts
interface Tome {
  id: string;
  userId: string | null;
  name: string;
  currentBalance: number;
  apr: number | null;        // percentage, e.g. 19.99; null when unknown
  estimatedApr: number;      // percentage; 16.00 when apr is absent
  minimumDebtPayment: number;
  currentPayment: number;    // what the user pays today; defaults to the minimum
  creditLimit: number;
  type: string;              // free-form; UI offers CREDIT_CARD, STUDENT_LOAN, ...
  createdAt: string;
  updatedAt: string;
}

interface TomeRequest {
  name: string;
  currentBalance: number;
  apr: number | null;        // null stores the 16% estimate
  minimumDebtPayment: number;
  currentPayment?: number | null; // optional; the server stores the minimum
  creditLimit: number;
  type: string;
}
```

### Scenarios

```ts
interface Scenario {
  id: string;
  userId: string | null;     // owner id; set by the server from the token
  name: string;
  strategy: string;
  extraPayment: number;
  lumpSumPayment: number;
  createdAt: string;
  updatedAt: string;
}

interface ScenarioInput {
  name: string;
  strategy: string;
  extraPayment: number;
  lumpSumPayment: number;
}
```

### Simulation

```ts
type StrategyType = 'SNOWBALL' | 'AVALANCHE' | 'HYBRID' | 'CUSTOM' | 'MINIMUM_ONLY';

interface SimulationInput {
  principal: number;
  interestRate: number;      // annual decimal: 0.1999 = 19.99%
  termMonths: number;        // planning horizon; a plan that needs longer comes back FAILED
  minimumPayment: number;
  extraPayment: number;
  lumpSumPayment: number;
  strategy: StrategyType;
}

interface AmortizationEntry {
  monthIndex: number;
  date: string;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

interface SimulationResult {
  id: string;
  simulationInputId: string | null;
  userId: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';  // COMPLETED only when the balance hits zero
  startedAt: string;
  completedAt: string | null;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  monthsToPayoff: number;    // 0 when FAILED
  payoffDate: string | null; // null when FAILED
  savingsComparedToBaseline: number;
  remainingBalance: number;  // > 0 when FAILED
  schedule: AmortizationEntry[];
  archivedAt: string | null;
  ledgerEntryId: string | null;
}
```

### Strategy

```ts
interface DebtSnapshot {
  tomeId: string;
  accountName: string;
  currentBalance: number;
  apr: number;               // annual percentage: 19.99
  estimatedApr: number;      // annual percentage, used when apr is 0
  minimumPayment: number;
  interestRate: number;      // annual percentage, display only; the server ignores it
}

interface StrategyInput {
  strategyType: StrategyType;
  customDebtOrder?: string[];
  extraPayment: number;
  lumpSumPayment: number;
}

interface StrategyOutput {
  strategyName: string;
  orderedDebts: DebtSnapshot[];
  description: string;
}

interface StrategyComparison {
  strategyName: string;
  projectedInterest: number;
  debtCount: number;
  description: string;
}

interface StrategyAnalysis {
  comparisons: StrategyComparison[];
  recommendedStrategy: string | null;
  analysisNotes: string | null;
}
```

---

## 5. Endpoints consumed

### `POST /api/auth/login`

Public. Returns `LoginResponse`. Wrong credentials → `401`
`{"error":"Unauthorized","message":"Invalid email or password"}`.

### `POST /api/auth/register`

Public. Returns `RegisterResponse`. Duplicate email → `400`
`{"error":"Bad Request","message":"Email already in use"}`. No token.

### `GET /api/tomes`

Authenticated. Returns `TomeResponse[]`, `[]` when the user has none. Used by Dashboard, Accounts,
Simulate and Compare.

### `POST /api/tomes`

Authenticated. Body is `TomeRequest`.

```json
{
  "name": "Example Card",
  "currentBalance": 1200.5,
  "apr": 19.99,
  "minimumDebtPayment": 35,
  "creditLimit": 5000,
  "type": "CREDIT_CARD"
}
```

Returns the created `Tome`. The UI then reloads the list. `apr: null` is sent when the field is
left blank, but the server **rejects it with `500`** while unboxing the primitive entity field.
Enter a numeric APR. When `apr` is supplied, `estimatedApr` mirrors it.

### `DELETE /api/tomes/{id}`

Authenticated. `204` on success. The UI confirms with `window.confirm`, then reloads. Missing or
foreign ids return `500`; the row stays visible.

### `GET /api/archive/scenarios`

Authenticated. Returns `Scenario[]` scoped to the current user. Also used as the
session-validation call on reload.

### `POST /api/archive/scenarios`

Authenticated. Body is `ScenarioInput`. The server sets `id`, `userId`, and the timestamps; any
client-supplied values for those fields are ignored/cleared.

```json
{ "name": "Example scenario", "strategy": "SNOWBALL", "extraPayment": 25, "lumpSumPayment": 100 }
```

Returns the created `Scenario`. Used by the Scenarios form and by "Save scenario" after a
simulation.

### `DELETE /api/archive/scenarios/{id}`

Authenticated. `204` on success. `404` with an empty body when the id is unknown **or owned by
another user**.

### `POST /api/assemble/run`

Authenticated. Body is `SimulationInput`; returns `SimulationResult`. Nothing is persisted.

```json
{
  "principal": 1000,
  "interestRate": 0.2,
  "termMonths": 60,
  "minimumPayment": 50,
  "extraPayment": 25,
  "lumpSumPayment": 0,
  "strategy": "SNOWBALL"
}
```

Response (abridged):

```json
{
  "id": "<SIMULATION_ID>",
  "status": "COMPLETED",
  "totalInterestPaid": 250.0,
  "totalPrincipalPaid": 1000.0,
  "monthsToPayoff": 25,
  "payoffDate": "2027-01-15T12:00:00Z",
  "savingsComparedToBaseline": 0.0,
  "remainingBalance": 0.0,
  "schedule": [
    {
      "monthIndex": 1,
      "date": "2026-02-15T12:00:00Z",
      "payment": 75.0,
      "principalPaid": 58.33,
      "interestPaid": 16.67,
      "remainingBalance": 941.67
    }
  ]
}
```

`status` is `COMPLETED` only when the final balance reaches zero. A plan that runs out of
`termMonths` (a horizon, not a doubled cap) is `FAILED` and carries `remainingBalance`,
`monthsToPayoff: 0` and `payoffDate: null`; `SimulationResultView` shows the remaining balance and a
warning instead of a payoff date. `savingsComparedToBaseline` is `0` for a failed run.

`payoffDate` is the last `schedule[].date` for a completed run and `null` otherwise. `userId` and
`simulationInputId` echo the request body (both `null` for this UI, which does not send them).

### Simulation ledger (new path)

The decision authority is the monthly timeline, not the recommendation. The legacy
`/api/assemble/run` above is kept for one release; new work uses:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/simulate/compare` | five plans over one debt set; returns `ComparisonResponse` |
| POST | `/api/simulate/run` | one plan; returns `PlanTimeline` |
| GET | `/api/simulate/runs/{runId}` | a persisted plan |
| GET | `/api/simulate/runs?limit=20` | recent plans |
| GET | `/api/simulate/comparisons/{groupId}` | all plans of one comparison |

`PlanType`: `CURRENT`, `MINIMUM`, `SNOWBALL`, `AVALANCHE`, `HYBRID`.
`TerminationReason`: `NONE`, `PAID_OFF`, `HORIZON_REACHED`, `STAGNANT`.
`extraPayment` and `lumpSumPayment` apply to the three strategy plans only.

The TypeScript shapes live in `src/types/api.ts` (`MonthLedger`, `DebtMonthLedger`,
`PlanTimeline`, `ComparisonResponse`). Simulate calls `/api/simulate/run`, Compare calls
`/api/simulate/compare` with all five plans, and Dashboard reads
`/api/simulate/runs?limit=20` and shows the first month of the latest `CURRENT` run. Compare
renders `recommendedPlan` directly; no page calls `/api/oracle/strategy/*` or
`/api/assemble/run`.

### `POST /api/oracle/strategy/recommend`

Authenticated. Body is a **bare array** of `DebtSnapshot`; the response is a **bare JSON string**.

```json
[
  {
    "tomeId": "<TOME_ID>",
    "accountName": "Example Card",
    "currentBalance": 1000,
    "apr": 18.0,
    "estimatedApr": 18.0,
    "minimumPayment": 50,
    "interestRate": 18.0
  }
]
```

```json
"AVALANCHE"
```

Empty array (or every balance at `0`) → `"MINIMUM_ONLY"`. Otherwise the answer is the cheapest of
`SNOWBALL`, `AVALANCHE` and `HYBRID` under the same projection and ranking as `/analyze`, so the
two endpoints agree. Because the request carries no extra payment, plans differ only once a debt
closes; when every payment is a minimum the plans tie and the name tie-break returns
`"AVALANCHE"`. This is an identical-plan outcome, not a preference.

### `POST /api/oracle/strategy/order`

Authenticated. Body wraps both inputs because the API accepts one request body.

```json
{
  "debts": [
    {
      "tomeId": "<TOME_ID>",
      "accountName": "Example Card",
      "currentBalance": 1000,
      "apr": 18.0,
      "estimatedApr": 18.0,
      "minimumPayment": 50,
      "interestRate": 18.0
    }
  ],
  "input": {
    "strategyType": "SNOWBALL",
    "customDebtOrder": [],
    "extraPayment": 0,
    "lumpSumPayment": 0
  }
}
```

Returns `StrategyOutput` with `orderedDebts` in payoff order.

### `POST /api/oracle/strategy/analyze`

Authenticated. Body:

```json
{
  "debts": [
    {
      "tomeId": "<TOME_ID>",
      "accountName": "Example Card",
      "currentBalance": 1000,
      "apr": 18.0,
      "estimatedApr": 18.0,
      "minimumPayment": 50,
      "interestRate": 18.0
    }
  ],
  "strategies": ["SNOWBALL", "AVALANCHE"],
  "input": { "extraPayment": 0, "lumpSumPayment": 0 }
}
```

Returns `StrategyAnalysis`. `recommendedStrategy` is always a string today; the server falls back
to `"MINIMUM_ONLY"` when there are no comparisons, even though the TypeScript type allows `null`.
`projectedInterest` comes from a per-debt payoff simulation and reacts to ordering once
`input.extraPayment` gives the plan money above the minimums. This Oracle analysis is legacy: the
Compare page now uses `/api/simulate/compare`, whose `recommendedPlan` is the only recommendation
the UI renders.

### Wrapped but unused by screens

`src/services/oracle.ts` also wraps
`POST /api/oracle/strategy/calculate-total-interest` (bare `DebtSnapshot[]` → number) and
`GET /api/oracle/strategy/is-deterministic/{strategy}` (→ boolean). No page calls them.

`src/services/archive.ts` also wraps `GET` and `PUT /api/archive/scenarios/{id}`. No page calls
them; the UI only lists, creates, and deletes scenarios.

---

## 6. UI quirks and invariants

1. **APR units.** Ledger pages send `tomeIds`; the server reads the stored percentage APR. The
   legacy single-balance wrapper converts a form percentage with `aprPercentToDecimal()` before
   sending `SimulationInput.interestRate` (annual decimal). `Tome.apr`, `DebtSnapshot.apr` and
   `DebtSnapshot.interestRate` stay percentages. Never mix the two.
2. **Estimated APR is reachable.** A null/blank `apr` stores `estimatedApr = 16.0000` (percent);
   `apr` itself stays null. `effectiveApr()` falls back to the estimate, and the Accounts field is
   optional. Do not describe the estimate as broken or unreachable.
3. **Horizon, not a doubled cap.** `SimulatePage` validates a horizon of 1-600 months, non-negative
   extra/lump sums, and a lump-sum month inside the horizon. The engine returns
   `HORIZON_REACHED` or `STAGNANT` with a remaining balance instead of pretending the plan paid
   off.
4. **Single-balance simulation (legacy).** `POST /api/assemble/run` models one balance. No page
   calls it after the FEAT-002 migration; it remains until the retirement change.
5. **Ephemeral runs (legacy).** `/api/assemble/run` results are not persisted server-side. The
   `/api/simulate/*` ledger runs are persisted and are what Dashboard reads; the old
   `utilisim.lastRun` session value is no longer written by the pages.
6. **Scenarios are presets, not results.** Only name, plan (`strategy`), extra payment, and lump
   sum are stored. Balances come from the selected accounts; the horizon is re-entered.
7. **Scenarios are owner-scoped.** The API sets `userId` from the token and returns only the
   caller's rows; foreign ids are indistinguishable from missing ones (`404`). The Scenarios page
   states that the list is private.
8. **No account editing.** There is no `PUT /api/tomes/{id}`. The UI offers delete + re-create
   and says so on the Accounts page.
9. **`username` is the email.** Both login and register responses echo the email in `username`.
   Do not render it as a display name.
10. **No pagination.** `GET /api/tomes` and `GET /api/archive/scenarios` return every row. The
    Dashboard slices for display; Accounts, Scenarios, and Compare do not.
11. **No request timeout.** A hung backend leaves a spinner until the user reloads. There is no
    `AbortController` in `lib/api.ts`.
12. **`window.confirm` deletes.** Accounts and Scenarios use the native confirm dialog; there is no
    custom modal.
13. **React StrictMode.** In development, effects run twice, so `useApiResource` may issue two
    GETs on mount. Production runs once.
14. **`204` is `undefined`.** Services type delete calls as `api<void>`; do not attempt to read a
    body from a successful delete.
15. **No refresh flow.** There is no refresh endpoint. A `401` ends in a client-side sign-out;
    expiry or a backend restart now produces that `401` and clears the session (§3).
16. **A failed run is not a payoff (legacy).** For `/api/assemble/run`, `status === 'FAILED'` means
    the balance never reached zero (`remainingBalance > 0`, `payoffDate: null`,
    `monthsToPayoff: 0`). `SimulationResultView` shows the remaining balance and a warning; never
    read `monthsToPayoff` alone.
17. **A client-supplied `userId` is ignored.** Scenario ownership comes from the token; POST
    clears any `id` in the body so a create cannot overwrite an existing row.
18. **Blank APR stores the estimate.** `POST /api/tomes` with `apr: null` persists 16.0000 percent
    and returns `estimatedApr`. The Accounts page labels APR as optional.
19. **The Oracle recommendation is legacy.** `/recommend` returns the cheapest of Snowball,
    Avalanche and Hybrid under the old projection. Compare no longer calls it; the ledger's
    `recommendedPlan` is the only recommendation the UI renders.
20. **Ledger payoff state uses `terminationReason`.** A run can have `status: COMPLETED` and still
    end at the horizon. Show "not repaid" unless `terminationReason` is `PAID_OFF`; never infer
    payoff from `status`.

---

## 7. Change protocol

When an endpoint, DTO, status code, or auth rule changes:

1. Update the backend contract first ([`../utilisim-api/API_CONTRACT.md`](../utilisim-api/API_CONTRACT.md)).
2. Update `src/types/api.ts` so the TypeScript models match the wire format exactly.
3. Update the service wrapper in `src/services/`.
4. Update the affected page and its error handling.
5. Update this document in the **same** change.
6. Run `npm run typecheck`, `npm run lint`, and `npm run build`.

Every example added here must use synthetic values. Audit for credentials, tokens, real emails,
database names, and machine-specific paths before merging.

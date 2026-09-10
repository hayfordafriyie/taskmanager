# Task Manager — Frontend

React 19 + Vite single‑page app for the Task Manager backend. It talks to the Go
GraphQL API (encrypted transport), keeps server state in React Query, and uses a
Radix + Tailwind v4 “liquid glass” design system with light/dark themes.

- **Stack:** React 19, Vite 8, React Router 7, TanStack Query 5, Radix UI
  primitives, Tailwind CSS v4, Vitest + Testing Library
- **Served in Docker by:** Caddy (static files + reverse proxy for `/api/*`)

---

## 1. Quick start

### Option A — everything in Docker (recommended)

From the **repository root**:

```bash
cp .env.example .env        # backend + Postgres/Redis values
docker compose up -d --build
```

Open **https://localhost:8443** (self‑signed certificate — accept the warning).
`http://localhost:5173` permanently redirects there. Caddy serves the built app
and proxies `/api/*` to the backend container, so **no `VITE_API_URL` is needed**
in this mode.

### Option B — Vite dev server (fastest inner loop)

```bash
# 1) backend infra + API (from the repo root)
docker compose up -d postgres redis
cd backend && go run ./cmd/server      # :8080

# 2) frontend
cd frontend
npm install
cp .env.example .env                   # see §2
npm run dev                            # http://localhost:5173
```

Vite proxies `/api` → `http://localhost:8080` (`vite.config.js`), which means an
**empty `VITE_API_URL`** is the simplest setting during development — requests go
to the same origin and are proxied to the backend.

---

## 2. Environment variables

All variables are **build‑time** (`VITE_` values are inlined into the bundle by
Vite), so changing them requires a restart/rebuild — never put secrets here.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | *(empty)* | Base URL of the API. **Empty = same origin** (Vite proxy in dev, Caddy in Docker). Set to e.g. `http://localhost:8080` only when the API runs on a different origin. |
| `VITE_API_VERSION` | `v1` | API version segment: requests go to `<API_URL>/api/<version>/query` |
| `VITE_ENCRYPTED_MARKER` | `1` | Value of the `X-Encrypted` header used by the session‑encryption protocol; must match the backend |

Copy `frontend/.env.example` → `frontend/.env`. The per‑session encryption key is
fetched at runtime from `POST /api/v1/session` and is **never** part of the
bundle, so there is nothing secret to configure.

In Docker these come from `docker-compose.yml` build args
(`VITE_API_URL`, `VITE_API_VERSION`, `VITE_ENCRYPTED_MARKER`) — set them in the
root `.env`.

---

## 3. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR (`:5173`, `/api` proxied to `:8080`) |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm test` | Vitest run (jsdom, Testing Library) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | oxlint |

---

## 4. How the API layer works

`src/lib/api.js` is the single entry point:

1. `POST /api/v1/session` once per browser session to get the encryption key.
2. Every GraphQL call encrypts `{query, variables}` and sends it with
   `X-Encrypted`; responses are decrypted transparently by `readBody`.
3. `Authorization: Bearer <accessToken>` is attached when logged in; a `401`
   triggers one automatic refresh (tokens live in `localStorage`).
4. `EVENTS_ENDPOINT` (`/api/v1/events`) is used for the realtime SSE stream.

Domain hooks live next to their feature and only build queries/mutations:

```
src/modules/<feature>/hooks.js   e.g. tasks, goals, docs, chat, notifications, time, reports
```

`src/modules/chat/realtime.js` opens one `EventSource` for the whole app and
patches the React Query caches, so chat and notification badges update instantly;
polling in the chat hooks is the fallback when SSE is unavailable.

---

## 5. Features / where things live

| Area | View | Data |
|---|---|---|
| Dashboard | `modules/home/dashboard.jsx` | `dashboard` query (stats, upcoming, activity, due this week) |
| My tasks | `views/MyTasksView.jsx` | `teamTasks` (assigned to you) |
| Board (Kanban) | `views/BoardView.jsx` | `teamTasks` + create/assign/status mutations, native drag & drop |
| Calendar | `views/CalendarView.jsx` | `teamTasks` filtered to assigned/created by you |
| Inbox (chat) | `views/InboxView.jsx` | `conversations`, `conversationMessages`, `sendMessage`, SSE |
| Goals / OKRs | `views/GoalsView.jsx` | `teamGoals` + key results / check‑ins |
| Docs (wiki) | `views/DocsView.jsx` | `teamDocs` + per‑member sharing |
| Time tracking | `views/TimeView.jsx` | `timeEntries`, `timeSummary`, `logTime` |
| Reports | `views/ReportsView.jsx` | `reports` (trend, status mix, workload) |
| Invites | `views/InviteView.jsx` | `myTeam`, `myInvites` |
| Notifications | `components/NotificationBell.jsx` | `notifications`, `unreadNotificationCount` |

Auth pages (`/login`, `/signup`, `/reset-password`) render in a centred glass card
with **no theme toggle**; the light/dark switch lives in the authenticated app bar.

---

## 6. Testing

```bash
npm test
```

- Vitest + jsdom; setup in `src/test/setup.js` (pointer/ResizeObserver/
  `scrollIntoView` shims so Radix primitives work under jsdom).
- `tests/test-utils.jsx` renders a UI inside `QueryClientProvider` +
  `ToastProvider`.
- Feature tests **mock their own hooks module** (`vi.mock('.../hooks')`) and assert
  on the API calls the UI makes — e.g. `tests/board.test.jsx`, `tests/docs.test.jsx`,
  `tests/calendar.test.jsx`, `tests/inbox.test.jsx`.
- No network or backend is required to run the suite.

---

## 7. Project layout

```
frontend/
  index.html
  vite.config.js        dev server + /api proxy
  vitest.config.js      jsdom + setup file
  Caddyfile             Docker serving (SPA fallback + /api proxy + TLS)
  src/
    main.jsx            providers: QueryClient, fonts, index.css
    App.jsx             routes (protected / unauthenticated)
    index.css           design tokens, glass utilities, ambient background
    components/         Button, Select, Toast, Tooltip, Dock, NotificationBell…
    hooks/useTheme.js   light/dark theme (localStorage + system preference)
    layout/             authenticated shell (app bar, dock) + auth shell
    lib/                api.js (encrypted client), crypto.js, queryClient.js
    modules/
      auth/ home/ tasks/ goals/ docs/ chat/ notifications/ time/ reports/ invite/
    test/setup.js
  tests/                Vitest suites
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Requests fail with a session/handshake error | the backend must be reachable at the same origin (or `VITE_API_URL`); check `/api/v1/session` responds |
| CORS errors in dev | run with an empty `VITE_API_URL` so the Vite proxy handles `/api` |
| `https://localhost:8443` certificate warning | expected: Compose generates a self‑signed cert; trust it or use the HTTP dev server |
| Chat doesn’t update live | SSE may be blocked by the proxy — the hooks poll as a fallback; check `/api/v1/events` |
| Env change has no effect | `VITE_*` values are compiled in: restart `npm run dev` or rebuild the image |

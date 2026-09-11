# Task Manager

A full‑stack, team‑oriented task manager: tasks on a Kanban board, goals/OKRs,
docs with per‑member permissions, time tracking, reports, an in‑app notification
centre, and a **realtime chat inbox** — with SMS alerts for the things that
matter (assignments, status changes, invites, chat messages, due dates).

| | |
|---|---|
| **Backend** | Go 1.27 · GraphQL (gqlgen) · PostgreSQL 16 · Redis · SSE realtime |
| **Frontend** | React 19 · Vite 8 · React Router 7 · TanStack Query 5 · Radix UI · Tailwind v4 |
| **Serving** | Caddy (static SPA + `/api/*` reverse proxy + TLS) — either bundled in the Docker container or delegated to a system‑level Caddy |
| **Infra** | Docker Compose (Postgres, Redis, backend, frontend) |

> Detailed, component‑specific instructions live in **[`backend/README.md`](backend/README.md)**
> and **[`frontend/README.md`](frontend/README.md)**. This file is the project‑wide
> guide: architecture, running everything, environment, API surface and deployment.

---

## Table of contents

1. [Feature overview](#1-feature-overview)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Quick start (Docker Compose)](#4-quick-start-docker-compose)
5. [Local development](#5-local-development)
6. [Environment variables](#6-environment-variables)
7. [Data model & migrations](#7-data-model--migrations)
8. [API surface](#8-api-surface)
9. [Realtime, caching & workers](#9-realtime-caching--workers)
10. [Testing](#10-testing)
11. [Deployment](#11-deployment)
12. [Security](#12-security)
13. [Troubleshooting](#13-troubleshooting)
14. [Further documentation](#14-further-documentation)

---

## 1. Feature overview

**Accounts & teams**
- Phone‑number signup with SMS OTP verification, password login, password reset.
- JWT access + refresh tokens (rotated on refresh); sessions stored server‑side.
- Personal workspace created automatically, plus invitations to other workspaces
  (admin / member / guest roles) with an invite SMS.

**Work**
- **Tasks**: create, edit, assign to a member, priority, due date, description,
  four Kanban statuses (to do → in progress → review → done) with drag‑and‑drop,
  manual status changes, and a per‑task done/open toggle in *My tasks*.
- **Goals / OKRs**: goals with an owner and key results; progress is the average
  of key results, updated by check‑ins.
- **Docs**: a lightweight wiki with a real editor and **per‑member permissions**
  (`team` / `restricted` / `private`, with view or edit grants).
- **Time**: log minutes against a task or a free label, per‑week table, totals,
  daily average and top project.
- **Calendar**: tasks placed on their due dates, filtered to *assigned to me* or
  *created by me*.
- **Reports**: completion trend (7 days), status mix, team workload and headline
  totals.
- **Dashboard**: one nested payload with stats, upcoming tasks, status
  breakdown, recent activity and “due this week”.

**Communication**
- **Inbox**: WhatsApp‑style 1:1 chat with any teammate; conversations are
  *find‑or‑create*, so re‑opening a chat continues the old thread.
- **Realtime**: new messages are pushed over an internal pub/sub hub exposed as
  Server‑Sent Events; polling is the fallback.
- **Notifications**: in‑app centre with full CRUD (mark read/unread one or all,
  delete one or all) plus **due‑soon reminders** for assigned tasks that are not
  done.
- **SMS alerts**: assignments and status changes, invites, and chat messages.

---

## 2. Architecture

```
                            ┌──────────────────────────────┐
        browser  ────────►  │  System Caddy (host)         │
                            │  • TLS (Let's Encrypt)       │
                            │  • acs.edspike.com           │
                            │  • /api/* ──► :8080          │
                            │  • else    ──► :5173         │
                            └──────┬───────────────┬───────┘
                                   │               │
                    ┌──────────────▼──┐   ┌────────▼───────────┐
                    │ Go backend      │   │ Docker Caddy       │
                    │ (:8080)         │   │ (:5173 → 80)       │
                    │  • GraphQL API  │   │  • serves SPA      │
                    │  • SSE realtime │   │  • /api/* proxy     │
                    │  • SMS worker   │   └────────────────────┘
                    └───────┬──────┬─┘
                            │      │
                ┌───────────▼──┐ ┌─▼──────────┐
                │  PostgreSQL  │ │   Redis    │
                │ (source of   │ │ (response  │
                │  truth)      │ │  cache)    │
                └──────────────┘ └────────────┘
```

**Request lifecycle (GraphQL)**
1. The browser calls `POST /api/v1/session` once to obtain a per‑session
   encryption key (bound to a cookie).
2. Every GraphQL request body is **encrypted** and sent to `/api/v1/query` with
   `X-Encrypted: 1` and `Authorization: Bearer <accessToken>`.
3. The server decrypts, authenticates (JWT → session → user), and runs the
   operation.
4. **Queries** may be served from Redis (keyed by query + variables + caller).
   **Mutations** always hit Postgres and then bump the cache epoch, so no read
   survives a write.

**Realtime**: an in‑process pub/sub hub (`internal/realtime`) fans events out to
per‑user channels; `GET /api/v1/events` streams them as SSE (bearer token via
`?token=`). The frontend keeps a single `EventSource` open and patches its React
Query caches; the chat hooks also poll as a fallback.

**Workers**: an SMS worker (bounded queue + retries) and a periodic
due‑reminder sweep run inside the API process — no separate deployable.

Design notes for individual domains: [`docs/inbox-realtime-architecture.md`](docs/inbox-realtime-architecture.md),
[`docs/goals-apis.md`](docs/goals-apis.md), [`docs/docs-apis.md`](docs/docs-apis.md).

---

## 3. Repository layout

```
taskmanager/
├── docker-compose.yml        # postgres, redis, backend, frontend
├── .env.example              # root env used by docker compose
├── backend/                  # Go API (see backend/README.md)
│   ├── cmd/server/           # entry point: config, mux, workers
│   ├── graph/                # schema.graphqls, generated code, resolvers
│   ├── internal/
│   │   ├── auth/ cache/ crypto/ db/ notif/ otp/ realtime/ server/ validator/
│   │   └── db/migrations/    # 001…011 versioned SQL
│   └── tests/                # DB-backed integration tests
├── frontend/                 # React SPA (see frontend/README.md)
│   ├── Caddyfile             # SPA fallback + /api proxy (internal HTTP)
│   └── src/
│       ├── components/ layout/ lib/
│       └── modules/          # auth, home, tasks, goals, docs, chat, …
└── docs/                     # domain design notes
```

---

## 4. Quick start (Docker Compose)

**Prerequisites:** Docker with the Compose plugin. (Nothing else — Go and Node
are not needed for the containerised path.)

```bash
git clone <repo> && cd taskmanager

# 1) Create the root env file used by Compose and fill in real values
cp .env.example .env
#    - POSTGRES_* / REDIS_PASSWORD  → database + cache credentials
#    - JWT_SECRET / JWT_REFRESH_SECRET → openssl rand -base64 48
#    - SMS_API_KEY / DEFAULT_SMS_SENDER_ID → your Mnotify credentials

# 2) Start everything
docker compose up -d --build

# 3) Watch it come up
docker compose ps
docker compose logs -f backend      # "connected to database", "database migrated",
                                    # "cache: redis enabled", "TLS enabled …"
```

**Where to go**

| URL | What |
|---|---|
| `https://acs.edspike.com` | the app (production domain, TLS via system Caddy) |
| `https://localhost:8080/api/v1/` | GraphQL playground (direct backend access) |
| `https://localhost:8080/api/v1/health` | health probe (`ok`) |

When deployed behind a system‑level Caddy (recommended for production), the
frontend container listens on `127.0.0.1:5173` and the system Caddy terminates
TLS and routes `acs.edspike.com` to the container. The backend runs on plain
HTTP inside the container (`:8080`).

`postgres`, `redis`, `backend` and `frontend` all wait for their dependencies
to be healthy before starting.

**Useful commands**

```bash
docker compose logs -f backend          # API logs (migrations, cache, SMS, reminders)
docker compose restart backend          # restart just the API
docker compose down                     # stop (keeps volumes/data)
docker compose down -v                  # stop and DELETE all data
docker compose build --no-cache backend # clean rebuild
```

---

## 5. Local development

Infrastructure in Docker, apps on the host — the fastest inner loop.

```bash
cp .env.example .env
docker compose up -d postgres redis     # just the data services
```

**Backend**

```bash
cd backend
cp .env.example .env                    # DB_*, REDIS_URL, JWT_*, SMS_*, SERVER_PORT
go run ./cmd/server                     # migrations run automatically
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env                    # VITE_* (leave VITE_API_URL empty in dev)
npm run dev                             # http://localhost:5173, /api proxied to :8080
```

Notes
- The backend loads `.env` from its **current working directory** (`backend/.env`),
  not the repository root; the root `.env` is for Compose.
- Vite proxies `/api` → `http://localhost:8080`, so an empty `VITE_API_URL` is the
  simplest dev setting.
- Full details: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md).

---

## 6. Environment variables

### Root `.env` — used by `docker compose` and passed to the containers

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres + backend | the backend receives them as `DB_USER` / `DB_PASSWORD` / `DB_NAME` |
| `REDIS_PASSWORD` | Redis + backend | Compose builds `REDIS_URL` from it |
| `REDIS_URL` | backend | `redis://:<password>@redis:6379/0` in Compose; `127.0.0.1` for local runs |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | backend | **required**; generate with `openssl rand -base64 48` |
| `CORS_ORIGINS` | backend | comma‑separated browser origins allowed to call the API (exact match). **Required in production** (e.g. `https://app.example.com`); when empty only loopback origins are accepted |
| `APP_URL` | backend | public app URL used in SMS links (invites, password resets) |
| `SMS_API_KEY` (or `SMS_KEY`), `DEFAULT_SMS_SENDER_ID`, `SMS_BASE_URL`, `SENDER_ID` | backend | Mnotify credentials |
| `VITE_API_URL`, `VITE_API_VERSION`, `VITE_ENCRYPTED_MARKER` | frontend build | inlined into the bundle; set `VITE_API_URL` to the public URL in production |
| `SERVER_PORT` | backend | `8080` |

### Backend‑only (see `backend/.env.example`)

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`,
`APP_URL` (optional, linked in SMS), `DUE_REMINDER_WINDOW_HOURS` (default `24`),
`DUE_REMINDER_INTERVAL` (minutes, default `60`).

### Frontend‑only (see `frontend/.env.example`)

`VITE_API_URL`, `VITE_API_VERSION` (default `v1`), `VITE_ENCRYPTED_MARKER`
(default `1`). All `VITE_*` values are **compile‑time** — restart/rebuild after
changing them. No secrets belong here (the session key is fetched at runtime).

---

## 7. Data model & migrations

Migrations live in `backend/internal/db/migrations/*.sql`, are applied **in
numeric order on startup**, and are recorded in `schema_migrations` so each runs
exactly once.

| File | Adds |
|---|---|
| `001_init.sql` | users, OTPs, sessions, helpers |
| `002_teams_invites.sql` | teams, team_members, invites |
| `003_onboarding_team.sql` | personal workspace on signup |
| `004_resend_pending_invites.sql` | re‑inviting a pending phone |
| `005_tasks.sql` | tasks + assignment/status helpers |
| `006_notifications.sql` | notifications + due‑soon reminder generator |
| `007_task_description.sql` | task description updates |
| `008_chat.sql` | conversations, members, messages |
| `009_goals.sql` | goals + key_results |
| `010_time.sql` | time_entries + weekly summaries |
| `011_docs.sql` | docs + doc_access (per‑member permissions) |

Core entities: **users**, **teams** / **team_members**, **invites**, **tasks**,
**notifications**, **conversations** / **messages**, **goals** / **key_results**,
**time_entries**, **docs** / **doc_access**. Business rules (permissions, computed
progress, unread counts, reminders) live in SQL functions so every caller shares
one implementation.

---

## 8. API surface

**Endpoints**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/session` | encryption handshake (per‑session key) |
| `POST`/`GET` | `/api/v1/query` | GraphQL (encrypted, bearer auth) |
| `GET` | `/api/v1/events?token=…` | realtime SSE stream |
| `GET` | `/api/v1/` | GraphQL playground |
| `GET` | `/api/v1/health`, `/health` | health probe |

**GraphQL root fields** (by domain)

- *Auth*: `me`, `requestOTP`, `verifyOTP`, `createAccount`, `login`,
  `refreshToken`, `logout`, `requestPasswordReset`, `resetPassword`
- *Team*: `myTeam`, `myInvites`, `inviteToTeam`, `acceptInvite`, `revokeInvite`
- *Tasks*: `teamTasks`, `createTask`, `updateTask`, `assignTask`,
  `setTaskStatus`, `updateTaskDescription`
- *Dashboard*: `dashboard`
- *Notifications*: `notifications`, `unreadNotificationCount`,
  `markNotificationRead`/`Unread`, `markAllNotificationsRead`/`Unread`,
  `deleteNotification`, `deleteAllNotifications`
- *Chat*: `conversations`, `conversationMessages`, `startConversation`,
  `sendMessage`, `markConversationRead`
- *Goals*: `teamGoals`, `createGoal`, `updateGoalStatus`, `createKeyResult`,
  `setKeyResultProgress`, `deleteGoal`
- *Time*: `timeEntries`, `timeSummary`, `logTime`, `deleteTimeEntry`
- *Reports*: `reports`
- *Docs*: `teamDocs`, `docAccessList`, `createDoc`, `updateDoc`, `deleteDoc`,
  `setDocAccess`, `revokeDocAccess`

Schema source of truth: `backend/graph/schema.graphqls`.

---

## 9. Realtime, caching & workers

**Realtime (SSE)** — `GET /api/v1/events` authenticates via `?token=` or the
`Authorization` header and streams `event: message` JSON frames; a `: ping`
heartbeat every 25s keeps proxies open, and slow subscribers are dropped rather
than blocking. The frontend consumes it in `src/modules/chat/realtime.ts`.

**Redis cache** — GraphQL **read responses** are cached for 30s, keyed by a hash
of the raw query + variables + caller token. Every mutation bumps an epoch
counter (`INCR tm:ver`); keys are namespaced `tm:<epoch>:…`, so invalidation is
instant and global with no key scans. Redis is optional: if it is unreachable the
API logs `cache: redis disabled (…)` and serves everything straight from
Postgres.

**Workers** — the SMS worker (queue + retries, Mnotify) sends assignment,
status‑change, invite and chat‑message alerts; the due‑reminder loop periodically
creates “due soon” notifications for assigned tasks that are not done.

---

## 10. Testing

**Backend**

```bash
cd backend
docker compose up -d postgres redis   # from the repo root
go test ./...                         # integration tests create taskmanager_test_* DBs
go build ./... && go vet ./...
```

Integration tests **skip automatically** when Postgres is unreachable; the cache
tests (`internal/cache`) run with no database at all (they use an in‑process fake
RESP server).

**Frontend**

```bash
cd frontend
npm test          # Vitest + jsdom
npm run lint
npm run build
```

Feature tests mock their own hooks modules and assert on the API calls the UI
makes; no backend is required. Current status: **80 tests across 18 files**.

---

## 11. Deployment

### 11.1 Production checklist

1. **Secrets** — set strong values in the root `.env`:
   `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
   (`openssl rand -base64 48`), and real SMS credentials.
2. **TLS** — the recommended production setup delegates TLS termination to a
   **system‑level Caddy** (or nginx/HAProxy) that routes to the Docker containers.
   The backend runs on plain HTTP inside the container. If you need end‑to‑end TLS,
   set `TLS_CERT`/`TLS_KEY` in the backend env and update the Caddyfile accordingly.
3. **`VITE_API_URL`** — set it to the public URL (e.g. `https://acs.edspike.com`)
   so the frontend makes API calls to the correct origin.
4. **`APP_URL`** — set it to the public URL so SMS texts link users to the right
   place.
5. **Database** — point `DB_*` at managed Postgres (`DB_SSLMODE=require`).
   Migrations run on startup; roll them out with the app.
6. **Redis** — provide `REDIS_URL` for the response cache (optional but
   recommended); the app degrades gracefully without it.
7. **Sender ID / SMS** — verify the Mnotify sender ID is approved for your account.

### 11.2 Deploy with Compose

```bash
cp .env.example .env      # fill in production values
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Because `restart: unless-stopped` is set for the data services and both apps, the
stack survives host reboots. Published host ports:

| Service | Host port | Container port | Notes |
|---|---|---|---|
| Postgres | `127.0.0.1:5433` | `5432` | loopback only; remapped to avoid conflicts with an existing Postgres |
| Redis | `127.0.0.1:6380` | `6379` | loopback only; remapped to avoid conflicts with an existing Redis |
| Backend | `127.0.0.1:8080` | `8080` | loopback only; plain HTTP, the reverse proxy fronts it |
| Frontend | `127.0.0.1:5173` | `80` | loopback only; the system Caddy proxies to this |

Every published port is bound to `127.0.0.1`, so nothing is reachable from the
host network — only from the machine itself (and from containers on
`taskmanager-net`). For a remote database connection use an SSH tunnel or a
managed instance. You can drop the Postgres/Redis mappings entirely if you only
need in‑stack access.

### 11.3 System Caddy integration

When running behind a system‑level Caddy (recommended), add a block to
`/etc/caddy/Caddyfile`:

```caddy
acs.edspike.com {
    import edspike_origin_guard
    rate_limit {
        zone per_ip {
            key {remote_host}
            events 100
            window 1m
            ipv6_prefix 64
        }
    }
    encode zstd gzip
    route /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    route {
        reverse_proxy 127.0.0.1:5173
    }
}
```

Then reload: `sudo systemctl reload caddy`.

### 11.4 Scaling notes

- The API is **stateless** (JWT auth, DB‑backed sessions) — run several replicas
  behind a load balancer. Caching stays consistent because invalidation is an
  epoch counter in Redis, not per‑process state.
- **SSE is per‑process**: a client connected to replica A receives events
  published by replica A. For multi‑replica push, publish events through Redis
  pub/sub (the hub in `internal/realtime` is the single place to change) — the
  polling fallback already keeps clients correct meanwhile.
- Postgres connection pool is configured in `internal/db/db.go`
  (max 10 / min 2 per replica).

### 11.5 Backups & data

| Data | Where | Notes |
|---|---|---|
| Database | `pgdata` volume | schedule `pg_dump` (or managed snapshots) |
| Redis | `redisdata` volume, AOF on | cache only — safe to lose |

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

### 11.6 Operations

- **Health**: `GET /health` and `/api/v1/health` return `ok` — use for container
  and load‑balancer probes.
- **Logs**: JSON‑file driver with rotation (`max-size 10m`, `max-file 3`) for every
  service. Watch for `cache: redis disabled`, `due reminders: created N`, and SMS
  worker errors.
- **Resource limits** are declared per service in `docker-compose.yml`
  (CPU/memory) — adjust to your host.

---

## 12. Security

- **Encrypted transport**: GraphQL bodies are encrypted with a per‑session key
  issued by `POST /api/v1/session`; clients must complete the handshake
  (implemented in `frontend/src/lib/api.ts`).
- **Auth**: short‑lived JWT access tokens + rotating refresh tokens; sessions are
  stored server‑side and can be invalidated (rotating `JWT_SECRET` invalidates
  everything).
- **Passwords** are hashed with bcrypt; OTPs are hashed and rate‑limited.
- **Abuse protection**: per‑phone and per‑IP brute‑force protection on auth
  endpoints, plus HTTP rate limiting.
- **HTTP hardening**: security headers and HSTS (via Caddy). CORS uses an
  **explicit allow‑list**: set `CORS_ORIGINS` to your app's origin(s) in
  production. When it is empty only loopback origins are reflected, so local
  development works while a public deployment is closed by default.
- **Least privilege in data**: every query/mutation is membership‑checked in SQL;
  docs enforce `team`/`restricted`/`private` visibility and per‑member edit
  grants; a user can only read their own notifications, time entries and
  conversations.
- **Secrets**: keep `.env` out of version control (already git‑ignored); never put
  secrets in `VITE_*` variables — they are compiled into the public bundle.

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App loads but API calls fail | backend not healthy: `docker compose logs backend`; check DB/Redis env match |
| `database connection failed` | Postgres not up, or `DB_*` ≠ `POSTGRES_*`; for local runs check `backend/.env` |
| `SERVER_PORT is not set in .env` | running outside `backend/` or missing `backend/.env` |
| `JWT_SECRET and JWT_REFRESH_SECRET must be set` | fill both in the root **and** `backend/.env` |
| `cache: redis disabled` | Redis down/unset — harmless; start Redis to enable caching |
| Backend tests are "skipped" | Postgres unreachable — start it first |
| Env change had no effect (frontend) | `VITE_*` are build‑time: restart `npm run dev` or rebuild the image |
| Chat not updating live | SSE blocked by a proxy; the hooks poll meanwhile — check `/api/v1/events` |

---

## 14. Further documentation

- **[`backend/README.md`](backend/README.md)** — backend env vars, endpoints,
  migrations, tests, gqlgen workflow, cache internals, layout.
- **[`frontend/README.md`](frontend/README.md)** — frontend env vars, scripts,
  API/auth flow, feature map, component layout, testing.
- **[`docs/inbox-realtime-architecture.md`](docs/inbox-realtime-architecture.md)** —
  chat data model, the internal realtime hub, notification/SMS fan‑out.
- **[`docs/goals-apis.md`](docs/goals-apis.md)** — goals/OKR API and progress model.
- **[`docs/docs-apis.md`](docs/docs-apis.md)** — docs permissions model and API.
- **`backend/graph/schema.graphqls`** — the authoritative API contract.

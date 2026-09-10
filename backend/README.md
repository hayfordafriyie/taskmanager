# Task Manager — Backend

Go + PostgreSQL + GraphQL (gqlgen) API for the Task Manager app: authentication
(phone + OTP + JWT), teams/invites, tasks, goals, docs, time tracking, in‑app
notifications, SMS alerts and a realtime chat inbox.

- **Language / runtime:** Go 1.27
- **API:** GraphQL (gqlgen), served at `/api/v1/query` (request/response bodies are
  encrypted with a per‑session key — see “Transport” below)
- **Database:** PostgreSQL 16 (schema is created by versioned migrations that run
  automatically on startup)
- **Cache:** Redis (optional, graceful degradation) for GraphQL read responses
- **Realtime:** in‑process pub/sub hub exposed as Server‑Sent Events (SSE)
- **SMS:** Mnotify via a background worker (assignments, status changes, chat)

---

## 1. Quick start

### Option A — everything in Docker (recommended)

From the **repository root**:

```bash
cp .env.example .env        # then edit the values (see §2)
docker compose up -d --build
```

That starts `postgres`, `redis`, the backend (`:8080`) and the frontend, and
waits for healthy dependencies. Check it:

```bash
docker compose ps
docker compose logs -f backend
curl http://localhost:8080/api/v1/health   # -> ok   (plain HTTP inside the container)
```

### Option B — infra in Docker, backend locally (fastest inner loop)

Start only Postgres and Redis:

```bash
cp .env.example .env
docker compose up -d postgres redis
```

Then run the API on your machine:

```bash
cd backend
cp .env.example .env        # set DB_* / REDIS_URL / JWT_* (see §2)
go run ./cmd/server
```

Migrations are applied automatically at startup (`database migrated` in the log),
so there is no separate migrate step.

> **Where does the backend read env from?** `godotenv/autoload` loads a `.env`
> from the **current working directory** — i.e. `backend/.env` when you run
> `go run ./cmd/server` inside `backend/`. The root `.env` is used by
> `docker compose`, not by a locally‑run process.

---

## 2. Environment variables

Create `backend/.env` (copy `backend/.env.example`). Required unless marked
optional.

### Database

| Variable | Example | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | `postgres` inside Compose |
| `DB_PORT` | `5432` | |
| `DB_USER` | `taskmanager` | must match `POSTGRES_USER` |
| `DB_PASSWORD` | `change-me` | must match `POSTGRES_PASSWORD` |
| `DB_NAME` | `taskmanager` | must match `POSTGRES_DB` |
| `DB_SSLMODE` | `disable` | use `require` for managed Postgres |

### Server / auth

| Variable | Example | Notes |
|---|---|---|
| `SERVER_PORT` | `8080` | **required** — the process exits without it |
| `JWT_SECRET` | `openssl rand -base64 48` | **required**; rotating it logs everyone out |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` | **required** |
| `APP_URL` | `https://localhost:8443` | optional; linked in SMS texts |

### Redis cache (optional)

| Variable | Example | Notes |
|---|---|---|
| `REDIS_URL` | `redis://:password@localhost:6379/0` | preferred form |
| `REDIS_ADDR` | `localhost:6379` | alternative when there is no password |

If neither is set, or Redis is unreachable, the backend logs
`cache: redis disabled (…)` and every request goes straight to Postgres — caching
is a pure optimisation, never a requirement.

### SMS (Mnotify)

| Variable | Example | Notes |
|---|---|---|
| `SMS_API_KEY` | `…` | the code also accepts `SMS_KEY` as a fallback |
| `SMS_BASE_URL` | `https://api.mnotify.com/api/sms/quick` | |
| `DEFAULT_SMS_SENDER_ID` | `TaskManager` | sender ID shown on the phone |
| `SENDER_ID` | | kept for Compose compatibility; unused by the code |

> Without SMS credentials the worker logs send failures but the API keeps working
> — OTPs/invites are also visible in the logs during development.

### TLS (optional)

| Variable | Notes |
|---|---|
| `TLS_CERT` / `TLS_KEY` | when both are set the server serves HTTPS; otherwise plain HTTP (typical behind Caddy/nginx). In the standard Docker Compose setup the backend runs on plain HTTP and TLS is terminated by the system Caddy. |

### Background jobs (optional)

| Variable | Default | Notes |
|---|---|---|
| `DUE_REMINDER_WINDOW_HOURS` | `24` | tasks due within this window get a “due soon” notification |
| `DUE_REMINDER_INTERVAL` | `60` | minutes between reminder sweeps |

---

## 3. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/` | GraphQL playground (GraphiQL) |
| `POST`/`GET` | `/api/v1/query` | GraphQL API (encrypted body, `Authorization: Bearer <accessToken>`) |
| `POST` | `/api/v1/session` | encryption handshake — returns the per‑session key |
| `GET` | `/api/v1/events?token=<accessToken>` | realtime SSE stream (chat messages, notifications) |
| `GET` | `/api/v1/health` · `/health` | health probe → `ok` |

### Transport (important)

GraphQL bodies are **encrypted**. A client must first `POST /api/v1/session` to
obtain the per‑session key (cookie‑bound) and then send requests with
`X-Encrypted: 1`. The reference implementation of this handshake lives in the
frontend (`src/lib/api.js`). The **playground** at `/api/v1/` is handy for
poking around but does not perform the handshake, so use the app/`src/lib/api.js`
for real calls.

### Realtime (SSE)

`GET /api/v1/events` authenticates via `?token=` (EventSource cannot set headers)
or an `Authorization` header, then streams `event: message` frames as JSON. The
server sends a `: ping` heartbeat every 25s and drops slow subscribers rather
than blocking.

---

## 4. Database migrations

Applied automatically in numeric order; each file is recorded in
`schema_migrations` and never re‑run.

| File | Adds |
|---|---|
| `001_init.sql` | users, OTPs, sessions, helper functions |
| `002_teams_invites.sql` | teams, team_members, invites + helpers |
| `003_onboarding_team.sql` | personal workspace on signup |
| `004_resend_pending_invites.sql` | re‑inviting a pending phone |
| `005_tasks.sql` | tasks + status/assignment helpers |
| `006_notifications.sql` | notifications + due‑soon reminder generator |
| `007_task_description.sql` | `update_task_description` |
| `008_chat.sql` | conversations, conversation_members, messages |
| `009_goals.sql` | goals + key_results |
| `010_time.sql` | time_entries + week summaries |
| `011_docs.sql` | docs + doc_access (per‑member permissions) |

Add a new file as `NNN_name.sql` — the runner picks it up on the next start.

---

## 5. Development

```bash
go build ./...          # compile everything
go vet ./...
gofmt -l .              # list unformatted files
go test ./...           # see below
```

### Tests

`backend/tests` contains **DB‑backed integration tests**. They create a throwaway
database per test (`taskmanager_test_*`) and **skip** automatically when Postgres
is unreachable, so start the infra first:

```bash
docker compose up -d postgres redis     # from the repo root
cd backend && go test ./...
```

The DB user needs permission to `CREATE DATABASE` (the default `postgres`
superuser works).

Cache unit tests (`internal/cache`) need no database — they spin up a fake
in‑process RESP server.

### Regenerating GraphQL code

```bash
go run github.com/99designs/gqlgen generate
```

Two things to know:

1. `gqlgen.yml` sets `skip_mod_tidy: true` so generation does not try to rewrite
   `go.mod`/`go.sum`.
2. gqlgen rewrites `graph/schema.resolvers.go`. Keep hand‑written resolver
   implementations **in their own files** (e.g. `graph/task_resolvers.go`,
   `graph/chat_resolvers.go`) and restore the generated stub file afterwards
   (`git checkout HEAD -- graph/schema.resolvers.go`) — that is the workflow this
   repo uses.

---

## 6. Caching behaviour

- Read queries are cached at the **GraphQL response level**, keyed by a hash of
  the raw query + variables + caller token (so users never see each other's data).
- Every **mutation** invalidates the entire cache by bumping an epoch counter
  (`INCR tm:ver`); keys are namespaced `tm:<epoch>:…`, so no key scan is needed and
  every replica invalidates instantly.
- TTL is 30 seconds (`cacheTTL` in `graph/cache.go`).
- Successful startup logs `cache: redis enabled at …`; otherwise `cache: redis
  disabled (…)` and the API behaves identically, just uncached.

---

## 7. Project layout

```
backend/
  cmd/server/          program entry: config, HTTP mux, background workers
  graph/               GraphQL schema + generated code + resolvers
    schema.graphqls    the API contract (edit this)
    schema.resolvers.go generated stubs (do not hand-edit)
    *_resolvers.go     hand-written resolvers per domain
    cache.go           response-cache helpers (keys, hit/miss, invalidation)
  internal/
    auth/              JWT parsing/issuing, request context
    cache/             Redis client (stdlib RESP) with graceful degradation
    crypto/            per-session encryption + session store
    db/                pools, migrations, per-domain stores (task, chat, goals…)
      migrations/      versioned SQL, applied on startup
    notif/             SMS worker + Mnotify sender
    otp/               OTP generation/verification
    realtime/          in-process pub/sub hub (SSE fan-out)
    server/            HTTP middleware: CORS, rate limit, security headers, SSE
    validator/         phone + password validation
  tests/               integration tests (need Postgres)
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `SERVER_PORT is not set in .env` | you are running outside the `backend/` dir or the `.env` is missing |
| `JWT_SECRET and JWT_REFRESH_SECRET must be set` | fill both in `backend/.env` |
| `database connection failed` | is Postgres up (`docker compose up -d postgres`) and do `DB_*` match `POSTGRES_*`? |
| `cache: redis disabled` | fine — start Redis (`docker compose up -d redis`) or set `REDIS_URL` to enable caching |
| tests are skipped | Postgres was unreachable; start it first |

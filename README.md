# Distributed Airline Management System (DAMS)

A cloud-native, microservices airline platform that simulates the core
operational domains of a commercial airline — **authentication, flight
inventory, bookings, baggage tracking, and event-driven notifications**. Five
independently deployable services enforce a shared, stateless **JWT + RBAC**
security model at every boundary (no central gateway), and a **React operations
console** drives the whole system from the browser.

```
                         ┌──────────────────────────────┐
                         │   Frontend — Ops Console      │   React + Vite (:5173)
                         │   (Vite dev proxy → /api/*)   │
                         └───────┬───────┬───────┬───────┘
                  :8003 │  :8000 │ :8001 │ :8002 │
              ┌─────────▼─┐ ┌────▼────┐ ┌▼────────┐ ┌▼────────┐
              │   Auth    │ │ Flight  │ │ Booking │ │ Baggage │   FastAPI
              │ JWT/RBAC  │ │inventory│ │orchestr.│ │ tracking│
              └───────────┘ └────▲────┘ └────┬────┘ └────┬────┘
                                 │ JWT fwd   │           │
                                 └───────────┘           │
                        seat decrement/restore           │
                                             │           │
                                   ┌─────────▼──┐   ┌────▼─────┐
                                   │ Aurora PG  │   │ DynamoDB │
                                   │ (bookings) │   │(baggage) │
                                   └─────┬──────┘   └──────────┘
                                  publish │ booking-confirmed
                                   ┌──────▼──────┐   async   ┌───────────┐
                                   │  AWS SNS    │ ────────► │AWS Lambda │ ► CloudWatch
                                   │alms-booking │           │Notifier   │
                                   └─────────────┘           └───────────┘

Docker bridge: alms-network     ·     AWS region: eu-west-1 (Ireland)
```

The frontend and backend share **only** HTTP APIs; the frontend talks to the
services exclusively through token-authenticated REST calls.

> **Looking for the formal write-up?** The full project description, scope
> decisions, and architecture rationale live in
> [`Docs/project-description.md`](Docs/project-description.md), and the complete
> endpoint reference in [`Docs/api-specification.md`](Docs/api-specification.md).
> This README is the practical "get it running" guide.

---

## Contents

| Path | Description |
| ---- | ----------- |
| `auth-service/` | FastAPI — issues JWTs, RBAC, `/me`, `/admin/users` (port 8003) |
| `flight-service/` | FastAPI — flight inventory & seat management (port 8000) |
| `booking-service/` | FastAPI — booking lifecycle, Aurora PostgreSQL, SNS publish (port 8001) |
| `baggage-service/` | FastAPI — baggage tracking in DynamoDB (port 8002) |
| `Lambda notification/` | AWS Lambda — SNS consumer that dispatches notifications |
| `frontend/` | React + TypeScript + Tailwind + shadcn/ui operations console |
| `docker-compose.yml` | Builds & runs the **four backend services** on `alms-network` |
| `start-all.ps1` | Runs the four services locally **without Docker** (one window each) |
| `.env.example` | AWS / DB credentials template for the backend |
| `credentials.txt` | Demo login accounts & the RBAC permission matrix |
| `Docs/` | `api-specification.md`, `project-description.md` |
| `Postman/`, `Locust/`, `Tests/`, `Infrustracture/` | Scaffolded (evidence placeholders) |

---

## Tech stack

| Layer | Technologies |
| ----- | ------------ |
| Services | Python 3.11, FastAPI, Uvicorn, Pydantic v2 |
| Auth | python-jose (HS256), passlib, bcrypt 4.0.1 (pinned) |
| Persistence | Aurora PostgreSQL (SQLAlchemy) · Amazon DynamoDB (`dams_baggage`) |
| Messaging | Amazon SNS (`alms-booking-topic`) → AWS Lambda |
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, Axios, Recharts |
| Infra | Docker + Docker Compose (`alms-network` bridge) |

---

## ⚠️ Two things to know before you start

1. **The Booking and Baggage services need real AWS + database credentials.**
   - Booking persists to **Aurora PostgreSQL** (`DB_HOST`, `DB_PORT`, `DB_NAME`,
     `DB_USER`, `DB_PASSWORD`) and publishes booking events to **SNS**
     (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, region `eu-west-1`).
   - Baggage reads/writes **DynamoDB** (`dams_baggage`) using the same AWS keys.

   Auth and Flight are **in-memory with seed data**, so they run with no external
   config. You can demo login + flights with zero credentials; bookings and
   baggage require the AWS/DB values in `.env`.

2. **The frontend never needs the AWS/DB secrets.** It only ever speaks to the
   four services over HTTP. Because the backend enables CORS only for ports
   8000–8003, the frontend calls same-origin **`/api/*`** paths and the Vite dev
   server proxies them to each service — so **no backend change is required** and
   no secret ever reaches the browser. (See `frontend/vite.config.ts`.)

---

## Step 1 — Configure backend credentials

Copy the example and fill in your values:

```powershell
Copy-Item .env.example .env
```

Backend (`.env`, read automatically by `docker-compose`):

| Variable | Meaning |
| -------- | ------- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS keys for SNS + DynamoDB |
| `AWS_SESSION_TOKEN` | Only for temporary/assumed-role credentials |
| `AWS_REGION` | Defaults to `eu-west-1` |
| `SNS_TOPIC_ARN` | Defaults to `arn:aws:sns:eu-west-1:…:alms-booking-topic` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Aurora PostgreSQL connection for the Booking Service |
| `DYNAMODB_BAGGAGE_TABLE` | Defaults to `dams_baggage` |

> Auth and Flight need none of the above — they ship with in-memory seed data.

## Step 2 — Run the backend services

### Option A — Docker (recommended)

```powershell
docker compose up --build        # first run / after code changes
docker compose up                # subsequent runs
docker compose down              # stop & remove containers
```

This builds and starts all four services on the `alms-network` bridge, so
`booking-service` resolves `flight-service` by name. Swagger UI is available per
service at `http://localhost:<port>/docs`.

### Option B — Local, no Docker (Windows)

Prereqs: Python 3.11+ on PATH, and `pip install -r requirements.txt` run in each
`*-service/` folder. Set AWS env vars first (for the Booking Service), then:

```powershell
.\start-all.ps1
```

Each service opens in its own PowerShell window with `--reload`.

| Service | URL | Swagger |
| ------- | --- | ------- |
| Flight | http://localhost:8000 | `/docs` |
| Booking | http://localhost:8001 | `/docs` |
| Baggage | http://localhost:8002 | `/docs` |
| Auth | http://localhost:8003 | `/docs` |

## Step 3 — Run the frontend

The frontend is **not** part of `docker-compose`; run it separately. It proxies
to the services started in Step 2.

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open **http://localhost:5173**. See [`frontend/README.md`](frontend/README.md)
for the full frontend guide.

## Step 4 — Use it

Sign in with a demo account (one-click cards are on the login screen — all use
password `password123`):

| Role | Username | Can do |
| ---- | -------- | ------ |
| Passenger | `passenger1` | View flights/bookings/baggage; create bookings |
| Staff | `staff1` | + cancel bookings, update baggage |
| Admin | `admin1` | Full access + user directory & system admin page |

Then:

- **Dashboard** — KPIs, charts, recent activity, and a live 8-component
  architecture status grid (auto-refreshes every 8s).
- **Flights** — searchable/filterable inventory table.
- **Bookings** — create-booking modal; staff/admin get confirm-to-cancel.
- **Baggage** — tracking table; staff/admin get the update dialog.
- **Admin** (admin only) — system overview, live architecture topology diagram,
  and the user directory from `GET /admin/users`.
- **Profile** — identity and decoded JWT claims from `GET /me`.

A live **session indicator** counts down the 30-minute token; the UI hides every
control the current role isn't permitted to use.

---

## Authentication & RBAC

- `POST /login` (form-encoded) returns a signed **HS256 JWT** (`sub`, `role`,
  `exp`), valid **30 minutes**. The token is sent as `Authorization: Bearer …`.
- Each service **validates the token locally** with the shared secret — no
  round-trip to the Auth Service. A `require_roles()` dependency enforces the
  role matrix per endpoint (`401` if unauthenticated, `403` if the role is not
  permitted).
- **Zero-trust forwarding:** the Booking Service forwards the caller's token to
  the Flight Service for seat decrement/restore, so the Flight Service always
  validates a real, client-issued token.

The full endpoint-by-endpoint access matrix is in
[`Docs/api-specification.md`](Docs/api-specification.md) and `credentials.txt`.

## How the booking flow works end to end

1. `POST /booking` → Booking Service validates `seat_class`.
2. Calls `GET /flight/{id}` (token forwarded) to confirm `available_seats > 0`
   (`409` if full, `404` if unknown).
3. Persists the booking to **Aurora PostgreSQL** with a generated UUID.
4. Calls `PATCH /flight/{id}/seat` to decrement inventory.
5. Publishes a **booking-confirmed** event to **SNS**; **Lambda** consumes it
   asynchronously and dispatches the notification — decoupled from the booking
   response, so a notification failure never affects the booking.
6. Cancellation (`DELETE /booking/{id}`, staff/admin) removes the row and
   best-effort restores the seat via `PATCH /flight/{id}/seat/restore`.

## Security notes

- All secrets come from environment variables; nothing sensitive is hardcoded
  in committed code. `.env` is gitignored.
- The frontend bundle contains **no** AWS/DB credentials — it only holds a JWT
  obtained at login, in `localStorage`, and sends it as a Bearer token.
- Services communicate over the Docker bridge network; the JWT secret is shared
  symmetrically (HS256) for the demo. Production hardening (API Gateway, TLS,
  RS256, Secrets Manager) is documented as out-of-scope in
  [`Docs/project-description.md`](Docs/project-description.md).

## Documentation

- **API reference:** [`Docs/api-specification.md`](Docs/api-specification.md)
- **Project scope & architecture:** [`Docs/project-description.md`](Docs/project-description.md)
- **Frontend guide:** [`frontend/README.md`](frontend/README.md)
- Auto-generated per-service docs: `http://localhost:<port>/docs` (Swagger) and
  `/redoc`.

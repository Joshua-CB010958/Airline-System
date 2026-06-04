# DAMS — Operations Console (Frontend)

A production-quality React + TypeScript frontend for the **Distributed Airline
Management System (DAMS)**. It is built as a distributed-systems *operations
center* — the UI foregrounds architecture visibility, live service-health
monitoring, and RBAC demonstration rather than consumer booking aesthetics.

![stack](https://img.shields.io/badge/React-18-61dafb) ![ts](https://img.shields.io/badge/TypeScript-5.6-3178c6) ![vite](https://img.shields.io/badge/Vite-5-646cff) ![tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

---

## Tech stack

| Concern    | Choice |
|------------|--------|
| Framework  | React 18 + Vite |
| Language   | TypeScript (strict) |
| UI         | Tailwind CSS + shadcn/ui (Radix primitives) + Lucide icons |
| Data       | TanStack Query (server state) + Context API (auth) |
| HTTP       | Axios (per-service instances + interceptors) |
| Charts     | Recharts |
| Routing    | React Router v6 (route guards) |
| Toasts     | Sonner |

## Quick start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The four backend services must be running on their documented ports
(8000/8001/8002/8003). Start them with the repo's `start-all.ps1` or
`docker-compose up`.

### Why it "just works" with no CORS changes

The backend only enables CORS for ports 8000–8003, so a browser app on `:5173`
cannot call the services directly. Instead the frontend calls **same-origin
`/api/*` paths**, and the Vite dev server proxies each prefix to the right
service (see `vite.config.ts`):

| Frontend path   | → Service          | Port |
|-----------------|--------------------|------|
| `/api/auth/*`   | Auth Service       | 8003 |
| `/api/flight/*` | Flight Service     | 8000 |
| `/api/booking/*`| Booking Service    | 8001 |
| `/api/baggage/*`| Baggage Service    | 8002 |

No backend modification is required.

## Demo accounts

| Role      | Username     | Password      |
|-----------|--------------|---------------|
| Passenger | `passenger1` | `password123` |
| Staff     | `staff1`     | `password123` |
| Admin     | `admin1`     | `password123` |

One-click sign-in cards are provided on the login screen.

## Scripts

| Command           | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Start the dev server (with proxy)    |
| `npm run build`   | Type-check + production build        |
| `npm run preview` | Preview the production build         |
| `npm run lint`    | Type-check only (`tsc --noEmit`)     |

## Features

- **JWT auth** — OAuth2 password flow against `POST /login`; token stored in
  `localStorage`, attached via an Axios request interceptor, decoded
  client-side for role-aware UI. A response interceptor force-logs-out on 401.
- **Live session indicator** — countdown to the 30-minute token expiry; the
  client also auto-expires the session when `exp` passes.
- **RBAC everywhere** — `<ProtectedRoute>` guards routes; `<RoleGate>` hides
  unauthorised controls (Cancel Booking, Update Baggage, Admin nav). Mirrors the
  server-side access matrix.
- **Dashboard** — KPIs, seat-class & flight-status charts, recent activity, and
  a live 8-component architecture status grid (4 services probed directly; the
  managed AWS components inferred from their owning service).
- **Flights / Bookings / Baggage** — responsive data tables with search &
  filtering, create-booking modal, confirm-to-cancel, and baggage update dialog.
- **Admin** — system overview, a live **architecture topology diagram**
  (Client → Auth → services → datastores → SNS → Lambda → CloudWatch), and the
  user directory from `GET /admin/users`.
- **States** — loading skeletons, empty states, and retryable error states
  throughout.

## Project structure

```
src/
├── components/
│   ├── ui/            # shadcn/ui primitives
│   ├── common/        # StatCard, StatusBadge, ServiceStatusCard,
│   │                  # ArchitectureGrid, ArchitectureDiagram, states…
│   ├── charts/        # Recharts visualisations
│   ├── layout/        # AppLayout, Sidebar, Topbar, SessionIndicator
│   ├── bookings/      # CreateBookingDialog, CancelBookingButton
│   ├── baggage/       # UpdateBaggageDialog
│   ├── ProtectedRoute.tsx
│   └── RoleGate.tsx
├── context/           # AuthContext (provider)
├── hooks/             # useAuth, useFlights, useBookings, useBaggage, useHealth
├── lib/               # utils, jwt decode
├── pages/             # Login, Dashboard, Flights, Bookings, Baggage,
│                      # Admin, Profile, NotFound
├── services/          # Axios clients + per-service API modules
└── types/             # shared domain types
```

## Configuration

All service base URLs default to the proxy paths and can be overridden via
environment variables (see `.env.example`) if you need to target services on a
different host.

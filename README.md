# PhysioDesk

Physiotherapy Clinic Management System — FastAPI + Next.js, built sprint by sprint.
Sprint 8 adds the **live dashboard & analytics API**, **therapist capacity views**,
**full role-based access control (RBAC)**, **Docker deployment**, and this
documentation.

## Features by Module

| Module | Highlights |
|---|---|
| Auth | JWT access + refresh tokens, ADMIN/STAFF roles, silent client-side refresh |
| Patients | CRUD, search/filter/pagination, profile with session & billing history |
| Schedule | Daily grid (therapists × slots), double-booking prevention (409), reschedule, status lifecycle |
| Therapists | Roster with computed metrics, weekly schedule config, per-date overrides (day off / custom hours) |
| Billing | Auto-numbered invoices (INV-YYYY-XXXX), net amounts, status lifecycle, print sheet, admin-only void |
| **Dashboard (new)** | **Live computed stats, per-therapist capacity breakdowns, recent-patients feed** |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 16 |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Auth | JWT (access + refresh) + RBAC (ADMIN / STAFF) |
| Infra | Docker Compose (db + api + web) |

---

## Quick Start (Docker — recommended)

Prerequisite: Docker + Docker Compose.

```bash
docker compose up --build
```

That single command starts:

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend API (FastAPI) | http://localhost:8000 |
| Swagger UI (OpenAPI docs) | http://localhost:8000/api/v1/docs |
| PostgreSQL 16 | localhost:5434 (`postgres`/`postgres`, db `physiodesk`) |

The backend container waits for Postgres readiness, applies Alembic migrations
(`alembic upgrade head`), seeds demo data (idempotent — it skips if data exists),
and then serves the API.

To wipe the database volume and start fresh:

```bash
docker compose down -v && docker compose up --build
```

---

## Quick Start (Local Development)

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (local install, or `docker run -d --name physiodesk-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=physiodesk -p 5434:5432 postgres:16-alpine`)

> Port **5434** is used on this machine because local PostgreSQL Windows
> services occupy 5432/5433. Adjust `backend/.env` if your setup differs.

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows Git Bash: source .venv/Scripts/activate

pip install -r requirements.txt
cp .env.example .env               # then edit DATABASE_URL if needed

alembic upgrade head               # apply migrations (run from backend/)
python -m app.db.seed              # seed demo data (add --drop to wipe & re-seed)

python run.py                      # uvicorn with auto-reload on :8000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local         # optional; defaults to http://localhost:8000/api/v1
npm run dev                        # http://localhost:3000
```

---

## Test Credentials

Both accounts are created by the seed script (`python -m app.db.seed`).

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@physiodesk.com` | `admin123` |
| **Staff** | `reception@physiodesk.com` | `staff123` |

Login page: http://localhost:3000/login — the login endpoint also accepts the
OAuth2 form format, so Swagger UI's **Authorize** dialog works out of the box.

---

## Live Dashboard & Analytics API

Three new endpoints (all require a Bearer token; both roles may read):

| Endpoint | Returns |
|---|---|
| `GET /api/v1/dashboard/stats` | `DashboardStatsResponse` |
| `GET /api/v1/dashboard/therapist-capacity` | `list[TherapistCapacity]` |
| `GET /api/v1/dashboard/recent-patients?limit=8` | `list[RecentPatientSummary]` |

### Metric definitions (all computed live — nothing hard-coded)

- **patients_seen_today** — distinct patients with a *non-cancelled*
  (Booked or Completed) appointment today.
- **therapists_on_duty_today** — active therapists working today. Override-aware:
  an explicit day-off override removes them; custom-hours overrides put them on
  duty even on a non-working weekday (identical logic to the booking engine via
  `schedule_service.evaluate_availability`).
- **revenue_collected_today** — net amounts (amount − discount) summed over the
  union of: invoices **created today** with status `Paid`, and invoices
  **marked Paid today** (any creation date). Late payments count on the day they
  were collected.
- **open_slots_remaining_today** — OPEN (unbooked) slots left across every
  on-duty therapist, using each therapist's effective window and slot duration.

### Therapist capacity

Per therapist: `total_slots`, `booked_slots`, `free_slots`, `utilization`
(0–1), and a `slots_breakdown` timeline where every slot is
`OPEN | BOOKED | OFF` with the occupying patient's name on booked slots.
Off-duty therapists are included with all-zero counts so the UI can render
them as "off today".

### Recent patients

The last N (default 8, max 50) patients ordered by `updated_at` — edits
(status change, re-assignment, new package) resurface a record, answering
"who did we last touch?" rather than strictly "who is newest?".

---

## Role-Based Access Control

RBAC is enforced **server-side** on every request (`backend/app/api/deps.py`):
`get_current_user` (401 without a valid token) and `get_current_active_admin`
(403 for STAFF on admin-only routes). The frontend mirrors these rules in a
single permission map (`frontend/src/lib/permissions.ts`) that **hides** the
buttons staff cannot use — defense in depth, backend remains the authority.

| Action | ADMIN | STAFF |
|---|:---:|:---:|
| Browse patients / schedule / roster / invoices | ✅ | ✅ |
| Create / edit patients | ✅ | ✅ |
| Book / reschedule / complete / cancel appointments | ✅ | ✅ |
| Create (generate) invoices, mark Due → Paid | ✅ | ✅ |
| Add / edit / delete therapists | ✅ | ❌ 403 |
| Create schedule overrides (day off / custom hours) | ✅ | ❌ 403 |
| Void invoices | ✅ | ❌ 403 |
| Edit invoice payment details (method / discount) | ✅ | ❌ 403 |
| Delete patients | ✅ | ❌ 403 |

Verified with a live smoke test: every STAFF write against
`/api/v1/therapists*` and `DELETE /billing/invoices/{id}` returns **403**;
the same calls with an ADMIN token succeed.

---

## API Surface (OpenAPI)

Interactive docs: **http://localhost:8000/api/v1/docs** (ReDoc:
`/api/v1/redoc`). Every endpoint declares typed Pydantic response models
(`DashboardStatsResponse`, `TherapistCapacity`, `SlotBreakdown`,
`RecentPatientSummary`, `PatientResponse`, `DailyGridResponse`,
`InvoiceResponse`, …), so the schema is fully explorable and client-sdk
generatable.

| Area | Routes |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh` |
| Dashboard | `GET /dashboard/stats`, `GET /dashboard/therapist-capacity`, `GET /dashboard/recent-patients` |
| Patients | `GET/POST /patients`, `GET/PUT/DELETE /patients/{id}` |
| Schedule | `GET /schedule/grid`, `POST/GET /schedule/appointments`, `GET/PUT/PATCH /schedule/appointments/{id}[/reschedule|/status]` |
| Therapists | `GET/POST /therapists`, `GET/PUT/DELETE /therapists/{id}`, `POST/GET /therapists/{id}/overrides` |
| Billing | `GET/POST /billing/invoices`, `GET/PUT/DELETE /billing/invoices/{id}`, `GET /billing/summary` |
| Health | `GET /health` (public) |

---

## Database Schema

Six tables, UUID primary keys, FK constraints, Alembic-migrated:

1. **users** — admin & staff accounts
2. **therapists** — profiles, weekly `working_days` (JSON), hours, slot duration, `is_active`
3. **patients** — records with condition, package, assigned therapist, lifecycle status
4. **therapist_overrides** — per-date exceptions (`is_day_off`, custom hours)
5. **appointments** — bookings linking patients ↔ therapists with status lifecycle
6. **invoices** — billing records with sequential numbers and status lifecycle

Re-seed: `python -m app.db.seed --drop` (drops and recreates everything).

---

## Architecture & Technical Assumptions

- **Layered backend** — `api/` routers (HTTP concerns) → `services/` (business
  rules, conflict detection) → `models/` (ORM). Schemas live in `schemas/`
  (Pydantic v2, `from_attributes` for ORM mapping).
- **Single source of truth for availability** — the dashboard reuses
  `schedule_service.evaluate_availability` so "on duty" means exactly the same
  thing everywhere (standard hours, day-off overrides, custom-hours overrides).
- **Conflict prevention is transactional** — booking/rescheduling re-checks
  overlaps inside the request; the API answers 409 with the conflicting
  appointment's context. The UI pre-checks visually but trusts the backend.
- **Local time = clinic time** — appointment dates/times and "today" are naive
  local dates; the dashboard derives "today" from the database clock
  (`SELECT now()`), falling back to the app server when the DB is empty, so
  stats stay consistent with stored timestamps.
- **Revenue timing** — an invoice counts toward today's collected revenue when
  it was created today and is Paid, or when it was marked Paid today (its
  `updated_at` crossed into today while Paid). This is an event-style
  approximation: a payment recorded at 23:59 yesterday and one at 00:01 today
  land on different days, matching how reception reports collections.
- **Soft delete for invoices** — voiding keeps the row for audit with status
  `Void`; `?purge=true` (admin) hard-deletes.
- **Slot math** — slots are generated from each therapist's effective window
  and `slot_duration_minutes` (30/45/60). Slots partially covered by an
  irregular appointment count as booked (conservative, matches the grid).
- **Frontend** — App Router with a persistent app shell (sidebar + header);
  tokens in `localStorage` with a mirrored `pd_auth` cookie so edge middleware
  can redirect before hydration; `api-client` injects Bearer headers and
  silently refreshes once on 401.
- **Design system** — Fraunces (`font-display`) for headings/stat numbers,
  Inter for body, IBM Plex Mono (`font-mono`) for times/currency/ids; white
  `#FFFFFF` surfaces, `#E4DFD1` borders, soft shadows on `#F6F3EA`.
- **Seed strategy** — the seed script is idempotent and safe to run on every
  boot; `--drop` wipes and re-creates.

---

## Project Structure

```
physiodesk/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (auth, patients, schedule, therapists, billing, dashboard)
│   │   ├── core/           # Config, DB session, security (JWT, hashing)
│   │   ├── db/             # Seed script, Base re-export
│   │   ├── models/         # SQLAlchemy ORM models (6 tables)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (schedule, billing, dashboard, …)
│   │   └── main.py         # FastAPI entry point
│   ├── alembic/            # Migrations
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/            # App Router pages (dashboard, patients, schedule, billing, therapists)
│   │   ├── components/     # UI components (dashboard/, layout/, patients/, …)
│   │   ├── lib/            # Typed API clients, auth context, permission map
│   │   └── middleware.ts   # Cookie-based redirect guards
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Future Improvements / Bonus Features

- **Pagination & virtualization** — server-side pagination for the roster and
  invoice ledger; virtualized tables for large patient lists.
- **Refresh-token rotation & revocation** — store hashed refresh tokens with a
  `jti`, rotate on every use, and detect reuse; add logout-everywhere.
- **PDF exports** — server-rendered invoice PDFs (WeasyPrint / reportlab) and
  printable daily schedule sheets.
- **Email/SMS reminders** — appointment reminders via a background queue
  (e.g. Celery + Redis or a managed provider).
- **Analytics** — revenue trends, no-show rates, therapist utilization over
  time; exportable CSV reports.
- **Multi-tenancy** — per-clinic schema isolation with shared auth.
- **Audit log** — who changed what (invoices, patient records, schedules) with
  an admin review screen.
- **i18n & accessibility** — localized UI strings; full WCAG 2.1 AA audit.
- **Testing** — pytest suite (API + service layers) and Playwright E2E flows;
  CI via GitHub Actions.
- **Observability** — structured logging, request IDs, Sentry integration.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows "Could not load…" banners | Backend not running (or wrong `NEXT_PUBLIC_API_URL`). Check http://localhost:8000/health |
| `401` loops to login | Access token expired — the client auto-refreshes once; if the refresh token also expired, sign in again |
| Port 8000/3000/5434 busy | Stop the conflicting service or change the port mapping in `docker-compose.yml` / dev commands |
| Stale data after re-seeding | Hard-refresh the browser (Ctrl+Shift+R); the dashboard fetches fresh values on mount |

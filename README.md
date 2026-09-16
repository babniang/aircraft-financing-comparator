# Aircraft Financing Structure Comparator

Given an aircraft type, delivery price, and a couple of market assumptions,
returns the **implied all-in annual financing cost** of three structures a
debt-structuring desk actually originates, **ECA-backed secured debt**, a
**sustainability-linked loan (SLL)**, and a **sale-and-leaseback (SLB)**, plus
balance-sheet impact and an optional GTF engine-risk adjustment, on one
mobile screen.

```
frontend/   Next.js (App Router), mobile-first, static build   -> Vercel
backend/    FastAPI, stateless, the single source of financial truth -> Railway
docs/       methodology.md, every assumption, sourced
```

The frontend never recomputes financial logic. All IRR / cash-flow math lives
in `backend/financial_model.py`, is unit-tested, and is the only implementation.

The same model also exports a **fully formatted Excel workbook** (Summary,
Assumptions, an amortisation schedule per structure, and a Comparison tab with a
chart). It is built with live formulas (`PMT`, `IRR`, `NPV`, cross-sheet
references), so every input stays editable in Excel, and each tab carries the
Python model's number next to the Excel formula as a cross-check. Get it from
the "Download Excel model" button in the app, from `POST /api/export.xlsx`, or
from the CLI:

```bash
cd backend
.venv/bin/python generate_model.py --aircraft a320neo --tenor 12 --live-sofr
.venv/bin/python generate_model.py --delivery 45 --market-value 48 --tenor 12 --gtf --out model.xlsx
```

---

## Data integrity: what's live, what's a sourced assumption

**Genuinely live** (into the model when "Use live SOFR" is on):
SOFR (NY Fed), €STR (ECB Data Portal), AF.PA share price + EUR/USD (Yahoo
public feed, *unofficial*, labelled as such in the UI and here).

**Sourced, editable, labelled as assumptions, not live:**
ECA guarantee fee %, SLL margin + KPI ratchet, SLB lease rate factor + residual,
GTF margin add-on / value haircut. Defaults in `financial_model.DEFAULTS`,
citations in [`docs/methodology.md`](docs/methodology.md).

**Deliberately not faked:** real-time airline credit spreads, bank cost of
funds, actual ECA fee schedules, live margin quotes. These are not public data;
the tool models the mechanics correctly with illustrative assumptions rather
than manufacture false precision. See methodology §4.

---

## Backend: local

```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q                     # 21 tests
ALLOWED_ORIGIN=http://localhost:3000 \
  .venv/bin/python -m uvicorn main:app --reload --port 8000
```

`requirements.txt` is the runtime set; `requirements-dev.txt` adds `pytest` and
`formulas` (the latter recalculates the exported workbook in a test to prove the
Excel IRR matches the Python model).

| Route | |
|---|---|
| `GET /health` | `{"status":"ok"}`, Railway healthcheck / wake ping |
| `GET /api/reference` | aircraft reference table for prefilling inputs |
| `GET /api/market-context` | live SOFR / €STR / AF.PA / EUR/USD, with `stale` flag |
| `POST /api/compare` | the three structures + `cheapest`; see `schemas.py` |
| `POST /api/export.xlsx` | the formula-driven Excel workbook for the same inputs |

### Deploy to Railway

The service builds from `backend/Dockerfile` (pinned Python, explicit
dependency install, `CMD ["python", "main.py"]`), which removes the Nixpacks
autodetection that previously produced 502s.

1. New Project -> Deploy from GitHub repo.
2. **Settings -> Source -> Root Directory = `backend`.** Without this Railway
   builds from the repo root, finds nothing, and the domain 502s.
3. Builder is set to Dockerfile in `railway.json`. Leave the UI's Build and
   Start Command fields **empty**: a start command typed into the dashboard
   overrides both `railway.json` and the image's `CMD`.
4. Env vars: none are required. Optionally set `ALLOWED_ORIGIN` (comma
   separated) to restrict CORS, and `ALLOWED_ORIGIN_REGEX` for Vercel preview
   domains. With `ALLOWED_ORIGIN` unset the API allows any origin, which is
   safe here because it is public, read-only and sends no credentials.
5. Check the deploy log for `[startup] binding 0.0.0.0:<port>`, then
   `curl https://<domain>/` and `curl https://<domain>/health`.

**Why a 502 happens:** Railway's edge is reaching a container that is not
listening on the injected `$PORT`. `main.py` reads `PORT` in Python rather than
relying on the shell expanding `$PORT` in a start command, so the usual cause is
either a stale dashboard start command or the Root Directory not being
`backend`.

---

## Frontend: local

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8000' > .env.local
npm run dev
```

Any browser-visible env var **must** be `NEXT_PUBLIC_`-prefixed.

### Deploy to Vercel

1. Import the repo. **Root Directory = `frontend`.**
2. Framework preset: Next.js (auto).
3. Env var `NEXT_PUBLIC_API_BASE_URL` = the Railway origin, with **no** `/api`
   suffix and no trailing slash, e.g. `https://your-app.up.railway.app`. The
   client already prefixes each call with `/api/...`. Set it for Production
   **and** Preview.
4. **Redeploy after setting it.** Next inlines `NEXT_PUBLIC_*` at build time, so
   a value added after a build has no effect until the project is rebuilt. If
   it is missing the deployed page shows a banner saying so rather than sitting
   on "loading" forever.
5. Test end-to-end on a real phone, not just devtools emulation.

---

## Build order followed

1. `financial_model.py` + tests, three IRR calculations correct in isolation.
2. FastAPI wrapper + `market_data.py` (live layer with TTL cache + graceful
   degradation).
3. Next.js mobile-first UI against the real API.
4. `docs/methodology.md`.

Not a valuation. Not investment advice.

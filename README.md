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

1. New Project → Deploy from GitHub repo. If monorepo, set **Root Directory**
   to `/backend`.
2. Nixpacks auto-detects Python. Start command (also in `railway.json`):
   `uvicorn main:app --host 0.0.0.0 --port $PORT`, Railway injects `$PORT`.
3. Env vars:
   - `ALLOWED_ORIGIN` = your Vercel production URL (comma-separate for several).
   - `ALLOWED_ORIGIN_REGEX` (optional) = regex for Vercel preview domains, e.g.
     `https://.*-yourteam\.vercel\.app`, enables PR previews against this backend.
4. Confirm `GET /health` returns 200; copy the `*.up.railway.app` URL.
5. Cold-start: on the hobby tier the service sleeps after inactivity. Either
   ping `/health` every ~10 min from an external uptime monitor, or rely on the
   frontend's "Model is waking up…" state (it already handles this).

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

1. Import the repo. If monorepo, set **Root Directory** to `/frontend`.
2. Framework preset: Next.js (auto).
3. Env var `NEXT_PUBLIC_API_BASE_URL` = Railway URL, for Production **and**
   Preview.
4. Deploy → take the production URL → set it as `ALLOWED_ORIGIN` on Railway →
   redeploy backend so CORS allows it.
5. Test end-to-end on an actual phone (native `<select>` and 44px touch
   targets don't fully reproduce in desktop devtools emulation).

---

## Build order followed

1. `financial_model.py` + tests, three IRR calculations correct in isolation.
2. FastAPI wrapper + `market_data.py` (live layer with TTL cache + graceful
   degradation).
3. Next.js mobile-first UI against the real API.
4. `docs/methodology.md`.

Not a valuation. Not investment advice.

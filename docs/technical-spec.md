# Aircraft Financing Structure Comparator — Technical Spec
*Build-ready spec. Backend: FastAPI on Railway. Frontend: Next.js on Vercel. Mobile-first.*

---

## 1. One-line product definition

Given an aircraft type, delivery price, and a couple of market assumptions, return the **implied all-in annual financing cost** of three real structures a debt-structuring desk actually originates — **ECA-backed secured debt, a sustainability-linked loan (SLL), and a sale-and-leaseback (SLB)** — plus balance-sheet impact and (optionally) a GTF engine-risk adjustment, on one mobile screen.

---

## 2. Architecture overview

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│   Frontend (Vercel)  │ ───────────────────────▶ │   Backend (Railway)   │
│   Next.js, mobile-   │ ◀─────────────────────── │   FastAPI, stateless  │
│   first, static build│        POST /api/compare │   financial model     │
└─────────────────────┘        GET  /api/reference└──────────────────────┘
```

- **Stateless, no database.** All reference data (aircraft base prices, market values, lease rate ranges) ships as a versioned JSON config file in the backend repo. No persistence layer needed — keeps Railway deployment trivial and avoids DB cost/latency.
- **Backend is the single source of financial truth.** All IRR/cash-flow math lives in Python on Railway. The frontend never recomputes financial logic — it only renders whatever the API returns. This matters for correctness (one implementation to test, not two) and for your story to the reader ("the real model is Python, tested, in the repo").
- **CORS**: backend explicitly allows only the Vercel production + preview origins.

---

## 3. Backend (Railway) — FastAPI

### 3.1 Repo layout
```
/backend
  main.py                 # FastAPI app, routes, CORS
  financial_model.py       # pure functions, no framework deps — unit-testable in isolation
  reference_data.json      # aircraft type -> base price, market value, lease rate range
  schemas.py                # Pydantic request/response models
  requirements.txt
  railway.json              # or nixpacks.toml — build/start config
  Dockerfile                 # optional but recommended for reproducibility
  tests/
    test_financial_model.py
```

### 3.2 Endpoints

**`GET /health`**
Returns `{"status": "ok"}`. Railway/you use this to confirm the deploy is alive; also useful as a "wake up" ping if you're on a plan that idles.

**`GET /api/reference`**
Returns the preloaded aircraft reference table so the frontend can prefill inputs.
```json
{
  "aircraft": [
    {
      "id": "a320neo",
      "label": "Airbus A320neo",
      "typical_delivery_price_usd_m": 55,
      "typical_market_value_usd_m": 60,
      "typical_lease_rate_factor_pct": 0.75,
      "gtf_exposed": false
    },
    {
      "id": "a220-300",
      "label": "Airbus A220-300",
      "typical_delivery_price_usd_m": 45,
      "typical_market_value_usd_m": 48,
      "typical_lease_rate_factor_pct": 0.80,
      "gtf_exposed": true
    }
    // ... a321neo, a350-900, 787-9, 737-max8
  ],
  "version": "2026-09",
  "sources_note": "Indicative figures derived from IBA/Cirium published rate ranges and OEM list-price/discount commentary; see /docs/methodology.md for citations. Not a valuation."
}
```

**`POST /api/compare`**
Request:
```json
{
  "aircraft_id": "a220-300",
  "delivery_price_usd_m": 45,
  "market_value_usd_m": 48,
  "tenor_years": 12,
  "gtf_adjustment": true,
  "assumptions": {
    "eca_ltv_pct": 0.85,
    "eca_base_margin_bps": 90,
    "eca_guarantee_fee_pct": 4.5,
    "sll_ltv_pct": 0.80,
    "sll_base_margin_bps": 140,
    "sll_kpi_ratchet_bps": 10,
    "slb_lease_rate_factor_pct": 0.80,
    "reference_rate_pct": 3.8,
    "gtf_margin_addon_bps": 35,
    "gtf_value_haircut_pct": 8.0
  }
}
```
All fields in `assumptions` are optional — omitted ones fall back to defaults documented in `financial_model.py`. This lets the frontend send only what the user actually changed.

Response:
```json
{
  "aircraft_id": "a220-300",
  "gtf_adjustment_applied": true,
  "results": [
    {
      "structure": "eca_debt",
      "label": "ECA-Backed Term Loan",
      "implied_annual_cost_pct": 5.4,
      "financed_pct_of_price": 85.0,
      "balance_sheet": "on",
      "headline_note": "Guarantee fee amortized over tenor; lowest margin but requires ECA eligibility.",
      "cashflow_schedule": [ { "year": 0, "amount_usd_m": 38.25 }, { "year": 1, "amount_usd_m": -4.9 }, "..." ]
    },
    {
      "structure": "sll",
      "label": "Sustainability-Linked Loan",
      "implied_annual_cost_pct": 6.1,
      "financed_pct_of_price": 80.0,
      "balance_sheet": "on",
      "headline_note": "No ECA fee, but higher base margin; cost flexes ±10bps on KPI performance.",
      "cashflow_schedule": [ "..." ]
    },
    {
      "structure": "slb",
      "label": "Sale-and-Leaseback",
      "implied_annual_cost_pct": 7.2,
      "financed_pct_of_price": 100.0,
      "balance_sheet": "off",
      "headline_note": "100% financed, plus a one-off accounting gain — but highest ongoing cost.",
      "one_off_gain_usd_m": 2.6,
      "cashflow_schedule": [ "..." ]
    }
  ],
  "cheapest": "eca_debt"
}
```

### 3.3 Financial model logic (`financial_model.py`)

Implement as pure functions, each returning a list of `(year, cashflow)` tuples, then a shared `implied_annual_cost(cashflows) -> float` using **IRR/XIRR** on the *incremental* cash flows relative to paying the full delivery price in cash at t=0. This is what makes the three structures genuinely comparable despite financing different percentages of the aircraft.

**ECA-backed debt**
- `loan_amount = delivery_price * eca_ltv_pct`
- t0 cashflow: `+loan_amount` (cash the airline didn't have to pay itself)
- Annual debt service: amortizing loan at `reference_rate + eca_base_margin_bps`, plus the ECA guarantee fee (`eca_guarantee_fee_pct` of loan amount, upfront, amortized straight-line over tenor for the purposes of the annual cost figure — flag this simplification in code comments)
- If `gtf_adjustment`: add `gtf_margin_addon_bps` to the margin before computing debt service
- `implied_annual_cost_pct = IRR(t0: +loan_amount, t1..N: -debt_service)`

**Sustainability-linked loan**
- Same structure as ECA debt but: `loan_amount = delivery_price * sll_ltv_pct`, margin = `reference_rate + sll_base_margin_bps`, no guarantee fee, apply `± sll_kpi_ratchet_bps` as a simple base-case (assume KPI met, i.e. the favorable ratchet, and note in `headline_note` that missing the KPI adds `2 × ratchet` back)
- Same GTF margin add-on logic if applicable

**Sale-and-leaseback**
- `sale_price = market_value_usd_m`, reduced by `gtf_value_haircut_pct` if `gtf_adjustment` is true
- t0 cashflow: `+sale_price`
- Annual lease rental: `sale_price * slb_lease_rate_factor_pct` (flat annuity simplification — note in comments that a real deal would step down; fine for v1)
- `one_off_gain = sale_price - delivery_price` (can be negative — display as-is, don't clip to zero, that's a real and informative case)
- `implied_annual_cost_pct = IRR(t0: +sale_price, t1..N: -lease_rental)`

**IRR helper**: use `numpy_financial.irr` or a small Newton's-method XIRR implementation — do not add a heavy dependency for this alone.

### 3.4 Deployment to Railway
1. Push `/backend` as (or as a subdirectory of) the GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**. If backend lives in a subfolder of a monorepo, set **Root Directory** to `/backend` in the service settings.
3. Railway auto-detects Python via Nixpacks; confirm/override:
   - **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Railway injects `PORT` automatically — do not hardcode a port in `main.py`.
4. Set environment variable `ALLOWED_ORIGIN` to your Vercel production URL (and add preview-URL wildcard handling if you want PR previews to work — see CORS note below).
5. Confirm `GET /health` returns 200 after deploy; copy the generated Railway public URL (e.g. `https://your-app.up.railway.app`) — this is what the frontend points at.
6. **Cold-start note**: on Railway's free/hobby tier the service may sleep after inactivity, causing a multi-second delay on the first request after idle. Mitigate with (a) a lightweight external cron/uptime ping to `/health` every ~10 min, or (b) simply show a "waking up the model…" loading state on the frontend rather than a blank spinner — see §4.4.

### 3.5 CORS (in `main.py`)
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```
If you want Vercel preview deployments (branch/PR URLs) to also work against the same backend, allow a regex match on your Vercel project's preview domain pattern rather than a single fixed origin.

### 3.6 Testing
- `tests/test_financial_model.py`: unit-test each structure's cashflow generator against a hand-calculated example (e.g. confirm ECA debt IRR ≈ `reference_rate + margin` when the guarantee fee is set to zero, as a sanity check the amortization math is right).
- One integration test hitting `/api/compare` with a fixed payload and asserting the response shape and that `cheapest` matches the lowest `implied_annual_cost_pct`.

---

## 3.7 Live market data layer — what makes this not a toy

This is the detail that separates "vibe-coded demo" from "something a desk could plausibly open." The principle: **use genuinely official, free, live sources for what they actually cover (reference rates, FX, equity price) — and clearly label everything else as a sourced, editable assumption rather than pretend it's live.** A real debt-structuring reader will notice the difference immediately, and getting this honest is worth more than getting it flashy.

**Sources used, and why each is legitimate:**

| Data point | Source | Endpoint / access | Why this source specifically |
|---|---|---|---|
| **SOFR** (USD reference rate) | Federal Reserve Bank of New York | `GET https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv?startDate=MM/DD/YYYY&endDate=MM/DD/YYYY` — free, no key, official primary source, published ~08:00 ET daily | Most aircraft debt (ECA-backed loans, EETCs) is **USD-denominated regardless of the airline's domicile**, since OEM list prices are set in USD. SOFR is the realistic live base rate for this tool, not a generic macro placeholder — this is an aviation-finance-specific choice, and worth saying so in the UI copy. |
| **€STR / EURIBOR** (EUR reference rate) | European Central Bank, Statistical Data Warehouse | `GET https://sdw-wsrest.ecb.europa.eu/service/data/{dataflow}/{seriesKey}` — free, no key, official. Confirm the exact series key (e.g. the €STR dataflow) on the SDW site before hardcoding it — series codes are numerous and worth verifying directly rather than guessing. | Needed if you add a EUR-tranche comparison (relevant since AFKLM itself issues EUR-denominated bonds, e.g. its Jan 2026 EMTN). Shown as a secondary rate, not the primary one. |
| **AF.PA share price** | Yahoo Finance, via `yfinance` | Python `yfinance` library | Honest caveat to state in the repo: this is an **unofficial** wrapper around Yahoo's public site data, not a documented Yahoo API — fine for a context/display strip, not something to depend on for anything the model's core numbers rely on. |
| **EURUSD** | Yahoo Finance, via `yfinance` (`EURUSD=X`) | same library | Surfaces the currency mismatch real aircraft financings have to manage (USD-priced asset, frequently EUR-functional-currency lessee) — a small detail that reads as genuine understanding rather than decoration. |

**What is deliberately *not* live, and is labeled as such in the UI:** ECA guarantee fee percentage, SLL margin ratchet size, SLB lease rate factor, the GTF margin add-on/value haircut. These are **sourced desk assumptions** (cited back to your research doc), editable by the user, and explicitly marked "assumption, not live data" in the UI — see §4.2. Blending these silently into the same visual treatment as the live SOFR/FX numbers would be the actual toy-project mistake; keeping the distinction visible is what makes it credible.

**New backend module: `market_data.py`**
- `fetch_sofr() -> float`: pulls latest published SOFR from the NY Fed endpoint.
- `fetch_ecb_rate(series_key: str) -> float`: pulls latest €STR/EURIBOR observation from ECB SDW.
- `fetch_af_price() -> dict`: latest AF.PA price + timestamp via `yfinance`.
- `fetch_eurusd() -> float`: latest EURUSD via `yfinance`.
- **In-memory cache with a TTL (e.g. 15–30 minutes)**, keyed by source, storing `(value, fetched_at)`. Real desk tools don't hammer upstream sources on every page load; caching responsibly is itself a signal of production-mindedness, not just a performance optimization. On Railway this can be a simple module-level dict — no Redis needed at this scale.
- **Graceful degradation**: if a live fetch fails or times out, serve the last cached value with its `fetched_at` timestamp rather than erroring the whole `/api/compare` call — a stale-but-labeled rate is far better UX (and more realistic desk behavior) than a broken page.

**New endpoint: `GET /api/market-context`**
```json
{
  "sofr_pct": 3.62,
  "sofr_as_of": "2026-09-05",
  "eur_str_pct": 2.15,
  "eur_str_as_of": "2026-09-04",
  "af_pa_price_eur": 8.14,
  "af_pa_as_of": "2026-09-07T14:32:00Z",
  "eurusd": 1.087,
  "eurusd_as_of": "2026-09-07T14:30:00Z",
  "stale": false
}
```
`/api/compare` accepts an optional `use_live_sofr: true` flag — when set, it substitutes the cached live SOFR for `assumptions.reference_rate_pct` server-side before running the model, so "live data" actually flows into the numbers rather than sitting decoratively next to them.

---

## 4. Frontend (Vercel) — Next.js, mobile-first

### 4.1 Repo layout
```
/frontend
  app/
    page.tsx                # single page — no routing needed for v1
    layout.tsx
    components/
      InputPanel.tsx
      ResultCard.tsx
      MethodologyAccordion.tsx
      LoadingState.tsx
  lib/
    api.ts                   # fetch wrapper for the Railway backend
  styles/
    globals.css              # Tailwind
  .env.local.example          # NEXT_PUBLIC_API_BASE_URL=
  next.config.js
  tailwind.config.ts
```

### 4.2 Layout rules (mobile is the primary target, not a breakpoint afterthought)
- **Single column, stacked vertically.** Order: title → 5 inputs → "Compare" button → 3 result cards (stacked, cheapest visually flagged) → collapsed "Methodology & assumptions" accordion at the bottom.
- **No side-by-side panels below `md` breakpoint.** Tailwind: default (mobile) = `flex-col`; from `md:` up, allow the 3 result cards to go `md:flex-row`.
- **Inputs**: aircraft type as a large tap-friendly `<select>` (native mobile select, not a custom dropdown component — native selects have far better mobile UX/accessibility than custom ones), tenor and GTF toggle as a simple switch. Numeric inputs (delivery price, market value) as `<input type="number" inputMode="decimal">` with sensible min/max/step so the mobile numeric keypad shows automatically.
- **Minimum touch target 44×44px** on every interactive element (button, toggle, select) — set explicitly in Tailwind (`min-h-11 min-w-11` or equivalent) rather than assuming default sizing is sufficient.
- **Result cards**: each shows, in this visual priority order — (1) large headline `implied_annual_cost_pct`, (2) structure label as a smaller subtitle, (3) one-line `headline_note`, (4) small badges for `on/off balance sheet` and `% financed`. Full `cashflow_schedule` is available but **not shown by default** — put it behind a "View cash flow" tap-to-expand within the card, not a hover tooltip.
- **No hover-dependent UI anywhere** — this is a touch-first product; anything shown on `:hover` on desktop must have an equivalent tap/expand affordance on mobile.
- **Debounce, don't recompute per keystroke.** Wire the "Compare" button as an explicit action (or debounce free-text number inputs by ~400ms) rather than firing an API call on every keystroke — kinder to mobile networks and avoids visible input lag from the Railway round-trip.
- **Market context strip** — a thin, single-line bar at the very top, above the inputs: *"SOFR 3.62% (as of 05 Sep) · AF.PA €8.14 · EUR/USD 1.087"*, sourced from `/api/market-context`, refreshed on page load. Small, greyed, non-interactive on first glance — its job is to silently signal "this pulls real data" before the user even touches an input. Include a small "Use live SOFR" toggle near the reference-rate assumption specifically (default **on**), clearly distinct in styling from the editable desk-assumption fields below it — live data and sourced assumptions should never look visually identical, per §3.7.

### 4.3 Data flow
1. On page load, `GET /api/reference` to populate the aircraft dropdown and prefill numeric fields with that type's typical values, **and** `GET /api/market-context` (in parallel) to populate the market context strip and the live-SOFR toggle's initial value.
2. User adjusts inputs (or accepts prefilled defaults) and taps **Compare**.
3. `POST /api/compare` with the current form state, including `use_live_sofr` reflecting the toggle's current position.
4. Render the 3 result cards from the response; highlight `cheapest`.
5. Toggling "GTF-exposed engine" re-fires the same request with `gtf_adjustment` flipped — this is the single most important interaction to make feel instant, since it's the "aha" moment tying back to the engine-risk research.

### 4.4 Loading & error states
- Show a lightweight skeleton (three greyed-out card outlines), not a spinner, while awaiting the first response — this reads as "the tool is real" rather than "something is broken," which matters if Railway cold-starts add a few seconds.
- On fetch failure or timeout (>8s), show a plain-language inline message ("Model is waking up — tap Compare again in a few seconds") rather than a raw error, and offer a retry button.

### 4.5 Environment variables
`.env.local` (not committed):
```
NEXT_PUBLIC_API_BASE_URL=https://your-app.up.railway.app
```
`lib/api.ts` reads `process.env.NEXT_PUBLIC_API_BASE_URL` for every call. Any variable the *browser* needs at runtime in Next.js must be prefixed `NEXT_PUBLIC_` — non-prefixed env vars are server-only and won't reach client-side fetch calls, which matters since this is a fully client-rendered comparator.

### 4.6 Deployment to Vercel
1. **Import the GitHub repo** in Vercel. If it's a monorepo, set **Root Directory** to `/frontend` in the project settings.
2. Framework preset: Next.js (auto-detected).
3. Add environment variable `NEXT_PUBLIC_API_BASE_URL` = your Railway public URL, in **Project Settings → Environment Variables**, for both Production and Preview environments.
4. Deploy. Vercel gives you a production URL — set that as `ALLOWED_ORIGIN` back on the Railway backend (§3.4 step 4) and redeploy the backend so CORS allows it.
5. Test end-to-end **on an actual phone**, not just a resized desktop browser window — Chrome DevTools device emulation is a reasonable first pass but does not catch real touch-target sizing or native-select behavior issues.

---

## 5. What ships where (recap)

| Artifact | Contains | Audience |
|---|---|---|
| **Deployed Vercel URL** | The mobile-first comparator — the 90-second phone glance | Send this link directly |
| **Railway backend** | The real, tested financial model (FastAPI) | Powers the tool; link from repo README |
| **GitHub repo (both `/backend` and `/frontend`, plus `/docs`)** | Full source, tests, and a `/docs/methodology.md` with the GTF engine-risk research and every assumption's citation | One tap away from the deployed tool, for when he wants to go deeper |

---

## 6. Data integrity — what's live, what's a sourced assumption, and why the rest isn't faked

This is worth stating explicitly in the repo README, not just implementing quietly, because it's the difference between "looks impressive at a glance" and "survives someone who actually works in this desk asking follow-up questions":

- **Genuinely live**: SOFR (NY Fed), €STR/EURIBOR (ECB SDW), AF.PA share price and EURUSD (Yahoo, unofficial feed — labeled as such). These flow into the model when the "use live SOFR" toggle is on.
- **Sourced, editable, clearly labeled as assumptions, not live**: ECA guarantee fee %, SLL margin ratchet size, SLB lease rate factor, GTF margin add-on / value haircut. Each ships with a default derived from your research (IBA rate ranges, RTX compensation disclosures, OECD-style ECA fee conventions) and a visible citation in the methodology accordion — but is never presented as real-time.
- **Deliberately excluded, and why**: real-time AFKLM credit spreads, SG's actual cost of funds, actual ECA guarantee fee schedules, and real bank margin quotes are not public data. A tool that fabricated live-looking numbers for these would look sophisticated for about ten seconds to someone outside the industry and would actively damage credibility with someone inside it — the honest move is to model the *mechanics* correctly with clearly-sourced illustrative assumptions, not to manufacture false precision. State this boundary explicitly in the README; it reads as judgment, not as a limitation.

---

## 7. Reusability & institution theming — build once, retarget cleanly

The financial model, live data layer, and UX are institution-agnostic by design — nothing about ECA-backed debt, SLL, or SLB mechanics is SG-specific. The only things that should ever be bank-specific are the methodology doc's cited precedent deals (e.g. SG's Air France A350 SLL) and the outreach copy around it. Architect the frontend so re-targeting the tool at a different desk (Natixis, Crédit Agricole CIB, a Luxembourg-domiciled leasing/ABS platform, etc.) is a config change, not a rebuild:

- **Theme as a single config object / CSS-variable set** (`theme.ts` or `:root` CSS variables): primary color, accent color, institution name string, and an optional logo slot — never hardcode a color value inline in a component.
- **Default palette: deliberately neutral, not any bank's brand colors.** Dark navy/charcoal base (`--color-bg-primary`, `--color-text`) with one restrained accent (`--color-accent`) for the "cheapest structure" highlight and the live-data strip. Avoid anything close to a specific bank's actual brand red/blue/purple — the goal is "obviously professional finance tool," not "obviously trying to look like I work here already."
- **Why neutral-by-default is the better call, not just the safer one:** using an unauthorized bank's brand identity in unsolicited outreach risks reading as presumptuous rather than tailored, and it undercuts the tool's core credibility story — that this is a genuine, reusable piece of engineering, not a one-recipient flattery exercise. A neutral build is what you'd point to if this ever comes up with a *different* desk later.
- If you want a light touch of personalization for a specific send, keep it to text only — e.g. a one-line footer or methodology-doc note ("Built with reference to [Bank]'s [specific real deal]") — rather than visual branding.
- Optional: keep a `themes/` folder with 2–3 named neutral presets (e.g. `slate`, `midnight`, `graphite`) so you can vary the look slightly between sends without ever touching brand colors, and swap via a single import in `layout.tsx`.

---

## 8. Build order (suggested)

1. `financial_model.py` + unit tests — get the three IRR calculations correct and verified in isolation before touching any web framework.
2. Minimal FastAPI wrapper (`/health`, `/api/reference`, `/api/compare`) — deploy to Railway early, even with dummy data, to de-risk the deployment step before investing in frontend polish.
3. Next.js skeleton with hardcoded mock response — get the mobile layout and card design right against fake data.
4. Wire the real API call, remove the mock.
5. Deploy frontend to Vercel, connect env vars both directions, test on phone.
6. Only then: polish `headline_note` copy, add the methodology accordion content, and write `/docs/methodology.md` referencing your GTF and SLB research.

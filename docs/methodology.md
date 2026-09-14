# Methodology & assumptions

This document backs every number the comparator produces: what is genuinely
live, what is a sourced desk assumption, and what is deliberately not modelled.

---

## 1. The comparison metric

Each structure is expressed as a stream of annual cash flows that are
**incremental relative to a common baseline: paying the full delivery price in
cash at year 0.** Under that baseline the only cash flow is `−delivery_price` at
t0. The incremental series for each structure is therefore:

| Structure | Year 0 | Years 1…N | Final-year extra |
|---|---|---|---|
| ECA-backed debt | `+loan` (LTV × price) | `−(debt service + amortised guarantee fee)` | n/a |
| Sustainability-linked loan | `+loan` (LTV × price) | `−debt service` | n/a |
| JOLCO (Japanese tax lease) | `+advance` (LTV × price) | `−rental` to the call year | `−call price` (outstanding balance) |
| Sale-and-leaseback | `+sale price` | `−lease rental` | `−residual value forgone` |

`implied_annual_cost_pct` is the **IRR of that incremental series**. Because the
baseline is identical for all four, the IRRs are directly comparable even
though the structures finance different fractions of the aircraft.

IRR is solved with a hand-rolled Newton's method + bisection fallback
(`financial_model.irr`), the series are annual and single-sign-change, so a
full numerical stack (`numpy_financial`) is unnecessary weight for a stateless
service.

### Why the SLB carries a residual-value term

Under the cash baseline, and under the two financed-purchase structures, the
airline still **owns** the aircraft at year N. Under an operating
sale-and-leaseback it hands the metal back and owns nothing. Modelling only the
rentals (as a naive reading of the spec would) makes the SLB look
~4 percentage points cheaper than it is. The model adds a year-N outflow equal
to the residual value the lessee forgoes.

Default residual = `delivery_price × max(0.15, 1 − 0.045 × tenor_years)`
(≈ 46% of new price at a 12-year tenor, a crude age-based retention curve).
Override with `slb_residual_value_pct` (percent of delivery price). A fuller
model would use a published residual-value curve by type.

### How the JOLCO is modelled

A Japanese Operating Lease with Call Option. A Japanese SPC, funded by Japanese
tax equity plus arranger senior debt, buys the aircraft and leases it to the
airline. The equity investors monetise accelerated tax depreciation and rebate
part of that benefit into the rentals, so the all-in cost prices **through**
plain senior debt. The airline holds a purchase option it almost always
exercises, at `jolco_call_year`, paying the then-outstanding balance and keeping
the aircraft.

Modelled as a senior amortisation at a **tax-adjusted effective rate**:

```
gross_rate     = reference_rate + jolco_base_margin_bps (+ GTF add-on)
effective_rate = gross_rate − jolco_tax_benefit_bps
```

The airline pays level rentals to the call year, then settles the outstanding
balance as the call price. The implied annual cost therefore equals the
effective rate; the call year drives the **shape** of the cash flows (a lump at
year N), not the headline number. It is a finance lease under IFRS 16 (the call
is reasonably certain), so it is shown **on** balance sheet.

Not modelled: the JPY/USD basis swap, arrangement and equity-arrangement fees,
and prepayment lock-outs, all flagged in the UI note. Defaults: `jolco_ltv_pct`
0.80, `jolco_base_margin_bps` 120, `jolco_tax_benefit_bps` 75 (realistic band
50–150), `jolco_call_year` 10.

### Credit metrics

Each structure also reports the metrics a credit committee paper leads with.
They are **aircraft-level proxies**: the tool has no airline financials, so
there is no true DSCR/LLCR off an EBITDAR.

| Metric | Definition here |
|---|---|
| Initial LTV | financed amount ÷ current market value at close |
| LTV at mid-life | outstanding balance at `tenor/2` ÷ market value × `_retention(tenor/2)` |
| Asset DSCR | airframe lease-earning power (`market_value × LRF% × 12`) ÷ annual financing outflow |
| WAL | weighted average life of the principal repayments (years) |
| Balloon | share of the financed amount still due as a lump at maturity or the JOLCO call |

The SLB has no debt balance to run down, so its mid-life LTV and balloon are
n/a; its asset DSCR sits near 1.0x by construction (rent = value × LRF), which
is the point, an SLB gives the airline no coverage cushion, whereas a debt
structure sized at ~80% LTV does.

### What the GTF adjustment reflects

GTF is the Pratt & Whitney Geared Turbofan family (PW1000G): the PW1100G on much
of the A320neo family, the PW1500G on the A220, and the PW1900G on the Embraer
E2. In July 2023 RTX / Pratt & Whitney disclosed a **powder-metal
manufacturing defect**: contamination in the powdered nickel alloy used to forge
high-pressure turbine and compressor discs can seed microscopic cracks, so the
affected discs have a shorter safe life and must be inspected far earlier than
planned.

The consequences that matter for a financing:

- **An accelerated removal campaign into 2026.** Hundreds of engines pulled for
  ahead-of-schedule shop visits; a rolling fleet of roughly 250 to 350
  GTF-powered aircraft on the ground at any point through 2024 to 2025.
- **Longer shop visits.** Turnaround times stretched past 250 to 300 days
  against a normal 60 to 90, because of parts and slot scarcity.
- **Multi-billion-dollar charges.** RTX booked a charge on the order of
  US$3 billion (2023) to compensate operators for the disruption.

So GTF-powered metal carries lower dispatch availability, higher maintenance
reserve requirements, and a softer secondary-market bid. The model prices this
as `gtf_margin_addon_bps` on the debt structures and `gtf_value_haircut_pct` on
the sale price and residual value in the sale-and-leaseback. Both are sourced
desk assumptions, editable, not live.

---

## 2. Genuinely live data

| Data point | Source | Access | Notes |
|---|---|---|---|
| **SOFR** | Federal Reserve Bank of New York | `markets.newyorkfed.org/api/rates/secured/sofr/search.csv`, free, no key, official primary source | The realistic USD base rate for aircraft debt: OEM list prices are USD-denominated, so most aircraft debt (ECA loans, EETCs) is USD regardless of airline domicile. |
| **€STR** | ECB Data Portal | `data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT`, free, no key, official | Shown as a secondary reference rate for a EUR tranche. Series key verified against the ECB Data Portal catalogue. |
| **AF.PA share price** | Yahoo Finance public chart endpoint | `query1.finance.yahoo.com/v8/finance/chart/AF.PA` | **Unofficial.** Yahoo's chart endpoint is undocumented public site data, not a supported API. Fine for a context strip; nothing the model's core numbers depend on. (The spec suggested the `yfinance` library, the raw endpoint is the same data source with far less dependency weight; the honesty caveat is identical.) |
| **EUR/USD** | Yahoo Finance public chart endpoint | `…/chart/EURUSD=X` | Surfaces the USD-asset / EUR-lessee currency mismatch real aircraft financings manage. |

Live values are cached in-process with a 20-minute TTL keyed by source. On a
fetch failure the last cached value is served with its `fetched_at` timestamp
and the payload is flagged `stale: true` rather than erroring `/api/compare`.

Live SOFR flows into the model when `use_live_sofr` is set on `/api/compare`
(the frontend toggle, default **on**): the cached SOFR replaces
`assumptions.reference_rate_pct` server-side before the model runs. An explicit
`reference_rate_pct` in the request overrides both.

---

## 3. Sourced desk assumptions: editable, not live

All defaults live in `backend/financial_model.py::DEFAULTS` and every one is
editable per-request via the `assumptions` object.

| Assumption | Default | Basis |
|---|---|---|
| `eca_ltv_pct` | 0.85 | Typical ECA-supported advance rate on a new narrowbody. |
| `eca_base_margin_bps` | 90 | Indicative bank margin over the reference rate for ECA-guaranteed paper (the guarantee removes most credit risk, so the margin is thin). |
| `eca_guarantee_fee_pct` | 4.5 | OECD Aircraft Sector Understanding-style exposure fee, expressed as a one-off percentage of the loan. **Simplification:** amortised straight-line over the tenor for the headline annual-cost figure. A real deal capitalises it into the loan or pays it in cash at close, changing the year-0 number. |
| `sll_ltv_pct` | 0.80 | Slightly below ECA, no sovereign-backed guarantee. |
| `sll_base_margin_bps` | 140 | Commercial unsecured/lightly-secured margin; wider than ECA. |
| `sll_kpi_ratchet_bps` | 10 | Sustainability KPI margin step. **Base case assumes the KPI is met** (favourable ratchet: margin steps *down* one step). Missing it swings the margin the other way, a 2× ratchet delta vs. the figure shown. |
| `slb_lease_rate_factor_pct` | 0.80 | **Monthly** lease rate factor as a percent of aircraft value (IBA / Cirium convention). Annual rental = value × LRF% × 12. **Simplification:** flat annuity; a real SLB rental steps down over the term. |
| `slb_residual_value_pct` | 0 → tenor-derived | See §1. |
| `jolco_ltv_pct` | 0.80 | Portion of price funded through the Japanese SPC. |
| `jolco_base_margin_bps` | 120 | Arranger senior-debt margin inside the JOLCO; above ECA (no sovereign guarantee), below the SLL. |
| `jolco_tax_benefit_bps` | 75 | Japanese tax-equity benefit rebated into the rentals. Realistic band 50–150bps depending on lease terms and the investors' tax position. |
| `jolco_call_year` | 10 | Year the purchase option is exercised. Drives cash-flow shape, not the headline cost. |
| `reference_rate_pct` | 3.8 | Fallback when live SOFR is unavailable / toggle off. |
| `gtf_margin_addon_bps` | 35 | Extra debt margin lenders price for GTF-exposed metal (PW1100G / PW1500G) given the powder-metal inspection programme and elevated shop-visit / AOG risk. Derived from engine-risk research and RTX compensation disclosures. |
| `gtf_value_haircut_pct` | 8.0 | Haircut to market/residual value for GTF exposure, reflecting softer secondary-market demand and higher reserve requirements for affected fleets. |

`reference_data.json` (aircraft base prices, market values, LRFs, GTF flags) is
indicative, derived from IBA/Cirium published rate ranges and OEM
list-price/discount commentary. **It is not a valuation.**

---

## 4. Deliberately not modelled

Real-time AFKLM (or any airline's) credit spreads, a bank's actual cost of
funds, actual ECA guarantee-fee schedules, and live bank margin quotes are
**not public data**. A tool that fabricated live-looking numbers for these
would look sophisticated for about ten seconds to someone outside the industry
and would actively damage credibility with someone inside it. The tool models
the *mechanics* correctly with clearly-sourced illustrative assumptions rather
than manufacture false precision.

Also out of scope for v1: withholding tax, hedging cost of the USD/EUR
mismatch, mid-life rental step-downs, balloon/bullet structures, EETC tranching,
tax-based lease benefits, and maintenance reserves.

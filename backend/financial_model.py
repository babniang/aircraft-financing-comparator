"""Pure financial model for the aircraft financing structure comparator.

No framework dependencies - every function here is unit-testable in isolation.

Design (see technical spec section 3.3):

* Each structure is expressed as a list of ``(year, cashflow_usd_m)`` points.
* Cashflows are *incremental* relative to the baseline of paying the full
  delivery price in cash at t=0. Under that baseline the only cashflow is
  ``-delivery_price`` at year 0, so the incremental series for every structure
  starts with a positive number at year 0 (the cash the airline did **not**
  have to put up itself) followed by the ongoing financing outflows.
* ``implied_annual_cost`` runs an IRR over that incremental series. Because the
  baseline is common to all three structures, the IRRs are directly comparable
  even though the structures finance different percentages of the aircraft.

All monetary inputs/outputs are in USD millions. All rates are decimals unless
the field name ends in ``_bps`` (basis points) or ``_pct`` in the public API
layer (schemas.py converts those to decimals before calling in here).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

# ---------------------------------------------------------------------------
# Defaults - every assumption the API accepts, with a documented fallback.
# These are *sourced desk assumptions*, not live data. Citations live in
# docs/methodology.md. The frontend only needs to send what the user changed.
# ---------------------------------------------------------------------------

DEFAULTS: dict[str, float] = {
    "eca_ltv_pct": 0.85,          # ECA-supported loan-to-value
    "eca_base_margin_bps": 90,    # bank margin over the reference rate
    "eca_guarantee_fee_pct": 4.5,  # one-off ECA guarantee premium, % of loan
    "sll_ltv_pct": 0.80,
    "sll_base_margin_bps": 140,
    "sll_kpi_ratchet_bps": 10,    # margin step per KPI direction
    "slb_lease_rate_factor_pct": 0.80,  # MONTHLY rental as % of aircraft value
    "slb_residual_value_pct": 0.0,  # % of delivery price the lessee forgoes at
    #                                 lease end; 0 => derive from tenor (see slb())
    "jolco_ltv_pct": 0.80,        # portion of price funded through the JOLCO SPC
    "jolco_base_margin_bps": 120,  # senior-debt margin inside the JOLCO
    "jolco_tax_benefit_bps": 75,  # Japanese tax-equity benefit rebated into rentals
    "jolco_call_year": 10,        # year the airline exercises the purchase option
    "reference_rate_pct": 3.8,    # base rate (SOFR-like) as a percent
    "gtf_margin_addon_bps": 35,   # extra debt margin for GTF-exposed metal
    "gtf_value_haircut_pct": 8.0,  # haircut to residual/market value for GTF
}


@dataclass
class Assumptions:
    """Resolved assumption set. Percent inputs are stored as given (percents),
    bps inputs as given (basis points); conversion to decimals happens at the
    point of use so the arithmetic stays readable."""

    eca_ltv_pct: float = DEFAULTS["eca_ltv_pct"]
    eca_base_margin_bps: float = DEFAULTS["eca_base_margin_bps"]
    eca_guarantee_fee_pct: float = DEFAULTS["eca_guarantee_fee_pct"]
    sll_ltv_pct: float = DEFAULTS["sll_ltv_pct"]
    sll_base_margin_bps: float = DEFAULTS["sll_base_margin_bps"]
    sll_kpi_ratchet_bps: float = DEFAULTS["sll_kpi_ratchet_bps"]
    slb_lease_rate_factor_pct: float = DEFAULTS["slb_lease_rate_factor_pct"]
    slb_residual_value_pct: float = DEFAULTS["slb_residual_value_pct"]
    jolco_ltv_pct: float = DEFAULTS["jolco_ltv_pct"]
    jolco_base_margin_bps: float = DEFAULTS["jolco_base_margin_bps"]
    jolco_tax_benefit_bps: float = DEFAULTS["jolco_tax_benefit_bps"]
    jolco_call_year: float = DEFAULTS["jolco_call_year"]
    reference_rate_pct: float = DEFAULTS["reference_rate_pct"]
    gtf_margin_addon_bps: float = DEFAULTS["gtf_margin_addon_bps"]
    gtf_value_haircut_pct: float = DEFAULTS["gtf_value_haircut_pct"]

    @classmethod
    def merge(cls, overrides: dict | None) -> "Assumptions":
        data = dict(DEFAULTS)
        if overrides:
            for k, v in overrides.items():
                if v is not None and k in data:
                    data[k] = v
        return cls(**data)


# ---------------------------------------------------------------------------
# IRR helper - Newton's method with a bisection fallback.
#
# Deliberately hand-rolled: pulling in numpy / numpy_financial just for a
# single IRR is a heavy dependency for a stateless Railway service. The
# cashflows here are annual and well-behaved (one sign change), so a simple
# solver converges reliably.
# ---------------------------------------------------------------------------


def _npv(rate: float, cashflows: list[float]) -> float:
    return sum(cf / (1.0 + rate) ** t for t, cf in enumerate(cashflows))


def _npv_derivative(rate: float, cashflows: list[float]) -> float:
    return sum(-t * cf / (1.0 + rate) ** (t + 1) for t, cf in enumerate(cashflows))


def irr(cashflows: list[float], *, guess: float = 0.08) -> float:
    """Internal rate of return of an annual cashflow series.

    Returns the periodic (annual) rate as a decimal. Raises ``ValueError`` if
    the series has no sign change (no meaningful IRR) or the solver fails to
    converge.
    """
    signs = {1 if cf > 0 else -1 if cf < 0 else 0 for cf in cashflows}
    if 1 not in signs or -1 not in signs:
        raise ValueError("IRR requires at least one positive and one negative cashflow")

    # Newton's method.
    rate = guess
    for _ in range(100):
        value = _npv(rate, cashflows)
        if abs(value) < 1e-9:
            return rate
        derivative = _npv_derivative(rate, cashflows)
        if derivative == 0:
            break
        step = value / derivative
        rate -= step
        if rate <= -0.999999:  # keep the discount factor positive
            rate = -0.9
        if abs(step) < 1e-10:
            return rate

    # Bisection fallback over a wide, sane bracket.
    lo, hi = -0.9, 10.0
    f_lo, f_hi = _npv(lo, cashflows), _npv(hi, cashflows)
    if f_lo * f_hi > 0:
        raise ValueError("IRR did not converge and no bracket found")
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = _npv(mid, cashflows)
        if abs(f_mid) < 1e-9:
            return mid
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def annuity_payment(principal: float, annual_rate: float, years: int) -> float:
    """Level annual payment that fully amortizes ``principal`` over ``years``."""
    if years <= 0:
        raise ValueError("years must be positive")
    if annual_rate == 0:
        return principal / years
    factor = annual_rate / (1.0 - (1.0 + annual_rate) ** (-years))
    return principal * factor


def _retention(years: float) -> float:
    """Crude age-based value-retention factor: what fraction of today's value
    the airframe holds after ``years``. A fuller model would use a published
    residual-value curve by type; this straight line (~46% at 12y, floored at
    15%) is enough for a comparison tool. Used by the SLB residual and by the
    mid-life LTV in the credit metrics."""
    return max(0.15, 1.0 - 0.045 * years)


def _amortization(principal: float, annual_rate: float, years: int) -> tuple[list[float], float]:
    """Level-payment amortization. Returns ``(balances, wal_years)`` where
    ``balances[t]`` is the debt outstanding at the end of year ``t`` (t from 0
    to ``years``) and ``wal_years`` is the weighted average life of the
    principal repayments."""
    pmt = annuity_payment(principal, annual_rate, years)
    bal = principal
    balances = [principal]
    t_weighted = 0.0
    for t in range(1, years + 1):
        interest = bal * annual_rate
        principal_repaid = pmt - interest
        bal = max(0.0, bal - principal_repaid)
        balances.append(bal)
        t_weighted += t * principal_repaid
    wal = t_weighted / principal if principal else 0.0
    return balances, wal


@dataclass
class CreditMetrics:
    """Asset-level credit metrics of the kind a credit committee paper leads
    with. All are simplified, aircraft-level proxies (the tool has no airline
    financials): see docs/methodology.md."""

    ltv_initial_pct: float           # financed amount / current market value at close
    ltv_midlife_pct: float | None    # outstanding / depreciated value at tenor/2
    dscr_asset_x: float | None       # asset lease-earning power / annual financing outflow
    wal_years: float                 # weighted average life of principal repayment
    balloon_pct: float | None        # % of the financed amount still due as a lump at the end


def _debt_credit_metrics(
    *,
    financed: float,
    annual_rate: float,
    tenor_years: int,
    annual_outflow: float,
    market_value: float,
    lrf_pct: float,
    balances: list[float] | None = None,
    wal_years: float | None = None,
    balloon_amount: float = 0.0,
    settle_year: int | None = None,
) -> CreditMetrics:
    """Credit metrics for an amortizing debt-style structure (ECA, SLL, JOLCO).

    ``balances``/``wal_years`` can be supplied when the caller has already run
    the amortization (JOLCO, which settles a balloon early); otherwise they are
    derived from a full-tenor amortization here.
    """
    if balances is None or wal_years is None:
        balances, wal_years = _amortization(financed, annual_rate, tenor_years)

    end = settle_year or tenor_years
    mid = max(1, end // 2)
    depreciated_value = market_value * _retention(mid)
    outstanding_mid = balances[mid] if mid < len(balances) else 0.0

    asset_earning = market_value * (lrf_pct / 100.0) * 12.0

    return CreditMetrics(
        ltv_initial_pct=round(financed / market_value * 100, 1),
        ltv_midlife_pct=round(outstanding_mid / depreciated_value * 100, 1)
        if depreciated_value > 0
        else None,
        dscr_asset_x=round(asset_earning / annual_outflow, 2) if annual_outflow > 0 else None,
        wal_years=round(wal_years, 1),
        balloon_pct=round(balloon_amount / financed * 100, 1) if financed > 0 else None,
    )


# ---------------------------------------------------------------------------
# Structure cashflow generators. Each returns list[(year, amount_usd_m)] of
# incremental cashflows vs. paying full delivery price in cash at t=0.
# Positive = cash into the airline, negative = cash out.
# ---------------------------------------------------------------------------


@dataclass
class StructureResult:
    structure: str
    label: str
    implied_annual_cost_pct: float
    financed_pct_of_price: float
    balance_sheet: str  # "on" | "off"
    headline_note: str
    cashflow_schedule: list[dict]
    one_off_gain_usd_m: float | None = None
    residual_value_usd_m: float | None = None
    credit_metrics: CreditMetrics | None = None


def _schedule(cashflows: list[tuple[int, float]]) -> list[dict]:
    return [{"year": y, "amount_usd_m": round(a, 4)} for y, a in cashflows]


def eca_debt(
    delivery_price: float,
    market_value: float,
    tenor_years: int,
    a: Assumptions,
    *,
    gtf_adjustment: bool = False,
) -> StructureResult:
    loan_amount = delivery_price * a.eca_ltv_pct
    margin_bps = a.eca_base_margin_bps + (a.gtf_margin_addon_bps if gtf_adjustment else 0.0)
    all_in_rate = a.reference_rate_pct / 100.0 + margin_bps / 10_000.0

    debt_service = annuity_payment(loan_amount, all_in_rate, tenor_years)

    # Guarantee fee: charged upfront as a % of the loan, but for the headline
    # annual-cost figure we amortize it straight-line over the tenor. This is a
    # simplification - a real deal would either capitalize it into the loan or
    # pay it in cash at close, changing the year-0 figure. Flagged per spec.
    guarantee_fee_total = loan_amount * a.eca_guarantee_fee_pct / 100.0
    guarantee_fee_annual = guarantee_fee_total / tenor_years

    cashflows: list[tuple[int, float]] = [(0, loan_amount)]
    for year in range(1, tenor_years + 1):
        cashflows.append((year, -(debt_service + guarantee_fee_annual)))

    cost = irr([cf for _, cf in cashflows])

    note = (
        "Guarantee fee amortized over tenor; lowest margin but requires ECA "
        "eligibility (buyer credit / country cover)."
    )
    if gtf_adjustment:
        note += f" Includes +{a.gtf_margin_addon_bps:.0f}bps GTF margin add-on."

    metrics = _debt_credit_metrics(
        financed=loan_amount,
        annual_rate=all_in_rate,
        tenor_years=tenor_years,
        annual_outflow=debt_service + guarantee_fee_annual,
        market_value=market_value,
        lrf_pct=a.slb_lease_rate_factor_pct,
    )

    return StructureResult(
        structure="eca_debt",
        label="ECA-Backed Term Loan",
        implied_annual_cost_pct=round(cost * 100, 2),
        financed_pct_of_price=round(a.eca_ltv_pct * 100, 1),
        balance_sheet="on",
        headline_note=note,
        cashflow_schedule=_schedule(cashflows),
        credit_metrics=metrics,
    )


def sll(
    delivery_price: float,
    market_value: float,
    tenor_years: int,
    a: Assumptions,
    *,
    gtf_adjustment: bool = False,
) -> StructureResult:
    loan_amount = delivery_price * a.sll_ltv_pct
    margin_bps = a.sll_base_margin_bps + (a.gtf_margin_addon_bps if gtf_adjustment else 0.0)

    # Base case: assume the sustainability KPI is met, i.e. the favorable
    # ratchet applies (margin steps *down* by one ratchet). Missing the KPI
    # swings the margin the other way - a 2x ratchet delta vs. this figure.
    margin_bps -= a.sll_kpi_ratchet_bps
    all_in_rate = a.reference_rate_pct / 100.0 + margin_bps / 10_000.0

    debt_service = annuity_payment(loan_amount, all_in_rate, tenor_years)

    cashflows: list[tuple[int, float]] = [(0, loan_amount)]
    for year in range(1, tenor_years + 1):
        cashflows.append((year, -debt_service))

    cost = irr([cf for _, cf in cashflows])

    note = (
        "No ECA fee, but higher base margin; cost flexes "
        f"±{a.sll_kpi_ratchet_bps:.0f}bps on KPI performance "
        f"(missing the KPI adds ~{2 * a.sll_kpi_ratchet_bps:.0f}bps back)."
    )
    if gtf_adjustment:
        note += f" Includes +{a.gtf_margin_addon_bps:.0f}bps GTF margin add-on."

    metrics = _debt_credit_metrics(
        financed=loan_amount,
        annual_rate=all_in_rate,
        tenor_years=tenor_years,
        annual_outflow=debt_service,
        market_value=market_value,
        lrf_pct=a.slb_lease_rate_factor_pct,
    )

    return StructureResult(
        structure="sll",
        label="Sustainability-Linked Loan",
        implied_annual_cost_pct=round(cost * 100, 2),
        financed_pct_of_price=round(a.sll_ltv_pct * 100, 1),
        balance_sheet="on",
        headline_note=note,
        cashflow_schedule=_schedule(cashflows),
        credit_metrics=metrics,
    )


def slb(
    delivery_price: float,
    market_value: float,
    tenor_years: int,
    a: Assumptions,
    *,
    gtf_adjustment: bool = False,
) -> StructureResult:
    sale_price = market_value
    if gtf_adjustment:
        sale_price *= 1.0 - a.gtf_value_haircut_pct / 100.0

    # Lease rate factor is an industry-standard *monthly* percentage of the
    # aircraft value (IBA / Cirium convention), so annual rental = value x LRF%
    # x 12. Flat-annuity simplification: a real SLB rental steps down over the
    # lease term. Fine for v1 - flagged per spec.
    lease_rental = sale_price * (a.slb_lease_rate_factor_pct / 100.0) * 12.0

    # Residual value the lessee forgoes at lease end. This is what makes the SLB
    # genuinely comparable to the debt structures: under the cash baseline (and
    # under ECA/SLL financed purchases) the airline still *owns* the aircraft at
    # year N; under an operating SLB it hands the metal back and owns nothing.
    # Without this term the SLB looks artificially cheap. Default: derive a
    # crude age-based retention from the tenor (a fuller model would use a
    # published residual-value curve); override via slb_residual_value_pct.
    if a.slb_residual_value_pct > 0:
        residual_value = delivery_price * a.slb_residual_value_pct / 100.0
    else:
        residual_value = delivery_price * _retention(tenor_years)  # ~46% at 12y
    if gtf_adjustment:
        residual_value *= 1.0 - a.gtf_value_haircut_pct / 100.0

    cashflows: list[tuple[int, float]] = [(0, sale_price)]
    for year in range(1, tenor_years + 1):
        outflow = -lease_rental
        if year == tenor_years:
            outflow -= residual_value
        cashflows.append((year, outflow))

    cost = irr([cf for _, cf in cashflows])

    # Can be negative (sold below what you paid) - display as-is, do not clip.
    one_off_gain = sale_price - delivery_price

    note = (
        "100% financed and off balance sheet, plus a one-off accounting "
        "gain/loss on disposal. The real cost is the residual value "
        f"(~${residual_value:.0f}m) you give up at lease end."
    )
    if gtf_adjustment:
        note += f" Sale price and residual haircut {a.gtf_value_haircut_pct:.0f}% for GTF exposure."

    # WAL of the (rental + residual) outflow stream, and asset coverage. An SLB
    # has no debt balance to run down, so LTV-at-mid-life and balloon are n/a;
    # asset DSCR sits near 1.0x by construction (rent = value x LRF), which is
    # itself the point: no coverage cushion versus a debt structure at 80% LTV.
    outflows = [(y, -cf) for y, cf in cashflows if cf < 0]
    total_out = sum(v for _, v in outflows)
    wal = sum(y * v for y, v in outflows) / total_out if total_out else 0.0
    asset_earning = market_value * (a.slb_lease_rate_factor_pct / 100.0) * 12.0
    metrics = CreditMetrics(
        ltv_initial_pct=round(sale_price / market_value * 100, 1),
        ltv_midlife_pct=None,
        dscr_asset_x=round(asset_earning / lease_rental, 2) if lease_rental else None,
        wal_years=round(wal, 1),
        balloon_pct=None,
    )

    return StructureResult(
        structure="slb",
        label="Sale-and-Leaseback",
        implied_annual_cost_pct=round(cost * 100, 2),
        financed_pct_of_price=100.0,
        balance_sheet="off",
        headline_note=note,
        cashflow_schedule=_schedule(cashflows),
        one_off_gain_usd_m=round(one_off_gain, 3),
        residual_value_usd_m=round(residual_value, 3),
        credit_metrics=metrics,
    )


def jolco(
    delivery_price: float,
    market_value: float,
    tenor_years: int,
    a: Assumptions,
    *,
    gtf_adjustment: bool = False,
) -> StructureResult:
    """Japanese Operating Lease with Call Option.

    A Japanese SPC, funded by Japanese tax equity plus arranger senior debt,
    buys the aircraft and leases it to the airline. The equity investors
    monetise accelerated tax depreciation and rebate part of that benefit into
    the rentals, so the all-in cost prices *through* plain senior debt. The
    airline holds a purchase option it almost always exercises, at year
    ``jolco_call_year``, paying the then-outstanding balance as the call price
    and keeping the aircraft.

    Modelled as a senior amortization at the tax-adjusted effective rate: the
    airline pays level rentals to the call year, then settles the outstanding
    balance. The implied annual cost therefore equals that effective rate; the
    call year drives the *shape* of the cash flows (a lump at year N), not the
    headline number. Simplifications: JPY/USD basis, arrangement and equity
    fees, and prepayment lock-outs are not modelled (flagged in the note).
    """
    advance = delivery_price * a.jolco_ltv_pct
    margin_bps = a.jolco_base_margin_bps + (
        a.gtf_margin_addon_bps if gtf_adjustment else 0.0
    )
    gross_rate = a.reference_rate_pct / 100.0 + margin_bps / 10_000.0
    effective_rate = max(0.001, gross_rate - a.jolco_tax_benefit_bps / 10_000.0)

    call_year = int(min(max(1, round(a.jolco_call_year)), tenor_years))

    balances, _ = _amortization(advance, effective_rate, tenor_years)
    rental = annuity_payment(advance, effective_rate, tenor_years)
    call_price = balances[call_year]

    cashflows: list[tuple[int, float]] = [(0, advance)]
    for year in range(1, call_year + 1):
        outflow = -rental
        if year == call_year:
            outflow -= call_price
        cashflows.append((year, outflow))

    cost = irr([cf for _, cf in cashflows])

    # WAL: rentals repay principal to the call year, then the call price
    # settles the residual balance at the call year.
    t_weighted = 0.0
    for t in range(1, call_year + 1):
        principal_repaid = balances[t - 1] - balances[t]
        t_weighted += t * principal_repaid
    t_weighted += call_year * call_price
    wal = t_weighted / advance if advance else 0.0

    metrics = _debt_credit_metrics(
        financed=advance,
        annual_rate=effective_rate,
        tenor_years=tenor_years,
        annual_outflow=rental,
        market_value=market_value,
        lrf_pct=a.slb_lease_rate_factor_pct,
        balances=balances,
        wal_years=wal,
        balloon_amount=call_price,
        settle_year=call_year,
    )

    note = (
        f"Japanese tax-equity lease. Cheapest all-in because Japanese investors' "
        f"accelerated depreciation is rebated into the rentals "
        f"(~{a.jolco_tax_benefit_bps:.0f}bps), but rigid: fixed call in year "
        f"{call_year}, limited prepayment, JPY/USD basis and heavy documentation. "
        f"The airline exercises the call and keeps the aircraft."
    )
    if gtf_adjustment:
        note += f" Includes +{a.gtf_margin_addon_bps:.0f}bps GTF margin add-on."

    return StructureResult(
        structure="jolco",
        label="JOLCO (Japanese Tax Lease)",
        implied_annual_cost_pct=round(cost * 100, 2),
        financed_pct_of_price=round(a.jolco_ltv_pct * 100, 1),
        balance_sheet="on",  # finance lease under IFRS 16 (call option ~certain)
        headline_note=note,
        cashflow_schedule=_schedule(cashflows),
        credit_metrics=metrics,
    )


# ---------------------------------------------------------------------------
# Top-level orchestration
# ---------------------------------------------------------------------------


def compare(
    *,
    delivery_price_usd_m: float,
    market_value_usd_m: float,
    tenor_years: int,
    gtf_adjustment: bool = False,
    assumptions: dict | None = None,
) -> dict:
    a = Assumptions.merge(assumptions)

    results = [
        eca_debt(
            delivery_price_usd_m, market_value_usd_m, tenor_years, a,
            gtf_adjustment=gtf_adjustment,
        ),
        sll(
            delivery_price_usd_m, market_value_usd_m, tenor_years, a,
            gtf_adjustment=gtf_adjustment,
        ),
        jolco(
            delivery_price_usd_m, market_value_usd_m, tenor_years, a,
            gtf_adjustment=gtf_adjustment,
        ),
        slb(
            delivery_price_usd_m,
            market_value_usd_m,
            tenor_years,
            a,
            gtf_adjustment=gtf_adjustment,
        ),
    ]

    cheapest = min(results, key=lambda r: r.implied_annual_cost_pct).structure

    return {
        "gtf_adjustment_applied": gtf_adjustment,
        "results": results,
        "cheapest": cheapest,
        "resolved_assumptions": a,
    }

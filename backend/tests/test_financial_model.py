"""Unit tests for the financial model.

Each structure's cashflow generator is checked against hand-reasoned
expectations, and the IRR helper against closed-form cases.
"""

import math

import pytest

import financial_model as fm


# --- IRR helper ---------------------------------------------------------------


def test_irr_simple_loan_recovers_rate():
    # Borrow 100 at t0, repay level annuity at 6% over 5y -> IRR == 6%.
    rate = 0.06
    pmt = fm.annuity_payment(100.0, rate, 5)
    cashflows = [100.0] + [-pmt] * 5
    assert fm.irr(cashflows) == pytest.approx(rate, abs=1e-6)


def test_irr_zero_rate():
    cashflows = [100.0, -50.0, -50.0]
    assert fm.irr(cashflows) == pytest.approx(0.0, abs=1e-6)


def test_irr_requires_sign_change():
    with pytest.raises(ValueError):
        fm.irr([100.0, 50.0, 25.0])


def test_annuity_payment_zero_rate():
    assert fm.annuity_payment(120.0, 0.0, 12) == pytest.approx(10.0)


# --- ECA-backed debt ---------------------------------------------------------


def test_eca_debt_irr_equals_all_in_rate_when_fee_zero():
    """Sanity check on the amortization math: with no guarantee fee, the
    implied cost must equal reference_rate + margin exactly."""
    a = fm.Assumptions.merge({"eca_guarantee_fee_pct": 0.0, "reference_rate_pct": 4.0,
                              "eca_base_margin_bps": 100})
    res = fm.eca_debt(delivery_price=50.0, market_value=53.0, tenor_years=10, a=a)
    assert res.implied_annual_cost_pct == pytest.approx(5.0, abs=0.02)
    assert res.financed_pct_of_price == pytest.approx(85.0)
    assert res.balance_sheet == "on"


def test_eca_guarantee_fee_raises_implied_cost():
    base = fm.Assumptions.merge({"eca_guarantee_fee_pct": 0.0})
    withfee = fm.Assumptions.merge({"eca_guarantee_fee_pct": 4.5})
    r_base = fm.eca_debt(delivery_price=50.0, market_value=53.0, tenor_years=12, a=base)
    r_fee = fm.eca_debt(delivery_price=50.0, market_value=53.0, tenor_years=12, a=withfee)
    assert r_fee.implied_annual_cost_pct > r_base.implied_annual_cost_pct


def test_eca_gtf_addon_raises_cost():
    a = fm.Assumptions.merge(None)
    without = fm.eca_debt(delivery_price=50.0, market_value=53.0, tenor_years=12, a=a,
                          gtf_adjustment=False)
    with_gtf = fm.eca_debt(delivery_price=50.0, market_value=53.0, tenor_years=12, a=a,
                           gtf_adjustment=True)
    assert with_gtf.implied_annual_cost_pct > without.implied_annual_cost_pct
    assert "GTF" in with_gtf.headline_note


def test_eca_cashflow_schedule_shape():
    res = fm.eca_debt(delivery_price=45.0, market_value=48.0, tenor_years=12,
                      a=fm.Assumptions.merge(None))
    assert len(res.cashflow_schedule) == 13
    assert res.cashflow_schedule[0]["year"] == 0
    assert res.cashflow_schedule[0]["amount_usd_m"] > 0
    assert all(p["amount_usd_m"] < 0 for p in res.cashflow_schedule[1:])


def test_eca_credit_metrics_present_and_sane():
    res = fm.eca_debt(delivery_price=50.0, market_value=55.0, tenor_years=12,
                      a=fm.Assumptions.merge(None))
    m = res.credit_metrics
    assert m is not None
    # loan = 0.85 * 50 = 42.5 against a 55 value -> ~77% LTV
    assert m.ltv_initial_pct == pytest.approx(42.5 / 55.0 * 100, abs=0.1)
    assert m.ltv_midlife_pct < m.ltv_initial_pct  # debt paid down, value depreciated
    assert m.balloon_pct == pytest.approx(0.0)   # fully amortising
    assert 3.0 < m.wal_years < 9.0


# --- Sustainability-linked loan --------------------------------------------


def test_sll_lower_ltv_than_eca_default():
    res = fm.sll(delivery_price=50.0, market_value=53.0, tenor_years=12,
                 a=fm.Assumptions.merge(None))
    assert res.financed_pct_of_price == pytest.approx(80.0)
    assert res.balance_sheet == "on"


def test_sll_favorable_ratchet_beats_no_ratchet_reference():
    """Base case assumes the KPI is met -> margin steps down by one ratchet,
    so implied cost is below (reference + base margin)."""
    a = fm.Assumptions.merge({"reference_rate_pct": 4.0, "sll_base_margin_bps": 140,
                              "sll_kpi_ratchet_bps": 10})
    res = fm.sll(delivery_price=50.0, market_value=53.0, tenor_years=12, a=a)
    # reference 4.0 + 1.40 - 0.10 = 5.30
    assert res.implied_annual_cost_pct == pytest.approx(5.30, abs=0.03)


# --- JOLCO ----------------------------------------------------------------


def test_jolco_prices_through_senior_debt():
    """The Japanese tax-equity rebate must make JOLCO cheaper than the SLL at
    the same LTV and reference rate."""
    a = fm.Assumptions.merge({"reference_rate_pct": 4.0})
    jol = fm.jolco(delivery_price=60.0, market_value=64.0, tenor_years=12, a=a)
    sll = fm.sll(delivery_price=60.0, market_value=64.0, tenor_years=12, a=a)
    assert jol.implied_annual_cost_pct < sll.implied_annual_cost_pct
    assert jol.balance_sheet == "on"


def test_jolco_has_call_year_balloon():
    a = fm.Assumptions.merge({"jolco_call_year": 10})
    res = fm.jolco(delivery_price=60.0, market_value=64.0, tenor_years=12, a=a)
    # cash flow runs only to the call year, and that year carries a lump
    assert res.cashflow_schedule[-1]["year"] == 10
    assert res.cashflow_schedule[-1]["amount_usd_m"] < res.cashflow_schedule[-2]["amount_usd_m"]
    assert res.credit_metrics.balloon_pct > 5.0


# --- Sale-and-leaseback ---------------------------------------------------


def test_slb_one_off_gain_can_be_negative():
    res = fm.slb(delivery_price=50.0, market_value=45.0, tenor_years=12,
                 a=fm.Assumptions.merge(None))
    assert res.one_off_gain_usd_m == pytest.approx(-5.0, abs=1e-6)
    assert res.balance_sheet == "off"
    assert res.financed_pct_of_price == 100.0


def test_slb_residual_giveup_raises_cost_above_naive():
    """The residual give-up term must make the SLB materially more expensive
    than a naive rentals-only IRR would suggest."""
    a_naive = fm.Assumptions.merge({"slb_residual_value_pct": 0.01})  # ~nil residual
    a_real = fm.Assumptions.merge(None)  # tenor-derived residual
    naive = fm.slb(delivery_price=55.0, market_value=60.0, tenor_years=12, a=a_naive)
    real = fm.slb(delivery_price=55.0, market_value=60.0, tenor_years=12, a=a_real)
    assert real.implied_annual_cost_pct > naive.implied_annual_cost_pct + 2.0
    # last-year cashflow carries the residual give-up
    assert real.cashflow_schedule[-1]["amount_usd_m"] < real.cashflow_schedule[-2]["amount_usd_m"]


def test_slb_explicit_residual_override():
    a = fm.Assumptions.merge({"slb_residual_value_pct": 40.0})
    res = fm.slb(delivery_price=50.0, market_value=52.0, tenor_years=10, a=a)
    # year-10 outflow = -rental - 0.40*50
    rental = 52.0 * (0.80 / 100.0) * 12.0
    assert res.cashflow_schedule[-1]["amount_usd_m"] == pytest.approx(-(rental + 20.0), abs=1e-6)


def test_slb_gtf_haircut_reduces_sale_and_gain():
    a = fm.Assumptions.merge({"gtf_value_haircut_pct": 8.0})
    no_gtf = fm.slb(delivery_price=50.0, market_value=55.0, tenor_years=12, a=a)
    gtf = fm.slb(delivery_price=50.0, market_value=55.0, tenor_years=12, a=a,
                 gtf_adjustment=True)
    assert gtf.one_off_gain_usd_m < no_gtf.one_off_gain_usd_m
    assert gtf.cashflow_schedule[0]["amount_usd_m"] == pytest.approx(55.0 * 0.92)


# --- compare() orchestration --------------------------------------------


def test_compare_picks_lowest_cost_as_cheapest():
    out = fm.compare(
        delivery_price_usd_m=45.0,
        market_value_usd_m=48.0,
        tenor_years=12,
        gtf_adjustment=True,
    )
    costs = {r.structure: r.implied_annual_cost_pct for r in out["results"]}
    assert out["cheapest"] == min(costs, key=costs.get)
    assert set(costs) == {"eca_debt", "sll", "jolco", "slb"}
    assert out["gtf_adjustment_applied"] is True


def test_compare_assumption_override_applies():
    out = fm.compare(
        delivery_price_usd_m=45.0,
        market_value_usd_m=48.0,
        tenor_years=12,
        assumptions={"reference_rate_pct": 10.0},
    )
    assert out["resolved_assumptions"].reference_rate_pct == 10.0
    # a much higher base rate should push every on-BS structure's cost up
    for r in out["results"]:
        if r.structure in ("eca_debt", "sll"):
            assert r.implied_annual_cost_pct > 9.0

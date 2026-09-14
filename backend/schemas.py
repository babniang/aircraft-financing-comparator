"""Pydantic request/response models for the public API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AssumptionsIn(BaseModel):
    """All optional - omitted fields fall back to defaults in financial_model.DEFAULTS."""

    eca_ltv_pct: Optional[float] = Field(default=None, ge=0, le=1)
    eca_base_margin_bps: Optional[float] = Field(default=None, ge=0, le=1000)
    eca_guarantee_fee_pct: Optional[float] = Field(default=None, ge=0, le=25)
    sll_ltv_pct: Optional[float] = Field(default=None, ge=0, le=1)
    sll_base_margin_bps: Optional[float] = Field(default=None, ge=0, le=1000)
    sll_kpi_ratchet_bps: Optional[float] = Field(default=None, ge=0, le=100)
    slb_lease_rate_factor_pct: Optional[float] = Field(default=None, ge=0, le=5)
    slb_residual_value_pct: Optional[float] = Field(default=None, ge=0, le=100)
    jolco_ltv_pct: Optional[float] = Field(default=None, ge=0, le=1)
    jolco_base_margin_bps: Optional[float] = Field(default=None, ge=0, le=1000)
    jolco_tax_benefit_bps: Optional[float] = Field(default=None, ge=0, le=400)
    jolco_call_year: Optional[int] = Field(default=None, ge=1, le=25)
    reference_rate_pct: Optional[float] = Field(default=None, ge=0, le=20)
    gtf_margin_addon_bps: Optional[float] = Field(default=None, ge=0, le=500)
    gtf_value_haircut_pct: Optional[float] = Field(default=None, ge=0, le=50)


class CompareRequest(BaseModel):
    aircraft_id: Optional[str] = None
    delivery_price_usd_m: float = Field(gt=0, le=1000)
    market_value_usd_m: float = Field(gt=0, le=1000)
    tenor_years: int = Field(ge=1, le=25)
    gtf_adjustment: bool = False
    use_live_sofr: bool = False
    assumptions: Optional[AssumptionsIn] = None


class CashflowPoint(BaseModel):
    year: int
    amount_usd_m: float


StructureId = Literal["eca_debt", "sll", "jolco", "slb"]


class CreditMetricsOut(BaseModel):
    ltv_initial_pct: float
    ltv_midlife_pct: Optional[float] = None
    dscr_asset_x: Optional[float] = None
    wal_years: float
    balloon_pct: Optional[float] = None


class StructureOut(BaseModel):
    structure: StructureId
    label: str
    implied_annual_cost_pct: float
    financed_pct_of_price: float
    balance_sheet: Literal["on", "off"]
    headline_note: str
    cashflow_schedule: list[CashflowPoint]
    one_off_gain_usd_m: Optional[float] = None
    residual_value_usd_m: Optional[float] = None
    credit_metrics: Optional[CreditMetricsOut] = None


class CompareResponse(BaseModel):
    aircraft_id: Optional[str] = None
    gtf_adjustment_applied: bool
    reference_rate_pct_used: float
    reference_rate_source: Literal["live_sofr", "assumption_default", "assumption_override"]
    results: list[StructureOut]
    cheapest: StructureId


class AircraftRef(BaseModel):
    id: str
    label: str
    operator: str = ""
    afklm_fleet: bool = False
    typical_delivery_price_usd_m: float
    typical_market_value_usd_m: float
    typical_lease_rate_factor_pct: float
    gtf_exposed: bool


class ReferenceResponse(BaseModel):
    aircraft: list[AircraftRef]
    version: str
    sources_note: str


class MarketContextResponse(BaseModel):
    sofr_pct: Optional[float] = None
    sofr_as_of: Optional[str] = None
    eur_str_pct: Optional[float] = None
    eur_str_as_of: Optional[str] = None
    af_pa_price_eur: Optional[float] = None
    af_pa_as_of: Optional[str] = None
    eurusd: Optional[float] = None
    eurusd_as_of: Optional[str] = None
    stale: bool = False

export interface AircraftRef {
  id: string;
  label: string;
  operator: string;
  afklm_fleet: boolean;
  typical_delivery_price_usd_m: number;
  typical_market_value_usd_m: number;
  typical_lease_rate_factor_pct: number;
  gtf_exposed: boolean;
}

export interface ReferenceResponse {
  aircraft: AircraftRef[];
  version: string;
  sources_note: string;
}

export interface MarketContext {
  sofr_pct: number | null;
  sofr_as_of: string | null;
  eur_str_pct: number | null;
  eur_str_as_of: string | null;
  af_pa_price_eur: number | null;
  af_pa_as_of: string | null;
  eurusd: number | null;
  eurusd_as_of: string | null;
  stale: boolean;
}

export interface CashflowPoint {
  year: number;
  amount_usd_m: number;
}

export type StructureId = "eca_debt" | "sll" | "jolco" | "slb";

export interface CreditMetrics {
  ltv_initial_pct: number;
  ltv_midlife_pct?: number | null;
  dscr_asset_x?: number | null;
  wal_years: number;
  balloon_pct?: number | null;
}

export interface StructureResult {
  structure: StructureId;
  label: string;
  implied_annual_cost_pct: number;
  financed_pct_of_price: number;
  balance_sheet: "on" | "off";
  headline_note: string;
  cashflow_schedule: CashflowPoint[];
  one_off_gain_usd_m?: number | null;
  residual_value_usd_m?: number | null;
  credit_metrics?: CreditMetrics | null;
}

export interface CompareResponse {
  aircraft_id: string | null;
  gtf_adjustment_applied: boolean;
  reference_rate_pct_used: number;
  reference_rate_source:
    | "live_sofr"
    | "assumption_default"
    | "assumption_override";
  results: StructureResult[];
  cheapest: StructureId;
}

export interface Assumptions {
  eca_ltv_pct?: number;
  eca_base_margin_bps?: number;
  eca_guarantee_fee_pct?: number;
  sll_ltv_pct?: number;
  sll_base_margin_bps?: number;
  sll_kpi_ratchet_bps?: number;
  slb_lease_rate_factor_pct?: number;
  slb_residual_value_pct?: number;
  jolco_ltv_pct?: number;
  jolco_base_margin_bps?: number;
  jolco_tax_benefit_bps?: number;
  jolco_call_year?: number;
  reference_rate_pct?: number;
  gtf_margin_addon_bps?: number;
  gtf_value_haircut_pct?: number;
}

export interface CompareRequest {
  aircraft_id?: string;
  delivery_price_usd_m: number;
  market_value_usd_m: number;
  tenor_years: number;
  gtf_adjustment: boolean;
  use_live_sofr: boolean;
  assumptions?: Assumptions;
}

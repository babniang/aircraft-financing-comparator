"""FastAPI app - routes, CORS, and the thin glue between HTTP and the model.

The frontend never recomputes financial logic; it renders whatever this
returns. All IRR / cashflow math lives in ``financial_model.py``.
"""

from __future__ import annotations

import dataclasses
import datetime as dt
import json
import os
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import excel_model
import financial_model as fm
import market_data
from schemas import (
    CompareRequest,
    CompareResponse,
    MarketContextResponse,
    ReferenceResponse,
    StructureOut,
)

app = FastAPI(title="Aircraft Financing Structure Comparator", version="1.0.0")

# --- CORS -----------------------------------------------------------------
# This API is public, read-only and carries no credentials or cookies, so the
# default when ALLOWED_ORIGIN is unset is to allow any origin. That is a
# deliberate choice: a forgotten env var previously meant the browser silently
# blocked every response and the page hung on "loading" forever. Set
# ALLOWED_ORIGIN (comma-separated) to lock it down, and ALLOWED_ORIGIN_REGEX to
# additionally match Vercel preview domains.
_allowed_origin = os.environ.get("ALLOWED_ORIGIN", "").strip()
_preview_regex = os.environ.get("ALLOWED_ORIGIN_REGEX")  # e.g. https://.*-myteam\.vercel\.app

_cors_kwargs: dict = dict(
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    # so the browser can read the .xlsx download filename we set
    expose_headers=["Content-Disposition"],
)
if _allowed_origin:
    _cors_kwargs["allow_origins"] = [o.strip() for o in _allowed_origin.split(",") if o.strip()]
    if _preview_regex:
        _cors_kwargs["allow_origin_regex"] = _preview_regex
else:
    _cors_kwargs["allow_origins"] = ["*"]

app.add_middleware(CORSMiddleware, **_cors_kwargs)

# --- Reference data (loaded once at import) ------------------------------
_REF_PATH = Path(__file__).parent / "reference_data.json"
_REFERENCE = json.loads(_REF_PATH.read_text())
_AIRCRAFT_BY_ID = {a["id"]: a for a in _REFERENCE["aircraft"]}


@app.get("/")
def root() -> dict:
    """Liveness landing. Hitting the bare domain should say something useful."""
    return {
        "service": "Aircraft Financing Structure Comparator API",
        "status": "ok",
        "endpoints": ["/health", "/api/reference", "/api/market-context",
                      "/api/compare", "/api/export.xlsx"],
        "cors_allowed_origins": _cors_kwargs["allow_origins"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/reference", response_model=ReferenceResponse)
def reference() -> dict:
    return _REFERENCE


@app.get("/api/market-context", response_model=MarketContextResponse)
def get_market_context() -> dict:
    return market_data.market_context()


def _resolve_assumptions(req: CompareRequest) -> tuple[dict, str]:
    """Merge request assumptions and settle the reference rate.

    Precedence: an explicit ``reference_rate_pct`` override wins; else live
    SOFR if the toggle is on and a value is available; else the documented
    default. Shared by ``/api/compare`` and ``/api/export.xlsx`` so the two
    always agree.
    """
    assumptions = req.assumptions.model_dump(exclude_none=True) if req.assumptions else {}
    if "reference_rate_pct" in assumptions:
        return assumptions, "assumption_override"
    if req.use_live_sofr:
        live = market_data.live_sofr_pct()
        if live is not None:
            assumptions["reference_rate_pct"] = live
            return assumptions, "live_sofr"
    return assumptions, "assumption_default"


def _aircraft_label(aircraft_id: str | None) -> str:
    if aircraft_id and aircraft_id in _AIRCRAFT_BY_ID:
        return _AIRCRAFT_BY_ID[aircraft_id]["label"]
    return "Custom aircraft"


@app.post("/api/compare", response_model=CompareResponse)
def compare(req: CompareRequest) -> dict:
    assumptions, rate_source = _resolve_assumptions(req)

    try:
        outcome = fm.compare(
            delivery_price_usd_m=req.delivery_price_usd_m,
            market_value_usd_m=req.market_value_usd_m,
            tenor_years=req.tenor_years,
            gtf_adjustment=req.gtf_adjustment,
            assumptions=assumptions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results = [
        StructureOut(
            structure=r.structure,
            label=r.label,
            implied_annual_cost_pct=r.implied_annual_cost_pct,
            financed_pct_of_price=r.financed_pct_of_price,
            balance_sheet=r.balance_sheet,
            headline_note=r.headline_note,
            cashflow_schedule=r.cashflow_schedule,
            one_off_gain_usd_m=r.one_off_gain_usd_m,
            residual_value_usd_m=r.residual_value_usd_m,
            credit_metrics=dataclasses.asdict(r.credit_metrics)
            if r.credit_metrics
            else None,
        )
        for r in outcome["results"]
    ]

    return {
        "aircraft_id": req.aircraft_id,
        "gtf_adjustment_applied": outcome["gtf_adjustment_applied"],
        "reference_rate_pct_used": outcome["resolved_assumptions"].reference_rate_pct,
        "reference_rate_source": rate_source,
        "results": results,
        "cheapest": outcome["cheapest"],
    }


@app.post("/api/export.xlsx")
def export_xlsx(req: CompareRequest) -> Response:
    """Return the full working model as a formula-driven Excel workbook.

    Same inputs and same rate resolution as ``/api/compare``; the Python
    numbers are embedded as a cross-check next to the live Excel formulas.
    """
    assumptions, rate_source = _resolve_assumptions(req)

    try:
        outcome = fm.compare(
            delivery_price_usd_m=req.delivery_price_usd_m,
            market_value_usd_m=req.market_value_usd_m,
            tenor_years=req.tenor_years,
            gtf_adjustment=req.gtf_adjustment,
            assumptions=assumptions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        market = market_data.market_context()
    except Exception:  # provenance block is best-effort
        market = None

    workbook = excel_model.build_workbook(
        aircraft_label=_aircraft_label(req.aircraft_id),
        delivery_price_usd_m=req.delivery_price_usd_m,
        market_value_usd_m=req.market_value_usd_m,
        tenor_years=req.tenor_years,
        reference_rate_pct=outcome["resolved_assumptions"].reference_rate_pct,
        reference_rate_source=rate_source,
        gtf_adjustment=req.gtf_adjustment,
        resolved=outcome["resolved_assumptions"],
        results=outcome["results"],
        cheapest=outcome["cheapest"],
        market=market,
    )

    stamp = dt.date.today().isoformat()
    slug = (req.aircraft_id or "custom").replace("/", "-")
    filename = f"financing_model_{slug}_{stamp}.xlsx"
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Entrypoint. Railway (and most PaaS) inject $PORT. Reading it here in Python
# rather than relying on shell expansion in the start command means the app
# binds correctly whether or not the platform runs the command through a shell,
# which is the difference between booting and a 502.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    _port = int(os.environ.get("PORT", "8000"))
    print(
        f"[startup] binding 0.0.0.0:{_port} | "
        f"CORS allow_origins={_cors_kwargs['allow_origins']}",
        flush=True,
    )
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=_port,
        log_level=os.environ.get("LOG_LEVEL", "info"),
    )

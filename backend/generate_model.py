"""CLI: build the formula-driven Excel model without the web app.

Examples
--------
    python generate_model.py --aircraft a320neo --tenor 12 --live-sofr
    python generate_model.py --delivery 45 --market-value 48 --tenor 12 --gtf \
        --out ~/Desktop/a220_slb_vs_debt.xlsx

Reference-data aircraft ids: see reference_data.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import excel_model
import financial_model as fm
import market_data

_REF = json.loads((Path(__file__).parent / "reference_data.json").read_text())
_BY_ID = {a["id"]: a for a in _REF["aircraft"]}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--aircraft", help="reference id, e.g. a320neo (prefills price/value)")
    p.add_argument("--delivery", type=float, help="delivery price, $m")
    p.add_argument("--market-value", type=float, help="market value, $m")
    p.add_argument("--tenor", type=int, default=12, help="tenor in years (default 12)")
    p.add_argument("--reference-rate", type=float, help="base rate %% (assumption override)")
    p.add_argument("--live-sofr", action="store_true", help="pull live SOFR as the base rate")
    p.add_argument("--gtf", action="store_true", help="apply the GTF engine-risk adjustment")
    p.add_argument("--out", default="financing_model.xlsx", help="output path")
    args = p.parse_args(argv)

    ref = _BY_ID.get(args.aircraft) if args.aircraft else None
    if args.aircraft and ref is None:
        p.error(f"unknown aircraft id {args.aircraft!r}; choices: {', '.join(_BY_ID)}")

    delivery = args.delivery or (ref and ref["typical_delivery_price_usd_m"])
    market_value = args.market_value or (ref and ref["typical_market_value_usd_m"])
    if not delivery or not market_value:
        p.error("provide --aircraft, or both --delivery and --market-value")

    label = ref["label"] if ref else "Custom aircraft"

    assumptions: dict = {}
    rate_source = "assumption_default"
    if args.reference_rate is not None:
        assumptions["reference_rate_pct"] = args.reference_rate
        rate_source = "assumption_override"
    elif args.live_sofr:
        live = market_data.live_sofr_pct()
        if live is not None:
            assumptions["reference_rate_pct"] = live
            rate_source = "live_sofr"
        else:
            print("warning: live SOFR unavailable, using default assumption", file=sys.stderr)

    outcome = fm.compare(
        delivery_price_usd_m=delivery,
        market_value_usd_m=market_value,
        tenor_years=args.tenor,
        gtf_adjustment=args.gtf,
        assumptions=assumptions,
    )

    market = None
    if args.live_sofr:
        try:
            market = market_data.market_context()
        except Exception:
            market = None

    data = excel_model.build_workbook(
        aircraft_label=label,
        delivery_price_usd_m=delivery,
        market_value_usd_m=market_value,
        tenor_years=args.tenor,
        reference_rate_pct=outcome["resolved_assumptions"].reference_rate_pct,
        reference_rate_source=rate_source,
        gtf_adjustment=args.gtf,
        resolved=outcome["resolved_assumptions"],
        results=outcome["results"],
        cheapest=outcome["cheapest"],
        market=market,
    )

    out = Path(args.out).expanduser()
    out.write_bytes(data)

    print(f"wrote {out}  ({len(data):,} bytes)")
    for r in outcome["results"]:
        marker = "  <- cheapest" if r.structure == outcome["cheapest"] else ""
        print(f"  {r.label:32s} {r.implied_annual_cost_pct:5.2f}%{marker}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Integration test hitting the FastAPI app with a fixed payload."""

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_reference_shape():
    r = client.get("/api/reference")
    assert r.status_code == 200
    body = r.json()
    assert body["version"]
    assert len(body["aircraft"]) >= 4
    assert {"id", "label", "gtf_exposed"} <= set(body["aircraft"][0])


def test_compare_response_shape_and_cheapest():
    payload = {
        "aircraft_id": "a220-300",
        "delivery_price_usd_m": 45,
        "market_value_usd_m": 48,
        "tenor_years": 12,
        "gtf_adjustment": True,
        "assumptions": {"eca_ltv_pct": 0.85, "reference_rate_pct": 3.8},
    }
    r = client.post("/api/compare", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert len(body["results"]) == 4
    assert {x["structure"] for x in body["results"]} == {"eca_debt", "sll", "jolco", "slb"}
    assert body["reference_rate_source"] == "assumption_override"
    costs = {x["structure"]: x["implied_annual_cost_pct"] for x in body["results"]}
    assert body["cheapest"] == min(costs, key=costs.get)
    slb = next(x for x in body["results"] if x["structure"] == "slb")
    assert slb["balance_sheet"] == "off"
    assert "one_off_gain_usd_m" in slb
    for x in body["results"]:
        cm = x["credit_metrics"]
        assert cm is not None and cm["ltv_initial_pct"] > 0 and cm["wal_years"] > 0


def test_compare_rejects_bad_input():
    r = client.post("/api/compare", json={"delivery_price_usd_m": -1,
                                          "market_value_usd_m": 48, "tenor_years": 12})
    assert r.status_code == 422


def test_export_xlsx_returns_workbook_with_matching_irr():
    """The Excel export must open, carry the six tabs, and its live IRR
    formulas must recalculate to the same numbers the Python model returns."""
    import io
    import warnings

    from openpyxl import load_workbook

    payload = {
        "aircraft_id": "a220-300",
        "delivery_price_usd_m": 45,
        "market_value_usd_m": 48,
        "tenor_years": 12,
        "gtf_adjustment": True,
        "use_live_sofr": False,
        "assumptions": {"reference_rate_pct": 3.8},
    }
    compare = client.post("/api/compare", json=payload).json()
    py_costs = {x["structure"]: x["implied_annual_cost_pct"] for x in compare["results"]}

    r = client.post("/api/export.xlsx", json=payload)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "attachment" in r.headers["content-disposition"]

    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == [
        "Summary", "Assumptions", "ECA Debt", "SLL", "JOLCO", "SLB", "Comparison",
    ]

    # Recalculate the formulas the way Excel would and compare to Python.
    try:
        import formulas
    except ImportError:
        return  # optional dev dependency; shape checks above still ran
    warnings.filterwarnings("ignore")
    tmp = io.BytesIO(r.content)
    with open("/tmp/_export_test.xlsx", "wb") as fh:
        fh.write(r.content)
    sol = formulas.ExcelModel().loads("/tmp/_export_test.xlsx").finish().calculate()

    def cell(key_suffix: str) -> float:
        for k, v in sol.items():
            if k.upper().endswith(key_suffix.upper()):
                return float(v.value[0][0])
        raise KeyError(key_suffix)

    # Comparison rows are eca / sll / jolco / slb in B4..B7
    excel_eca = cell("COMPARISON'!B4") * 100
    excel_sll = cell("COMPARISON'!B5") * 100
    excel_jolco = cell("COMPARISON'!B6") * 100
    excel_slb = cell("COMPARISON'!B7") * 100
    assert abs(excel_eca - py_costs["eca_debt"]) < 0.05
    assert abs(excel_sll - py_costs["sll"]) < 0.05
    assert abs(excel_jolco - py_costs["jolco"]) < 0.05
    assert abs(excel_slb - py_costs["slb"]) < 0.05

    # This test is the cross-check: the workbook carries no pasted Python
    # numbers, so agreement is enforced here instead of asserted in a cell.
    def raw(key_suffix: str):
        for k, v in sol.items():
            if k.upper().endswith(key_suffix.upper()):
                return v.value[0][0]
        raise KeyError(key_suffix)

    # Every structure tab's formula integrity checks pass (Comparison F4..F7).
    for row in (4, 5, 6, 7):
        assert str(raw(f"COMPARISON'!F{row}")) == "OK", f"integrity check failed on row {row}"

    # Credit metrics are live formulas too (Comparison rows 17..20 = eca/sll/jolco/slb).
    cm = {x["structure"]: x["credit_metrics"] for x in compare["results"]}
    for row, key in zip((17, 18, 19, 20), ("eca_debt", "sll", "jolco", "slb")):
        m = cm[key]
        assert abs(cell(f"COMPARISON'!B{row}") * 100 - m["ltv_initial_pct"]) < 0.06
        assert abs(cell(f"COMPARISON'!D{row}") - m["dscr_asset_x"]) < 0.006
        assert abs(cell(f"COMPARISON'!E{row}") - m["wal_years"]) < 0.06
        if m["ltv_midlife_pct"] is not None:
            assert abs(cell(f"COMPARISON'!C{row}") * 100 - m["ltv_midlife_pct"]) < 0.06
        if m["balloon_pct"] is not None:
            assert abs(cell(f"COMPARISON'!F{row}") * 100 - m["balloon_pct"]) < 0.06

    # The headline and its caveat are live lookups, not text written at export.
    py_cheapest = next(x["label"] for x in compare["results"] if x["structure"] == compare["cheapest"])
    assert raw("COMPARISON'!B10") == py_cheapest
    assert "execute" in str(raw("COMPARISON'!B13")) or "agency" in str(raw("COMPARISON'!B13"))

"""Formula-driven Excel model export.

Produces a multi-tab .xlsx workbook that mirrors ``financial_model.py`` but as
*live Excel formulas*, so a reader can open it and flex every input in Excel
without touching the API:

    Summary        one-page read: inputs, the three implied costs, the winner
    Assumptions    every input in one place (blue = editable input cell)
    ECA Debt       full amortisation schedule + IRR
    SLL            full amortisation schedule + IRR
    SLB            sale, rentals, residual give-up + IRR
    Comparison     the three structures side by side, with a chart, plus a
                   cross-check of the live Excel IRR against the Python model

Cross-sheet references all point back at the Assumptions tab, and the GTF
toggle there (1/0) drives the margin add-ons and value haircuts through
``IF(...)`` formulas, so the whole workbook reacts to it.
"""

from __future__ import annotations

import datetime as _dt
from io import BytesIO

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.axis import ChartLines
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

import financial_model as fm

# --- house style ---------------------------------------------------------

GS_INK = "12263A"
GS_BLUE = "7399C6"
GS_BLUE_DEEP = "2E5E8C"
GS_TINT = "EDF2F8"
GS_LINE = "D7DCE2"

_F_TITLE = Font(name="Calibri", size=16, bold=True, color=GS_INK)
_F_EYEBROW = Font(name="Calibri", size=9, bold=True, color="5B6B7B")
_F_SECTION = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
_F_LABEL = Font(name="Calibri", size=10, color=GS_INK)
_F_INPUT = Font(name="Calibri", size=10, bold=True, color=GS_BLUE_DEEP)
_F_CALC = Font(name="Calibri", size=10, color=GS_INK)
_F_CALC_BOLD = Font(name="Calibri", size=10, bold=True, color=GS_INK)
_F_NOTE = Font(name="Calibri", size=9, italic=True, color="5B6B7B")

_FILL_SECTION = PatternFill("solid", fgColor=GS_BLUE_DEEP)
_FILL_INPUT = PatternFill("solid", fgColor=GS_TINT)
_FILL_HEAD = PatternFill("solid", fgColor=GS_INK)

_THIN = Side(style="thin", color=GS_LINE)
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)

_NUM_USD = '#,##0.00'
_NUM_USD0 = '#,##0'
_NUM_PCT = '0.00%'
_NUM_PCT1 = '0.0%'
_NUM_RATE = '0.00'
_NUM_INT = '0'
_NUM_FRAC = '0.000'

_HEADER_FONT_ON_INK = Font(name="Calibri", size=10, bold=True, color="FFFFFF")


def _set(ws: Worksheet, cell: str, value, *, font=_F_CALC, num=None, fill=None,
         align=None, border=False):
    c = ws[cell]
    c.value = value
    c.font = font
    if num:
        c.number_format = num
    if fill:
        c.fill = fill
    if align:
        c.alignment = Alignment(horizontal=align)
    if border:
        c.border = _BORDER
    return c


def _section(ws: Worksheet, row: int, text: str, span: int = 4):
    for i in range(1, span + 1):
        ws.cell(row=row, column=i).fill = _FILL_SECTION
    c = ws.cell(row=row, column=1, value=text)
    c.font = _F_SECTION


# --- Assumptions tab: the single source of inputs -----------------------

# Maps a logical key to the address of its value cell on the Assumptions tab.
# Everything else in the workbook references these.
A = "Assumptions"
REF: dict[str, str] = {}


def _build_assumptions(ws: Worksheet, *, aircraft_label: str, delivery: float,
                       market_value: float, tenor: int, reference_rate_pct: float,
                       reference_rate_source: str, gtf: bool,
                       a: fm.Assumptions) -> None:
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 40

    _set(ws, "A1", "Assumptions", font=_F_TITLE)
    _set(ws, "A2", "Blue cells are inputs. Everything else references them.", font=_F_NOTE)

    rows: list[tuple] = [
        ("SECTION", "Deal inputs"),
        ("aircraft", "Aircraft type", aircraft_label, None, "text"),
        ("delivery", "Delivery price", delivery, _NUM_USD, "$m"),
        ("market_value", "Market value", market_value, _NUM_USD, "$m"),
        ("tenor", "Tenor", tenor, _NUM_INT, "years"),
        ("reference_rate_pct", "Reference rate (base)", reference_rate_pct, _NUM_RATE,
         f"%  |  source: {reference_rate_source.replace('_', ' ')}"),
        ("gtf", "GTF adjustment applied", 1 if gtf else 0, _NUM_INT, "1 = yes, 0 = no"),
        ("SECTION", "ECA-backed debt"),
        ("eca_ltv_pct", "ECA loan-to-value", a.eca_ltv_pct, _NUM_FRAC, "fraction of price"),
        ("eca_base_margin_bps", "ECA base margin", a.eca_base_margin_bps, _NUM_INT, "bps over base"),
        ("eca_guarantee_fee_pct", "ECA guarantee fee", a.eca_guarantee_fee_pct, _NUM_RATE,
         "% of loan, straight-line over tenor"),
        ("SECTION", "Sustainability-linked loan"),
        ("sll_ltv_pct", "SLL loan-to-value", a.sll_ltv_pct, _NUM_FRAC, "fraction of price"),
        ("sll_base_margin_bps", "SLL base margin", a.sll_base_margin_bps, _NUM_INT, "bps over base"),
        ("sll_kpi_ratchet_bps", "SLL KPI ratchet", a.sll_kpi_ratchet_bps, _NUM_INT,
         "bps; base case assumes KPI met (favourable)"),
        ("SECTION", "Sale-and-leaseback"),
        ("slb_lease_rate_factor_pct", "SLB lease rate factor", a.slb_lease_rate_factor_pct,
         _NUM_RATE, "% of value, monthly (annual = value x LRF% x 12)"),
        ("slb_residual_value_pct", "SLB residual value override", a.slb_residual_value_pct,
         _NUM_RATE, "% of price; 0 = derive from tenor"),
        ("SECTION", "JOLCO (Japanese tax lease)"),
        ("jolco_ltv_pct", "JOLCO loan-to-value", a.jolco_ltv_pct, _NUM_FRAC,
         "fraction of price funded via the SPC"),
        ("jolco_base_margin_bps", "JOLCO senior margin", a.jolco_base_margin_bps, _NUM_INT,
         "bps over base"),
        ("jolco_tax_benefit_bps", "JOLCO tax benefit", a.jolco_tax_benefit_bps, _NUM_INT,
         "bps rebated into rentals from Japanese tax equity"),
        ("jolco_call_year", "JOLCO call year", int(a.jolco_call_year), _NUM_INT,
         "year the airline exercises the purchase option"),
        ("SECTION", "GTF engine-risk"),
        ("gtf_margin_addon_bps", "GTF margin add-on", a.gtf_margin_addon_bps, _NUM_INT,
         "bps added to debt margin when GTF = 1"),
        ("gtf_value_haircut_pct", "GTF value haircut", a.gtf_value_haircut_pct, _NUM_RATE,
         "% off sale price and residual when GTF = 1"),
    ]

    r = 4
    for entry in rows:
        if entry[0] == "SECTION":
            _section(ws, r, entry[1], span=3)
            r += 1
            continue
        key, label, value, num, note = entry
        _set(ws, f"A{r}", label, font=_F_LABEL)
        cell = _set(ws, f"B{r}", value, font=_F_INPUT, num=num, fill=_FILL_INPUT, border=True)
        cell.alignment = Alignment(horizontal="right" if num else "left")
        _set(ws, f"C{r}", note, font=_F_NOTE)
        REF[key] = f"'{A}'!$B${r}"
        r += 1


# --- helpers for building a debt-structure schedule --------------------


def _gtf_addon_expr() -> str:
    return f"IF({REF['gtf']}=1,{REF['gtf_margin_addon_bps']},0)"


def _fit_wide(ws: Worksheet) -> None:
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def _debt_sheet(ws: Worksheet, *, title: str, ltv_ref: str, margin_bps_expr: str,
                tenor: int, guarantee_fee_ref: str | None,
                python_irr_pct: float) -> str:
    """Build an amortising-loan tab. Returns the address of its IRR cell.

    Layout: column A is a wide row-label gutter (summary labels overflow the
    empty column B), summary values sit in column C, and the amortisation
    schedule runs across columns A to F below.
    """
    _fit_wide(ws)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 13
    for col in ("C", "D", "E", "F"):
        ws.column_dimensions[col].width = 15

    _set(ws, "A1", title, font=_F_TITLE)

    _set(ws, "A3", "Loan amount", font=_F_LABEL)
    _set(ws, "C3", f"={REF['delivery']}*{ltv_ref}", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A4", "All-in rate", font=_F_LABEL)
    _set(ws, "C4",
         f"={REF['reference_rate_pct']}/100+({margin_bps_expr})/10000",
         font=_F_CALC_BOLD, num=_NUM_PCT)
    _set(ws, "A5", "Annual debt service", font=_F_LABEL)
    _set(ws, "C5", f"=-PMT($C$4,{REF['tenor']},$C$3)", font=_F_CALC_BOLD, num=_NUM_USD)

    fee_annual_ref = None
    if guarantee_fee_ref is not None:
        _set(ws, "A6", "Guarantee fee, total", font=_F_LABEL)
        _set(ws, "C6", f"=$C$3*{guarantee_fee_ref}/100", font=_F_CALC, num=_NUM_USD)
        _set(ws, "A7", "Guarantee fee, per year", font=_F_LABEL)
        _set(ws, "C7", f"=$C$6/{REF['tenor']}", font=_F_CALC, num=_NUM_USD)
        fee_annual_ref = "$C$7"

    head_row = 9
    headers = ["Year", "Opening", "Interest", "Principal", "Debt service", "Incremental CF"]
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=head_row, column=i, value=h)
        c.font = _HEADER_FONT_ON_INK
        c.fill = _FILL_HEAD
        c.alignment = Alignment(horizontal="center")

    first = head_row + 1
    # Year 0: the airline receives the loan (positive incremental cashflow).
    ws.cell(row=first, column=1, value=0).font = _F_CALC
    ws.cell(row=first, column=2, value="=$C$3").number_format = _NUM_USD
    ws.cell(row=first, column=6, value="=$C$3").number_format = _NUM_USD
    ws.cell(row=first, column=6).font = _F_CALC_BOLD

    for y in range(1, tenor + 1):
        row = first + y
        prev = row - 1
        ws.cell(row=row, column=1, value=y).font = _F_CALC
        # opening = previous closing (previous opening - previous principal)
        ws.cell(row=row, column=2, value=(f"=B{prev}" if y == 1 else f"=B{prev}-D{prev}"))
        ws.cell(row=row, column=3, value=f"=B{row}*$C$4")           # interest
        ws.cell(row=row, column=4, value=f"=$C$5-C{row}")            # principal
        ws.cell(row=row, column=5, value="=$C$5")                    # debt service
        if fee_annual_ref:
            ws.cell(row=row, column=6, value=f"=-($C$5+{fee_annual_ref})")
        else:
            ws.cell(row=row, column=6, value="=-$C$5")
        for col in range(2, 7):
            ws.cell(row=row, column=col).number_format = _NUM_USD
            ws.cell(row=row, column=col).font = _F_CALC

    last = first + tenor
    cf_range = f"F{first}:F{last}"

    irr_row = last + 2
    _set(ws, f"A{irr_row}", "Implied annual cost, Excel IRR", font=_F_CALC_BOLD)
    irr_cell = f"C{irr_row}"
    _set(ws, irr_cell, f"=IRR({cf_range})", font=_F_CALC_BOLD, num=_NUM_PCT)
    _set(ws, f"A{irr_row + 1}", "Python model, cross-check", font=_F_NOTE)
    _set(ws, f"C{irr_row + 1}", python_irr_pct / 100.0, font=_F_NOTE, num=_NUM_PCT)

    ws.freeze_panes = ws[f"A{first}"]
    return f"'{ws.title}'!{irr_cell}"


def _jolco_sheet(ws: Worksheet, *, tenor: int, call_year: int,
                 python_irr_pct: float) -> str:
    """JOLCO tab: a senior amortization at the tax-adjusted effective rate,
    paid to the call year, then the outstanding balance settled as the call
    price. The schedule is built for the resolved call year (like tenor drives
    the other tabs)."""
    _fit_wide(ws)
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 13
    for col in ("C", "D", "E", "F"):
        ws.column_dimensions[col].width = 15

    _set(ws, "A1", "JOLCO (Japanese Tax Lease)", font=_F_TITLE)

    _set(ws, "A3", "Advance (via SPC)", font=_F_LABEL)
    _set(ws, "C3", f"={REF['delivery']}*{REF['jolco_ltv_pct']}", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A4", "Gross senior rate", font=_F_LABEL)
    _set(ws, "C4",
         f"={REF['reference_rate_pct']}/100+({REF['jolco_base_margin_bps']}+{_gtf_addon_expr()})/10000",
         font=_F_CALC, num=_NUM_PCT)
    _set(ws, "A5", "Effective rate (after tax benefit)", font=_F_LABEL)
    _set(ws, "C5", f"=$C$4-{REF['jolco_tax_benefit_bps']}/10000", font=_F_CALC_BOLD, num=_NUM_PCT)
    _set(ws, "A6", "Annual rental", font=_F_LABEL)
    _set(ws, "C6", f"=-PMT($C$5,{REF['tenor']},$C$3)", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A7", "Call year", font=_F_LABEL)
    _set(ws, "C7", f"={REF['jolco_call_year']}", font=_F_CALC, num=_NUM_INT)

    head_row = 9
    for i, h in enumerate(
        ["Year", "Opening", "Interest", "Principal", "Rental", "Incremental CF"], start=1
    ):
        c = ws.cell(row=head_row, column=i, value=h)
        c.font = _HEADER_FONT_ON_INK
        c.fill = _FILL_HEAD
        c.alignment = Alignment(horizontal="center")

    first = head_row + 1
    ws.cell(row=first, column=1, value=0).font = _F_CALC
    ws.cell(row=first, column=2, value="=$C$3").number_format = _NUM_USD
    ws.cell(row=first, column=6, value="=$C$3").number_format = _NUM_USD
    ws.cell(row=first, column=6).font = _F_CALC_BOLD

    for y in range(1, call_year + 1):
        row = first + y
        prev = row - 1
        ws.cell(row=row, column=1, value=y).font = _F_CALC
        ws.cell(row=row, column=2, value=(f"=B{prev}" if y == 1 else f"=B{prev}-D{prev}"))
        ws.cell(row=row, column=3, value=f"=B{row}*$C$5")   # interest
        ws.cell(row=row, column=4, value=f"=$C$6-C{row}")   # principal
        ws.cell(row=row, column=5, value="=$C$6")           # rental
        if y == call_year:
            # rental plus the call price (the balance still outstanding)
            ws.cell(row=row, column=6, value=f"=-$C$6-(B{row}-D{row})")
        else:
            ws.cell(row=row, column=6, value="=-$C$6")
        for col in range(2, 7):
            ws.cell(row=row, column=col).number_format = _NUM_USD
            ws.cell(row=row, column=col).font = _F_CALC

    last = first + call_year
    irr_row = last + 2
    _set(ws, f"A{irr_row}", "Implied annual cost, Excel IRR", font=_F_CALC_BOLD)
    irr_cell = f"C{irr_row}"
    _set(ws, irr_cell, f"=IRR(F{first}:F{last})", font=_F_CALC_BOLD, num=_NUM_PCT)
    _set(ws, f"A{irr_row + 1}", "Python model, cross-check", font=_F_NOTE)
    _set(ws, f"C{irr_row + 1}", python_irr_pct / 100.0, font=_F_NOTE, num=_NUM_PCT)

    ws.freeze_panes = ws[f"A{first}"]
    return f"'{ws.title}'!{irr_cell}"


def _slb_sheet(ws: Worksheet, *, tenor: int, python_irr_pct: float,
               python_gain: float) -> str:
    _fit_wide(ws)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 13
    for col in ("C", "D", "E"):
        ws.column_dimensions[col].width = 16

    _set(ws, "A1", "Sale-and-Leaseback", font=_F_TITLE)

    haircut = f"IF({REF['gtf']}=1,{REF['gtf_value_haircut_pct']}/100,0)"
    _set(ws, "A3", "Sale price", font=_F_LABEL)
    _set(ws, "C3", f"={REF['market_value']}*(1-{haircut})", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A4", "Annual lease rental", font=_F_LABEL)
    _set(ws, "C4", f"=$C$3*{REF['slb_lease_rate_factor_pct']}/100*12", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A5", "Residual retention factor", font=_F_LABEL)
    _set(ws, "C5", f"=MAX(0.15,1-{REF['tenor']}*0.045)", font=_F_CALC, num=_NUM_PCT)
    _set(ws, "A6", "Residual forgone at lease end", font=_F_LABEL)
    _set(ws, "C6",
         f"=IF({REF['slb_residual_value_pct']}>0,"
         f"{REF['delivery']}*{REF['slb_residual_value_pct']}/100,"
         f"{REF['delivery']}*$C$5)*(1-{haircut})",
         font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "A7", "One-off gain / (loss) on sale", font=_F_LABEL)
    _set(ws, "C7", f"=$C$3-{REF['delivery']}", font=_F_CALC_BOLD, num=_NUM_USD)
    _set(ws, "D7", f"Python: {python_gain:+.2f}", font=_F_NOTE)

    head_row = 9
    for i, h in enumerate(["Year", "Rental", "Residual", "Incremental CF"], start=1):
        c = ws.cell(row=head_row, column=i, value=h)
        c.font = _HEADER_FONT_ON_INK
        c.fill = _FILL_HEAD
        c.alignment = Alignment(horizontal="center")

    first = head_row + 1
    ws.cell(row=first, column=1, value=0).font = _F_CALC
    ws.cell(row=first, column=4, value="=$C$3").number_format = _NUM_USD
    ws.cell(row=first, column=4).font = _F_CALC_BOLD

    for y in range(1, tenor + 1):
        row = first + y
        ws.cell(row=row, column=1, value=y).font = _F_CALC
        ws.cell(row=row, column=2, value="=-$C$4")
        if y == tenor:
            ws.cell(row=row, column=3, value="=-$C$6")
            ws.cell(row=row, column=4, value="=-$C$4-$C$6")
        else:
            ws.cell(row=row, column=3, value=0)
            ws.cell(row=row, column=4, value="=-$C$4")
        for col in range(2, 5):
            ws.cell(row=row, column=col).number_format = _NUM_USD
            ws.cell(row=row, column=col).font = _F_CALC

    last = first + tenor
    irr_row = last + 2
    _set(ws, f"A{irr_row}", "Implied annual cost, Excel IRR", font=_F_CALC_BOLD)
    irr_cell = f"C{irr_row}"
    _set(ws, irr_cell, f"=IRR(D{first}:D{last})", font=_F_CALC_BOLD, num=_NUM_PCT)
    _set(ws, f"A{irr_row + 1}", "Python model, cross-check", font=_F_NOTE)
    _set(ws, f"C{irr_row + 1}", python_irr_pct / 100.0, font=_F_NOTE, num=_NUM_PCT)

    ws.freeze_panes = ws[f"A{first}"]
    return f"'{ws.title}'!{irr_cell}"


def _build_comparison(ws: Worksheet, rows: list[dict], cheapest_label: str) -> None:
    _fit_wide(ws)
    ws.column_dimensions["A"].width = 30
    for col in ("B", "C", "D", "E"):
        ws.column_dimensions[col].width = 18

    _set(ws, "A1", "Comparison", font=_F_TITLE)

    head = 3
    for i, h in enumerate(
        ["Structure", "Implied annual cost", "Financed % of price", "Balance sheet", "Python model"],
        start=1,
    ):
        c = ws.cell(row=head, column=i, value=h)
        c.font = _HEADER_FONT_ON_INK
        c.fill = _FILL_HEAD
        c.alignment = Alignment(horizontal="center")

    start = head + 1
    for j, row in enumerate(rows):
        r = start + j
        _set(ws, f"A{r}", row["label"], font=_F_LABEL, border=True)
        _set(ws, f"B{r}", f"={row['irr_ref']}", font=_F_CALC_BOLD, num=_NUM_PCT, border=True)
        _set(ws, f"C{r}", row["financed_pct"] / 100.0, font=_F_CALC, num=_NUM_PCT1, border=True)
        _set(ws, f"D{r}", "On" if row["balance_sheet"] == "on" else "Off", font=_F_CALC, border=True)
        _set(ws, f"E{r}", row["python_pct"] / 100.0, font=_F_NOTE, num=_NUM_PCT, border=True)
    end = start + len(rows) - 1

    _set(ws, f"A{end + 2}", "Cheapest (lowest all-in cost)", font=_F_CALC_BOLD)
    _set(ws, f"B{end + 2}",
         f"=INDEX(A{start}:A{end},MATCH(MIN(B{start}:B{end}),B{start}:B{end},0))",
         font=_F_CALC_BOLD)
    _set(ws, f"A{end + 3}", f"Python model says: {cheapest_label}", font=_F_NOTE)

    # --- credit metrics block (model output, not live formulas) ---
    m_head = end + 5
    _set(ws, f"A{m_head - 1}", "Credit metrics (model output)", font=_F_CALC_BOLD)
    for i, h in enumerate(
        ["Structure", "Initial LTV", "LTV mid-life", "Asset DSCR", "WAL (yrs)", "Balloon"],
        start=1,
    ):
        c = ws.cell(row=m_head, column=i, value=h)
        c.font = _HEADER_FONT_ON_INK
        c.fill = _FILL_HEAD
        c.alignment = Alignment(horizontal="center")
    for j, row in enumerate(rows):
        r = m_head + 1 + j
        m = row.get("metrics")
        _set(ws, f"A{r}", row["label"], font=_F_LABEL, border=True)
        if m is None:
            continue
        _set(ws, f"B{r}", m.ltv_initial_pct / 100.0, font=_F_CALC, num=_NUM_PCT1, border=True)
        _set(ws, f"C{r}",
             m.ltv_midlife_pct / 100.0 if m.ltv_midlife_pct is not None else "n/a",
             font=_F_CALC, num=_NUM_PCT1 if m.ltv_midlife_pct is not None else None,
             border=True)
        _set(ws, f"D{r}",
             f"{m.dscr_asset_x:.2f}x" if m.dscr_asset_x is not None else "n/a",
             font=_F_CALC, border=True)
        _set(ws, f"E{r}", m.wal_years, font=_F_CALC, num=_NUM_RATE, border=True)
        _set(ws, f"F{r}",
             m.balloon_pct / 100.0 if m.balloon_pct is not None else "n/a",
             font=_F_CALC, num=_NUM_PCT1 if m.balloon_pct is not None else None,
             border=True)
    m_end = m_head + len(rows)

    chart = BarChart()
    chart.type = "col"
    chart.title = "Implied all-in annual financing cost"
    chart.legend = None
    data = Reference(ws, min_col=2, min_row=head, max_row=end)
    cats = Reference(ws, min_col=1, min_row=start, max_row=end)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)

    # openpyxl leaves axis `delete` unset, which Excel reads as "hide the axis",
    # so the chart renders as bare bars with no category or value labels. These
    # have to be switched on explicitly.
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    chart.x_axis.title = "Structure"
    chart.y_axis.title = "Implied annual cost"
    chart.y_axis.numFmt = _NUM_PCT
    chart.x_axis.tickLblPos = "low"
    chart.y_axis.tickLblPos = "nextTo"
    chart.y_axis.majorGridlines = ChartLines()
    chart.gapWidth = 60

    chart.height = 8
    chart.width = 16
    ws.add_chart(chart, f"A{m_end + 2}")


def _build_summary(ws: Worksheet, *, aircraft_label: str, tenor: int,
                   gtf: bool, comparison_rows: list[dict], cheapest_label: str,
                   market: dict | None, generated: str) -> None:
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 30

    _set(ws, "A1", "Aircraft Financing Structure Comparator", font=_F_TITLE)
    _set(ws, "A2", "Implied all-in annual financing cost of four real structures", font=_F_NOTE)
    _set(ws, "A3", f"Generated {generated}", font=_F_NOTE)

    _section(ws, 5, "Deal", span=3)
    _set(ws, "A6", "Aircraft", font=_F_LABEL)
    _set(ws, "B6", aircraft_label, font=_F_CALC_BOLD)
    _set(ws, "A7", "Delivery price ($m)", font=_F_LABEL)
    _set(ws, "B7", f"={REF['delivery']}", font=_F_CALC, num=_NUM_USD)
    _set(ws, "A8", "Market value ($m)", font=_F_LABEL)
    _set(ws, "B8", f"={REF['market_value']}", font=_F_CALC, num=_NUM_USD)
    _set(ws, "A9", "Tenor (years)", font=_F_LABEL)
    _set(ws, "B9", f"={REF['tenor']}", font=_F_CALC, num=_NUM_INT)
    _set(ws, "A10", "Reference rate (%)", font=_F_LABEL)
    _set(ws, "B10", f"={REF['reference_rate_pct']}", font=_F_CALC, num=_NUM_RATE)
    _set(ws, "A11", "GTF adjustment", font=_F_LABEL)
    _set(ws, "B11", "Applied" if gtf else "Not applied", font=_F_CALC)

    _section(ws, 13, "Implied all-in annual cost", span=3)
    r = 14
    for row in comparison_rows:
        _set(ws, f"A{r}", row["label"], font=_F_LABEL)
        _set(ws, f"B{r}", f"={row['irr_ref']}", font=_F_CALC_BOLD, num=_NUM_PCT)
        short = row["note"].split(". ")[0].rstrip(".") + "."
        _set(ws, f"C{r}", short, font=_F_NOTE)
        r += 1
    _set(ws, f"A{r}", "Cheapest", font=_F_CALC_BOLD)
    _set(ws, f"B{r}", cheapest_label, font=_F_CALC_BOLD)

    r += 2
    _section(ws, r, "Data provenance", span=3)
    r += 1
    if market:
        _set(ws, f"A{r}", "SOFR (NY Fed)", font=_F_LABEL)
        sofr = market.get("sofr_pct")
        _set(ws, f"B{r}", f"{sofr:.2f}%" if sofr is not None else "n/a", font=_F_CALC)
        _set(ws, f"C{r}", f"as of {market.get('sofr_as_of') or 'n/a'}", font=_F_NOTE)
        r += 1
        estr = market.get("eur_str_pct")
        if estr is not None:
            _set(ws, f"A{r}", "€STR (ECB)", font=_F_LABEL)
            _set(ws, f"B{r}", f"{estr:.2f}%", font=_F_CALC)
            r += 1
    _set(ws, f"A{r}", "Live", font=_F_LABEL)
    _set(ws, f"B{r}", "SOFR, €STR, AF.PA, EUR/USD", font=_F_NOTE)
    r += 1
    _set(ws, f"A{r}", "Sourced assumptions (not live)", font=_F_LABEL)
    _set(ws, f"B{r}", "ECA fee, SLL ratchet, SLB LRF, JOLCO tax benefit, GTF add-on/haircut",
         font=_F_NOTE)
    r += 2
    _set(ws, f"A{r}", "Indicative model for structure comparison. Not a valuation, "
         "not investment advice.", font=_F_NOTE)


# --- public entry point -------------------------------------------------


def build_workbook(*, aircraft_label: str, delivery_price_usd_m: float,
                   market_value_usd_m: float, tenor_years: int,
                   reference_rate_pct: float, reference_rate_source: str,
                   gtf_adjustment: bool, resolved: fm.Assumptions,
                   results: list[fm.StructureResult], cheapest: str,
                   market: dict | None = None) -> bytes:
    REF.clear()
    wb = Workbook()
    wb.calculation.fullCalcOnLoad = True
    wb.properties.creator = "Aircraft Financing Structure Comparator"
    wb.properties.title = f"Financing model - {aircraft_label}"

    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_assumptions = wb.create_sheet("Assumptions")
    ws_eca = wb.create_sheet("ECA Debt")
    ws_sll = wb.create_sheet("SLL")
    ws_jolco = wb.create_sheet("JOLCO")
    ws_slb = wb.create_sheet("SLB")
    ws_cmp = wb.create_sheet("Comparison")

    _build_assumptions(
        ws_assumptions,
        aircraft_label=aircraft_label,
        delivery=delivery_price_usd_m,
        market_value=market_value_usd_m,
        tenor=tenor_years,
        reference_rate_pct=reference_rate_pct,
        reference_rate_source=reference_rate_source,
        gtf=gtf_adjustment,
        a=resolved,
    )

    by_id = {r.structure: r for r in results}

    eca_irr_ref = _debt_sheet(
        ws_eca, title="ECA-Backed Term Loan",
        ltv_ref=REF["eca_ltv_pct"],
        margin_bps_expr=f"{REF['eca_base_margin_bps']}+{_gtf_addon_expr()}",
        tenor=tenor_years,
        guarantee_fee_ref=REF["eca_guarantee_fee_pct"],
        python_irr_pct=by_id["eca_debt"].implied_annual_cost_pct,
    )
    sll_irr_ref = _debt_sheet(
        ws_sll, title="Sustainability-Linked Loan",
        ltv_ref=REF["sll_ltv_pct"],
        margin_bps_expr=(
            f"{REF['sll_base_margin_bps']}-{REF['sll_kpi_ratchet_bps']}+{_gtf_addon_expr()}"
        ),
        tenor=tenor_years,
        guarantee_fee_ref=None,
        python_irr_pct=by_id["sll"].implied_annual_cost_pct,
    )
    jolco_call_year = int(min(max(1, round(resolved.jolco_call_year)), tenor_years))
    jolco_irr_ref = _jolco_sheet(
        ws_jolco, tenor=tenor_years, call_year=jolco_call_year,
        python_irr_pct=by_id["jolco"].implied_annual_cost_pct,
    )
    slb_irr_ref = _slb_sheet(
        ws_slb, tenor=tenor_years,
        python_irr_pct=by_id["slb"].implied_annual_cost_pct,
        python_gain=by_id["slb"].one_off_gain_usd_m or 0.0,
    )

    irr_refs = {
        "eca_debt": eca_irr_ref,
        "sll": sll_irr_ref,
        "jolco": jolco_irr_ref,
        "slb": slb_irr_ref,
    }
    comparison_rows = [
        {
            "label": r.label,
            "irr_ref": irr_refs[r.structure],
            "financed_pct": r.financed_pct_of_price,
            "balance_sheet": r.balance_sheet,
            "python_pct": r.implied_annual_cost_pct,
            "note": r.headline_note,
            "metrics": r.credit_metrics,
        }
        for r in results
    ]
    cheapest_label = by_id[cheapest].label

    _build_comparison(ws_cmp, comparison_rows, cheapest_label)
    _build_summary(
        ws_summary,
        aircraft_label=aircraft_label,
        tenor=tenor_years,
        gtf=gtf_adjustment,
        comparison_rows=comparison_rows,
        cheapest_label=cheapest_label,
        market=market,
        generated=_dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    )

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

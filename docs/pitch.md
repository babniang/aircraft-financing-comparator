# 30-second pitch

When a desk structures an aircraft purchase, the first question is always the
same. Which financing structure is actually cheapest, all-in? That answer
normally lives in someone's spreadsheet.

This tool does it on a phone in 90 seconds. You pick an aircraft, a price, and a
tenor, and it returns the implied all-in annual cost of three real structures:
ECA-backed debt, a sustainability-linked loan, and a sale-and-leaseback. It
computes them the honest way, running an IRR on each structure's incremental
cash flows versus paying cash, so they are genuinely comparable even though they
finance different amounts. It also shows balance-sheet treatment and a one-tap
engine-risk adjustment for GTF-exposed fleets.

The financial model is real Python, unit-tested, in the repo. It also exports a
fully formatted Excel workbook with live PMT, IRR and NPV formulas, so the
numbers stay editable in Excel rather than being a static dump. Reference rates
are live: SOFR from the NY Fed, €STR from the ECB. Everything that is not public
data, such as guarantee fees, margins and lease rate factors, is a clearly
labelled, sourced, editable assumption, never faked to look live.

It runs in English and French, covers 18 aircraft types, and explains the GTF
engine-recall risk it prices in.

One link, opens on a phone, exports a working model, and it survives someone in
the desk asking a follow-up question.

"""Live market data layer.

Principle (see spec section 3.7): use genuinely official, free, live sources
for what they actually cover - reference rates, FX, equity price - and label
everything else as a sourced, editable assumption rather than pretend it's live.

Everything here degrades gracefully: a failed fetch serves the last cached
value with its timestamp rather than erroring the caller. A cold cache with a
dead upstream returns ``None`` for that field and ``stale=True`` overall.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import threading
import time
from typing import Any, Callable, Optional

import httpx

_CACHE_TTL_SECONDS = 20 * 60  # 20 minutes - desks don't hammer upstreams
_HTTP_TIMEOUT = 6.0

_lock = threading.Lock()
_cache: dict[str, dict[str, Any]] = {}
# each entry: {"value": Any, "fetched_at": float (epoch), "as_of": str}


def _get_cached(key: str) -> Optional[dict[str, Any]]:
    entry = _cache.get(key)
    if not entry:
        return None
    entry = dict(entry)
    entry["fresh"] = (time.time() - entry["fetched_at"]) < _CACHE_TTL_SECONDS
    return entry


def _store(key: str, value: Any, as_of: str) -> dict[str, Any]:
    entry = {"value": value, "fetched_at": time.time(), "as_of": as_of, "fresh": True}
    with _lock:
        _cache[key] = {"value": value, "fetched_at": entry["fetched_at"], "as_of": as_of}
    return entry


def _cached_or_fetch(key: str, fetcher: Callable[[], tuple[Any, str]]) -> Optional[dict[str, Any]]:
    """Return a cache entry dict {value, as_of, fresh, fetched_at}.

    If the cached copy is still fresh, return it without touching the network.
    Otherwise try to refresh; on failure fall back to any stale cached copy.
    """
    cached = _get_cached(key)
    if cached and cached["fresh"]:
        return cached
    try:
        value, as_of = fetcher()
        return _store(key, value, as_of)
    except Exception:
        return cached  # stale-but-labeled, or None on a cold cache


# ---------------------------------------------------------------------------
# Individual sources
# ---------------------------------------------------------------------------


def _fetch_sofr() -> tuple[float, str]:
    """Latest published SOFR from the NY Fed - official primary source, no key."""
    end = dt.date.today()
    start = end - dt.timedelta(days=10)
    url = (
        "https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv"
        f"?startDate={start:%m/%d/%Y}&endDate={end:%m/%d/%Y}"
    )
    resp = httpx.get(url, timeout=_HTTP_TIMEOUT, follow_redirects=True)
    resp.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    if not rows:
        raise ValueError("no SOFR rows returned")
    # The API returns most-recent first; be defensive and sort by date.
    def _row_date(r: dict) -> str:
        return r.get("Effective Date") or r.get("effectiveDate") or ""

    def _row_rate(r: dict) -> str:
        return r.get("Rate (%)") or r.get("percentRate") or r.get("Rate") or ""

    rows.sort(key=_row_date, reverse=True)
    latest = rows[0]
    return float(_row_rate(latest)), _row_date(latest)


def _fetch_eur_str() -> tuple[float, str]:
    """Latest €STR observation from the ECB Data Portal (SDW successor).

    Series: EST / B.EU000A2X2A25.WT (€STR volume-weighted trimmed mean rate).
    Verified against the ECB Data Portal series catalogue.
    """
    url = (
        "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT"
        "?lastNObservations=1&format=csvdata"
    )
    resp = httpx.get(url, timeout=_HTTP_TIMEOUT, follow_redirects=True)
    resp.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    if not rows:
        raise ValueError("no €STR rows returned")
    latest = rows[-1]
    return float(latest["OBS_VALUE"]), latest.get("TIME_PERIOD", "")


def _fetch_yahoo_quote(symbol: str) -> tuple[float, str]:
    """Latest price for a Yahoo symbol via the public chart endpoint.

    Honest caveat (stated in the README): Yahoo's chart endpoint is an
    undocumented public feed, not a supported API. Fine for a context strip;
    not something the model's core numbers depend on.
    """
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
    resp = httpx.get(
        url,
        timeout=_HTTP_TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; financing-comparator/1.0)"},
    )
    resp.raise_for_status()
    data = resp.json()
    result = data["chart"]["result"][0]
    meta = result["meta"]
    price = meta.get("regularMarketPrice")
    ts = meta.get("regularMarketTime")
    if price is None:
        # fall back to the last close in the series
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
        price = closes[-1]
    as_of = (
        dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).isoformat()
        if ts
        else dt.datetime.now(dt.timezone.utc).isoformat()
    )
    return float(price), as_of


# ---------------------------------------------------------------------------
# Public accessors
# ---------------------------------------------------------------------------


def get_sofr() -> Optional[dict[str, Any]]:
    return _cached_or_fetch("sofr", _fetch_sofr)


def get_eur_str() -> Optional[dict[str, Any]]:
    return _cached_or_fetch("eur_str", _fetch_eur_str)


def get_af_price() -> Optional[dict[str, Any]]:
    return _cached_or_fetch("af_pa", lambda: _fetch_yahoo_quote("AF.PA"))


def get_eurusd() -> Optional[dict[str, Any]]:
    return _cached_or_fetch("eurusd", lambda: _fetch_yahoo_quote("EURUSD=X"))


def market_context() -> dict[str, Any]:
    """Assemble the /api/market-context payload."""
    sofr = get_sofr()
    eur_str = get_eur_str()
    af = get_af_price()
    fx = get_eurusd()

    any_stale = any(
        entry is not None and not entry.get("fresh", False)
        for entry in (sofr, eur_str, af, fx)
    )
    any_missing = any(entry is None for entry in (sofr, eur_str, af, fx))

    return {
        "sofr_pct": sofr["value"] if sofr else None,
        "sofr_as_of": sofr["as_of"] if sofr else None,
        "eur_str_pct": eur_str["value"] if eur_str else None,
        "eur_str_as_of": eur_str["as_of"] if eur_str else None,
        "af_pa_price_eur": af["value"] if af else None,
        "af_pa_as_of": af["as_of"] if af else None,
        "eurusd": fx["value"] if fx else None,
        "eurusd_as_of": fx["as_of"] if fx else None,
        "stale": any_stale or any_missing,
    }


def live_sofr_pct() -> Optional[float]:
    """SOFR as a percent for substitution into the model, or None if unavailable."""
    entry = get_sofr()
    return entry["value"] if entry else None

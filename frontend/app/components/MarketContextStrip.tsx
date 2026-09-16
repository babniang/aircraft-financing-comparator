"use client";

import { useI18n } from "@/lib/i18n";
import type { MarketContext } from "@/lib/types";

function fmtDate(raw: string | null): string {
  if (!raw) return "n/a";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

/**
 * Colour carries meaning here: blue marks the policy rates that actually feed
 * the model, black marks the equity and FX quotes that are context only.
 */
function Quote({
  label,
  value,
  note,
  feedsModel = false,
}: {
  label: string;
  value: string;
  note?: string;
  feedsModel?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink2">
        {label}
      </span>
      <span
        className={`text-[17px] font-semibold leading-none tracking-tight2 ${
          feedsModel ? "text-blue" : "text-ink"
        }`}
      >
        {value}
      </span>
      {note && <span className="text-[11px] text-muted">{note}</span>}
    </span>
  );
}

export default function MarketContextStrip({
  data,
  loading,
}: {
  data: MarketContext | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="border-b border-rule">
      <div className="mx-auto max-w-shell overflow-x-auto px-5 py-3.5 sm:px-8">
        <div className="flex items-baseline gap-x-9">
          <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span aria-hidden className="h-2 w-2 rounded-full bg-blue" />
            <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink">
              {t("market.live")}
            </span>
          </span>

          {loading || !data ? (
            <span className="text-[13px] text-ink2">{t("loading.market")}</span>
          ) : (
            <>
              {data.sofr_pct != null && (
                <Quote
                  label="SOFR"
                  value={`${data.sofr_pct.toFixed(2)}%`}
                  note={t("market.asOf", { date: fmtDate(data.sofr_as_of) })}
                  feedsModel
                />
              )}
              {data.eur_str_pct != null && (
                <Quote label="€STR" value={`${data.eur_str_pct.toFixed(2)}%`} feedsModel />
              )}
              {data.af_pa_price_eur != null && (
                <Quote label="AF.PA" value={`€${data.af_pa_price_eur.toFixed(2)}`} />
              )}
              {data.eurusd != null && (
                <Quote label="EUR/USD" value={data.eurusd.toFixed(4)} />
              )}
              {data.stale && (
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-eyebrow text-muted">
                  {t("market.cached")}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

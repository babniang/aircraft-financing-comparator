"use client";

import { useI18n } from "@/lib/i18n";
import type { MarketContext } from "@/lib/types";

function fmtDate(raw: string | null): string {
  if (!raw) return "n/a";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function Quote({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted">{label}</span>{" "}
      <span className="font-medium text-ink">{value}</span>
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
      <div className="mx-auto max-w-shell overflow-x-auto px-5 py-2.5 sm:px-8">
        <div className="flex items-center gap-x-7 text-[12px] leading-none">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-blue" />
            <span className="eyebrow">{t("market.live")}</span>
          </span>
          {loading || !data ? (
            <span className="text-muted">{t("loading.market")}</span>
          ) : (
            <>
              {data.sofr_pct != null && (
                <Quote
                  label="SOFR"
                  value={`${data.sofr_pct.toFixed(2)}%  ${t("market.asOf", {
                    date: fmtDate(data.sofr_as_of),
                  })}`}
                />
              )}
              {data.eur_str_pct != null && (
                <Quote label="€STR" value={`${data.eur_str_pct.toFixed(2)}%`} />
              )}
              {data.af_pa_price_eur != null && (
                <Quote label="AF.PA" value={`€${data.af_pa_price_eur.toFixed(2)}`} />
              )}
              {data.eurusd != null && (
                <Quote label="EUR/USD" value={data.eurusd.toFixed(4)} />
              )}
              {data.stale && <span className="text-muted">{t("market.cached")}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

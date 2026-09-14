"use client";

import { useI18n } from "@/lib/i18n";
import type { MarketContext } from "@/lib/types";

function fmtDate(raw: string | null): string {
  if (!raw) return "n/a";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-slate">{label}</span>{" "}
      <span className="font-semibold text-ink">{value}</span>
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
    <div className="border-b border-rule bg-blue050">
      <div className="mx-auto max-w-shell overflow-x-auto px-4 py-1.5 sm:px-6">
        <div className="flex items-center gap-x-5 font-mono text-[11.5px] leading-none">
          <span className="eyebrow text-blue700">{t("market.live")}</span>
          {loading || !data ? (
            <span className="text-slate">{t("loading.market")}</span>
          ) : (
            <>
              {data.sofr_pct != null && (
                <Cell
                  label="SOFR"
                  value={`${data.sofr_pct.toFixed(2)}  ${t("market.asOf", {
                    date: fmtDate(data.sofr_as_of),
                  })}`}
                />
              )}
              {data.eur_str_pct != null && (
                <Cell label="€STR" value={data.eur_str_pct.toFixed(2)} />
              )}
              {data.af_pa_price_eur != null && (
                <Cell
                  label="AF.PA"
                  value={`€${data.af_pa_price_eur.toFixed(2)}`}
                />
              )}
              {data.eurusd != null && (
                <Cell label="EUR/USD" value={data.eurusd.toFixed(4)} />
              )}
              {data.stale && (
                <span className="text-blue500">{t("market.cached")}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

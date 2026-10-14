"use client";

import { useI18n } from "@/lib/i18n";
import type { CompareResponse } from "@/lib/types";

/**
 * The cheapest structure and its execution caveat, side by side. A headline
 * rate with the friction relegated to a footnote reads as naive to a desk:
 * JOLCO in particular wins on rate and loses on set-up cost and rigidity.
 */
export default function CheapestCaveat({
  data,
  deliveryPrice,
}: {
  data: CompareResponse;
  deliveryPrice: number;
}) {
  const { t } = useI18n();

  const sorted = [...data.results].sort(
    (a, b) => a.implied_annual_cost_pct - b.implied_annual_cost_pct,
  );
  const best = sorted[0];
  const next = sorted[1];
  if (!best) return null;

  const edgePct = next ? next.implied_annual_cost_pct - best.implied_annual_cost_pct : 0;
  const edgeBps = edgePct * 100;
  const amt = (edgePct / 100) * (best.financed_pct_of_price / 100) * deliveryPrice;

  return (
    <div className="mt-6 grid gap-0 border border-ink md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="bg-white p-5 sm:p-6">
        <p className="eyebrow">{t("caveat.lowest")}</p>
        <p className="mt-2 text-[22px] font-medium tracking-tight2 text-blue sm:text-[26px]">
          {t(`structure.${best.structure}`)}
        </p>
        <p className="mt-1 text-[32px] font-medium leading-none tracking-tight3 text-ink">
          {best.implied_annual_cost_pct.toFixed(2)}%
        </p>
        {next && Number.isFinite(deliveryPrice) && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink2">
            {t("caveat.edge", { bps: edgeBps.toFixed(0), amt: amt.toFixed(2) })}
          </p>
        )}
      </div>
      <div className="border-t border-ink bg-amberPale p-5 sm:p-6 md:border-l md:border-t-0">
        <p className="text-[11px] font-medium uppercase tracking-eyebrow text-amberInk">
          {t("caveat.label")}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-amberInk">
          {t(`caveat.${best.structure}`)}
        </p>
      </div>
    </div>
  );
}

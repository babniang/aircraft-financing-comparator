"use client";

import { useI18n } from "@/lib/i18n";
import type { CompareResponse } from "@/lib/types";

function pct(n: number | null | undefined, dp = 1): string {
  return n == null ? "" : `${n.toFixed(dp)}%`;
}

export default function CreditMetricsTable({ data }: { data: CompareResponse }) {
  const { t } = useI18n();

  return (
    <section>
      <h2 className="mb-6 text-[20px] text-ink sm:text-[24px]">{t("cm.title")}</h2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("table.structure")}</th>
              <th>{t("cm.ltvInitial")}</th>
              <th>{t("cm.ltvMidlife")}</th>
              <th>{t("cm.dscr")}</th>
              <th>{t("cm.wal")}</th>
              <th>{t("cm.balloon")}</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => {
              const m = r.credit_metrics;
              const na = <span className="muted">{t("table.na")}</span>;
              return (
                <tr
                  key={r.structure}
                  className={r.structure === data.cheapest ? "is-lead" : undefined}
                >
                  <td>{t(`structure.${r.structure}`)}</td>
                  <td>{m ? pct(m.ltv_initial_pct) : na}</td>
                  <td>{m?.ltv_midlife_pct != null ? pct(m.ltv_midlife_pct) : na}</td>
                  <td>{m?.dscr_asset_x != null ? `${m.dscr_asset_x.toFixed(2)}x` : na}</td>
                  <td>{m ? m.wal_years.toFixed(1) : na}</td>
                  <td>{m?.balloon_pct != null ? pct(m.balloon_pct) : na}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink2">
        {t("cm.note")}
      </p>
    </section>
  );
}

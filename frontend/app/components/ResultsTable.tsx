"use client";

import { useI18n } from "@/lib/i18n";
import type { CompareResponse } from "@/lib/types";

function num(n: number, dp = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** Accounting style: negatives in parentheses. */
function acc(n: number | null | undefined, dp = 1): { text: string; neg: boolean } {
  if (n == null) return { text: "", neg: false };
  const neg = n < 0;
  return { text: neg ? `(${num(Math.abs(n), dp)})` : num(n, dp), neg };
}

export default function ResultsTable({ data }: { data: CompareResponse }) {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t("table.structure")}</th>
            <th>{t("table.impliedCost")}</th>
            <th>{t("table.financed")}</th>
            <th className="txt">{t("table.balanceSheet")}</th>
            <th>{t("table.oneOff")} ($m)</th>
            <th>{t("table.residual")} ($m)</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((r) => {
            const oneOff = acc(r.one_off_gain_usd_m ?? null, 1);
            const lead = r.structure === data.cheapest;
            return (
              <tr key={r.structure} className={lead ? "is-lead" : undefined}>
                <td>{t(`structure.${r.structure}`)}</td>
                <td className="metric">{num(r.implied_annual_cost_pct, 2)}%</td>
                <td>{num(r.financed_pct_of_price, 0)}%</td>
                <td className="txt">
                  {r.balance_sheet === "on" ? t("table.on") : t("table.off")}
                </td>
                <td className={oneOff.neg ? "neg" : undefined}>
                  {oneOff.text || <span className="muted">{t("table.na")}</span>}
                </td>
                <td>
                  {r.residual_value_usd_m != null ? (
                    num(r.residual_value_usd_m, 1)
                  ) : (
                    <span className="muted">{t("table.na")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

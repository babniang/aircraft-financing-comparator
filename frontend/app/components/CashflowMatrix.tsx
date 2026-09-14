"use client";

import { useI18n } from "@/lib/i18n";
import type { CompareResponse, StructureId } from "@/lib/types";

const ORDER: StructureId[] = ["eca_debt", "sll", "jolco", "slb"];

function acc(n: number, dp = 2): { text: string; neg: boolean } {
  const neg = n < 0;
  const body = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return { text: neg ? `(${body})` : body, neg };
}

export default function CashflowMatrix({ data }: { data: CompareResponse }) {
  const { t } = useI18n();

  const byStructure = new Map(data.results.map((r) => [r.structure, r]));
  const cols = ORDER.filter((s) => byStructure.has(s));

  const years = Array.from(
    new Set(
      data.results.flatMap((r) => r.cashflow_schedule.map((p) => p.year)),
    ),
  ).sort((a, b) => a - b);

  const cell = (s: StructureId, year: number): number | null => {
    const pt = byStructure.get(s)?.cashflow_schedule.find((p) => p.year === year);
    return pt ? pt.amount_usd_m : null;
  };

  return (
    <div>
      <p className="eyebrow mb-2 text-blue700">{t("table.cashTitle")}</p>
      <div className="overflow-x-auto">
        <table className="xl">
          <thead>
            <tr>
              <th>{t("table.year")}</th>
              {cols.map((s) => (
                <th key={s}>{t(`structure.${s}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td>{year}</td>
                {cols.map((s) => {
                  const v = cell(s, year);
                  if (v == null) return <td key={s} className="muted">–</td>;
                  const f = acc(v);
                  return (
                    <td key={s} className={f.neg ? "neg" : undefined}>
                      {f.text}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="xl-total">
              <td>{t("table.irr")}</td>
              {cols.map((s) => (
                <td key={s}>
                  {byStructure.get(s)!.implied_annual_cost_pct.toFixed(2)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-slate">
        {t("table.cashNote")}
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] leading-relaxed sm:grid-cols-3">
        {cols.map((s) => (
          <div key={s}>
            <dt className="font-semibold text-ink">{t(`structure.${s}`)}</dt>
            <dd className="text-slate">{t(`note.${s}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type { AircraftRef } from "@/lib/types";

export interface FormState {
  aircraftId: string;
  deliveryPrice: string;
  marketValue: string;
  tenorYears: string;
  gtfAdjustment: boolean;
  useLiveSofr: boolean;
  referenceRatePct: string;
}

export default function InputPanel({
  aircraft,
  form,
  liveSofr,
  onChange,
  onSelectAircraft,
  onCompare,
  busy,
}: {
  aircraft: AircraftRef[];
  form: FormState;
  liveSofr: number | null;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSelectAircraft: (id: string) => void;
  onCompare: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();

  const { afklm, other } = useMemo(
    () => ({
      afklm: aircraft.filter((a) => a.afklm_fleet),
      other: aircraft.filter((a) => !a.afklm_fleet),
    }),
    [aircraft],
  );

  const selected = aircraft.find((a) => a.id === form.aircraftId);

  const field =
    "min-h-11 w-full rounded-gs border border-rule bg-white px-2.5 text-[14px] text-ink outline-none focus:border-blue500 focus:ring-1 focus:ring-blue500";
  const label = "mb-1 block eyebrow";

  return (
    <div className="border border-rule bg-white">
      <div className="border-b border-rule bg-blue050 px-4 py-1.5">
        <span className="eyebrow text-blue700">{t("inputs.heading")}</span>
      </div>

      <div className="grid gap-x-5 gap-y-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <label htmlFor="aircraft" className={label}>
            {t("inputs.aircraftType")}
          </label>
          <select
            id="aircraft"
            className={field}
            value={form.aircraftId}
            onChange={(e) => onSelectAircraft(e.target.value)}
          >
            <optgroup label={t("inputs.groupAfklm")}>
              {afklm.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.gtf_exposed ? " (GTF)" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("inputs.groupOther")}>
              {other.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.gtf_exposed ? " (GTF)" : ""}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="mt-1 h-4 text-[12px] text-slate">
            {selected?.operator || ""}
          </p>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="delivery" className={label}>
            {t("inputs.deliveryPrice")}
          </label>
          <input
            id="delivery"
            type="number"
            inputMode="decimal"
            min={1}
            max={1000}
            step={1}
            className={field}
            value={form.deliveryPrice}
            onChange={(e) => onChange("deliveryPrice", e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="market" className={label}>
            {t("inputs.marketValue")}
          </label>
          <input
            id="market"
            type="number"
            inputMode="decimal"
            min={1}
            max={1000}
            step={1}
            className={field}
            value={form.marketValue}
            onChange={(e) => onChange("marketValue", e.target.value)}
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="tenor" className={label}>
            {t("inputs.tenor")}
          </label>
          <input
            id="tenor"
            type="number"
            inputMode="numeric"
            min={1}
            max={25}
            step={1}
            className={`${field} max-w-[6rem]`}
            value={form.tenorYears}
            onChange={(e) => onChange("tenorYears", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 border-t border-rule p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            role="switch"
            className="h-4 w-4 accent-blue500"
            checked={form.gtfAdjustment}
            onChange={(e) => onChange("gtfAdjustment", e.target.checked)}
          />
          <span className="text-ink">
            {t("inputs.gtfLabel")}{" "}
            <span className="text-slate">{t("inputs.gtfHint")}</span>
          </span>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-l border-rule pl-3 text-[13px] md:pl-4">
          <input
            type="checkbox"
            role="switch"
            className="h-4 w-4 accent-blue500"
            checked={form.useLiveSofr}
            onChange={(e) => onChange("useLiveSofr", e.target.checked)}
          />
          <span className="text-ink">
            {t("inputs.useLiveSofr")}
            {liveSofr != null && (
              <span className="ml-1 text-slate">
                {t("inputs.sofrSuffix", { rate: liveSofr.toFixed(2) })}
              </span>
            )}
          </span>
          {!form.useLiveSofr && (
            <input
              aria-label={t("inputs.referenceRate")}
              type="number"
              inputMode="decimal"
              min={0}
              max={20}
              step={0.05}
              className="ml-1 min-h-11 w-20 rounded-gs border border-rule px-2 text-[13px] outline-none focus:border-blue500"
              value={form.referenceRatePct}
              onChange={(e) => onChange("referenceRatePct", e.target.value)}
            />
          )}
        </label>

        <button
          type="button"
          onClick={onCompare}
          disabled={busy}
          className="min-h-11 rounded-gs bg-blue700 px-6 text-[12px] font-semibold uppercase tracking-eyebrow text-white transition-colors hover:bg-blue900 disabled:opacity-50"
        >
          {busy ? `${t("inputs.comparing")}…` : t("inputs.compare")}
        </button>
      </div>
    </div>
  );
}

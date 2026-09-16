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

const FIELD =
  "min-h-11 w-full border-0 border-b border-rule bg-transparent px-0 pb-1.5 text-[16px] font-light text-ink outline-none transition-colors focus:border-blue";
const LABEL = "eyebrow block";

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

  return (
    <div>
      <div className="grid gap-x-10 gap-y-7 md:grid-cols-12">
        <div className="md:col-span-5">
          <label htmlFor="aircraft" className={LABEL}>
            {t("inputs.aircraftType")}
          </label>
          <select
            id="aircraft"
            className={FIELD}
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
          <p className="mt-2 h-4 text-[12px] text-muted">{selected?.operator || ""}</p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="delivery" className={LABEL}>
            {t("inputs.deliveryPrice")}
          </label>
          <input
            id="delivery"
            type="number"
            inputMode="decimal"
            min={1}
            max={1000}
            step={1}
            className={FIELD}
            value={form.deliveryPrice}
            onChange={(e) => onChange("deliveryPrice", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="market" className={LABEL}>
            {t("inputs.marketValue")}
          </label>
          <input
            id="market"
            type="number"
            inputMode="decimal"
            min={1}
            max={1000}
            step={1}
            className={FIELD}
            value={form.marketValue}
            onChange={(e) => onChange("marketValue", e.target.value)}
          />
        </div>

        <div className="md:col-span-3">
          <label htmlFor="tenor" className={LABEL}>
            {t("inputs.tenor")}
          </label>
          <input
            id="tenor"
            type="number"
            inputMode="numeric"
            min={1}
            max={25}
            step={1}
            className={FIELD}
            value={form.tenorYears}
            onChange={(e) => onChange("tenorYears", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              role="switch"
              className="h-4 w-4 accent-blue"
              checked={form.gtfAdjustment}
              onChange={(e) => onChange("gtfAdjustment", e.target.checked)}
            />
            <span className="text-ink">{t("inputs.gtfLabel")}</span>
          </label>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              role="switch"
              className="h-4 w-4 accent-blue"
              checked={form.useLiveSofr}
              onChange={(e) => onChange("useLiveSofr", e.target.checked)}
            />
            <span className="text-ink">
              {t("inputs.useLiveSofr")}
              {liveSofr != null && (
                <span className="ml-1.5 text-muted">
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
                className="ml-1 min-h-11 w-20 border-0 border-b border-rule bg-transparent px-0 text-[14px] outline-none focus:border-blue"
                value={form.referenceRatePct}
                onChange={(e) => onChange("referenceRatePct", e.target.value)}
              />
            )}
          </label>
        </div>

        <button
          type="button"
          onClick={onCompare}
          disabled={busy}
          className="min-h-11 shrink-0 bg-ink px-8 text-[12px] font-medium uppercase tracking-eyebrow text-white transition-colors hover:bg-blue disabled:opacity-40"
        >
          {busy ? `${t("inputs.comparing")}…` : t("inputs.compare")}
        </button>
      </div>
    </div>
  );
}

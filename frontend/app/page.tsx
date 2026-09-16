"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  downloadExcelModel,
  getMarketContext,
  getReference,
  postCompare,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  CompareRequest,
  CompareResponse,
  MarketContext,
  ReferenceResponse,
} from "@/lib/types";
import TopBanner from "./components/TopBanner";
import Masthead from "./components/Masthead";
import MarketContextStrip from "./components/MarketContextStrip";
import InputPanel, { type FormState } from "./components/InputPanel";
import ResultsTable from "./components/ResultsTable";
import CreditMetricsTable from "./components/CreditMetricsTable";
import CashflowMatrix from "./components/CashflowMatrix";
import GtfExplainer from "./components/GtfExplainer";
import MethodologyAccordion from "./components/MethodologyAccordion";
import LoadingState from "./components/LoadingState";
import Footer from "./components/Footer";

const DEFAULT_REFERENCE_RATE = "3.8";

export default function Page() {
  const { t } = useI18n();

  const [reference, setReference] = useState<ReferenceResponse | null>(null);
  const [market, setMarket] = useState<MarketContext | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  const [form, setForm] = useState<FormState>({
    aircraftId: "",
    deliveryPrice: "",
    marketValue: "",
    tenorYears: "12",
    gtfAdjustment: false,
    useLiveSofr: true,
    referenceRatePct: DEFAULT_REFERENCE_RATE,
  });

  const [results, setResults] = useState<CompareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasResults = results !== null;

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    getReference()
      .then((ref) => {
        setReference(ref);
        const first =
          ref.aircraft.find((a) => a.id === "a320neo") ?? ref.aircraft[0];
        if (first) {
          setForm((f) => ({
            ...f,
            aircraftId: first.id,
            deliveryPrice: String(first.typical_delivery_price_usd_m),
            marketValue: String(first.typical_market_value_usd_m),
          }));
        }
      })
      .catch((e) => setError(describe(e, t)));

    getMarketContext()
      .then((m) => {
        setMarket(m);
        if (m.sofr_pct != null) {
          setForm((f) => ({ ...f, referenceRatePct: m.sofr_pct!.toFixed(2) }));
        }
      })
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, [t]);

  const buildRequest = useCallback((): CompareRequest | null => {
    const f = formRef.current;
    const delivery = parseFloat(f.deliveryPrice);
    const marketValue = parseFloat(f.marketValue);
    const tenor = parseInt(f.tenorYears, 10);
    if (!Number.isFinite(delivery) || !Number.isFinite(marketValue) || !tenor) {
      return null;
    }
    return {
      aircraft_id: f.aircraftId || undefined,
      delivery_price_usd_m: delivery,
      market_value_usd_m: marketValue,
      tenor_years: tenor,
      gtf_adjustment: f.gtfAdjustment,
      use_live_sofr: f.useLiveSofr,
      assumptions: f.useLiveSofr
        ? undefined
        : { reference_rate_pct: parseFloat(f.referenceRatePct) || undefined },
    };
  }, []);

  const runCompare = useCallback(async () => {
    const req = buildRequest();
    if (!req) {
      setError(t("error.missingInputs"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResults(await postCompare(req));
    } catch (e) {
      setError(describe(e, t));
    } finally {
      setBusy(false);
    }
  }, [buildRequest, t]);

  const runExport = useCallback(async () => {
    const req = buildRequest();
    if (!req) {
      setError(t("error.missingInputsExport"));
      return;
    }
    setExporting(true);
    setError(null);
    try {
      await downloadExcelModel(req);
    } catch (e) {
      setError(describe(e, t));
    } finally {
      setExporting(false);
    }
  }, [buildRequest, t]);

  const onChange = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      if ((key === "gtfAdjustment" || key === "useLiveSofr") && hasResults) {
        setTimeout(runCompare, 0);
      }
    },
    [hasResults, runCompare],
  );

  const onSelectAircraft = useCallback(
    (id: string) => {
      const a = reference?.aircraft.find((x) => x.id === id);
      setForm((f) => ({
        ...f,
        aircraftId: id,
        deliveryPrice: a
          ? String(a.typical_delivery_price_usd_m)
          : f.deliveryPrice,
        marketValue: a ? String(a.typical_market_value_usd_m) : f.marketValue,
      }));
    },
    [reference],
  );

  const sourceLabel = results
    ? results.reference_rate_source === "live_sofr"
      ? t("results.sourceLive")
      : results.reference_rate_source === "assumption_override"
        ? t("results.sourceOverride")
        : t("results.sourceDefault")
    : "";

  return (
    <>
      <TopBanner />
      <Masthead />
      <MarketContextStrip data={market} loading={marketLoading} />

      <main className="mx-auto max-w-shell px-5 sm:px-8">
        <section className="py-14 sm:py-20">
          <p className="eyebrow">{t("banner.eyebrow")}</p>
          <h1 className="mt-5 max-w-4xl text-[38px] text-ink sm:text-[56px]">
            {t("banner.title")}
          </h1>
          <p className="mt-7 max-w-2xl text-[16px] leading-relaxed text-ink2 sm:text-[17px]">
            {t("banner.lead")}
          </p>
        </section>

        <section className="border-t border-rule pt-10">
          <p className="eyebrow mb-7">{t("inputs.heading")}</p>
          {reference ? (
            <InputPanel
              aircraft={reference.aircraft}
              form={form}
              liveSofr={market?.sofr_pct ?? null}
              onChange={onChange}
              onSelectAircraft={onSelectAircraft}
              onCompare={runCompare}
              busy={busy}
            />
          ) : (
            <p className="text-[13px] text-muted">{t("loading.inputs")}</p>
          )}

          {error && (
            <div className="mt-6 border-l-2 border-neg py-1 pl-4 text-[13px] text-ink">
              {error}
              <button
                type="button"
                onClick={runCompare}
                className="ml-2 min-h-11 text-blue underline"
              >
                {t("error.tryAgain")}
              </button>
            </div>
          )}
        </section>

        {(busy && !hasResults) || hasResults ? (
          <section className="mt-16 space-y-14">
            <div>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h2 className="text-[24px] text-ink sm:text-[30px]">
                  {t("results.heading")}
                </h2>
                {hasResults && (
                  <span className="text-[12px] text-muted">
                    {t("results.baseRate", {
                      rate: results!.reference_rate_pct_used.toFixed(2),
                    })}{" "}
                    ({sourceLabel})
                    {results!.gtf_adjustment_applied
                      ? ` · ${t("results.gtfOn")}`
                      : ""}
                  </span>
                )}
              </div>

              {busy && !hasResults ? (
                <LoadingState />
              ) : (
                <ResultsTable data={results!} />
              )}
            </div>

            {hasResults && (
              <>
                <CreditMetricsTable data={results!} />
                <CashflowMatrix data={results!} />

                <div className="flex flex-col gap-4 border-t border-rule pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[18px] font-light tracking-tight2 text-ink">{t("export.heading")}</p>
                    <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
                      {t("export.body")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={runExport}
                    disabled={exporting}
                    className="min-h-11 shrink-0 border border-ink px-7 text-[12px] font-medium uppercase tracking-eyebrow text-ink transition-colors hover:border-blue hover:text-blue disabled:opacity-40"
                  >
                    {exporting
                      ? `${t("export.preparing")}…`
                      : t("export.download")}
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        <div className="mt-16 space-y-12">
          <GtfExplainer />
          <MethodologyAccordion reference={reference} />
        </div>
      </main>

      <Footer />
    </>
  );
}

function describe(e: unknown, t: (k: string) => string): string {
  if (e instanceof ApiError) {
    if (e.kind === "timeout" || e.kind === "network") return t("error.waking");
    return e.message;
  }
  return t("error.generic");
}

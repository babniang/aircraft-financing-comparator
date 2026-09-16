"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { ReferenceResponse } from "@/lib/types";

export default function MethodologyAccordion({
  reference,
}: {
  reference: ReferenceResponse | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <section id="methodology" className="scroll-mt-20 border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-[18px] font-light tracking-tight2 text-ink sm:text-[22px]">
          {t("method.heading")}
        </span>
        <span aria-hidden className="text-[20px] font-light text-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="grid gap-x-12 gap-y-7 pb-10 text-[13.5px] leading-relaxed text-ink2 md:grid-cols-2">
          <p className="md:col-span-2 max-w-3xl">{t("method.metric")}</p>

          <div>
            <p className="eyebrow mb-2">{t("method.liveHeading")}</p>
            <p>{t("method.liveBody")}</p>
          </div>

          <div>
            <p className="eyebrow mb-2">{t("method.sourcedHeading")}</p>
            <ul className="space-y-1.5">
              <li>{t("method.sourced1")}</li>
              <li>{t("method.sourced2")}</li>
              <li>{t("method.sourced3")}</li>
              <li>{t("method.sourced4")}</li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="eyebrow mb-2">{t("method.notModelledHeading")}</p>
            <p className="max-w-3xl">{t("method.notModelledBody")}</p>
          </div>

          {reference && (
            <p className="md:col-span-2 text-[12px] text-muted">
              {t("method.refData", {
                version: reference.version,
                note: reference.sources_note,
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

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
    <section id="methodology" className="scroll-mt-16 border border-rule">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between bg-blue050 px-4 text-left"
      >
        <span className="eyebrow text-blue700">{t("method.heading")}</span>
        <span className="mono text-[13px] text-slate">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-rule p-4 text-[13.5px] leading-relaxed text-inkSoft sm:p-6">
          <p>{t("method.metric")}</p>

          <div>
            <p className="font-semibold text-ink">{t("method.liveHeading")}</p>
            <p>{t("method.liveBody")}</p>
          </div>

          <div>
            <p className="font-semibold text-ink">{t("method.sourcedHeading")}</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>{t("method.sourced1")}</li>
              <li>{t("method.sourced2")}</li>
              <li>{t("method.sourced3")}</li>
              <li>{t("method.sourced4")}</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-ink">
              {t("method.notModelledHeading")}
            </p>
            <p>{t("method.notModelledBody")}</p>
          </div>

          {reference && (
            <p className="pt-1 text-[12px] text-slate">
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

"use client";

import { useI18n } from "@/lib/i18n";
import type { ReferenceResponse } from "@/lib/types";

/** Always visible. This is the credibility section; hiding it behind a click
 *  buries the part a reader most needs to see. */
export default function MethodologyAccordion({
  reference,
}: {
  reference: ReferenceResponse | null;
}) {
  const { t } = useI18n();

  return (
    <section id="methodology" className="scroll-mt-20 border-t border-rule pt-10">
      <p className="eyebrow">{t("nav.method")}</p>
      <h2 className="mt-3 max-w-3xl text-[24px] text-ink sm:text-[30px]">
        {t("method.heading")}
      </h2>

      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink2">
        {t("method.metric")}
      </p>

      <div className="mt-8 grid gap-x-12 gap-y-8 text-[14px] leading-relaxed text-ink2 md:grid-cols-3">
        <div>
          <p className="eyebrow mb-2.5">{t("method.liveHeading")}</p>
          <p>{t("method.liveBody")}</p>
        </div>

        <div>
          <p className="eyebrow mb-2.5">{t("method.sourcedHeading")}</p>
          <ul className="space-y-2">
            <li>{t("method.sourced1")}</li>
            <li>{t("method.sourced2")}</li>
            <li>{t("method.sourced3")}</li>
            <li>{t("method.sourced4")}</li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-2.5">{t("method.notModelledHeading")}</p>
          <p>{t("method.notModelledBody")}</p>
        </div>
      </div>

      {reference && (
        <p className="mt-8 border-t border-rule pt-5 text-[13px] text-muted">
          {t("method.refData", {
            version: reference.version,
            note: reference.sources_note,
          })}
        </p>
      )}
    </section>
  );
}

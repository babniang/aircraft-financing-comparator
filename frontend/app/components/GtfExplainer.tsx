"use client";

import { useI18n } from "@/lib/i18n";

export default function GtfExplainer() {
  const { t } = useI18n();

  return (
    <section id="engine-risk" className="scroll-mt-16 border border-rule">
      <div className="border-b border-rule bg-blue050 px-4 py-1.5">
        <span className="eyebrow text-blue700">{t("nav.gtf")}</span>
      </div>
      <div className="p-4 sm:p-6">
        <h2 className="text-[19px] text-ink sm:text-[21px]">{t("gtf.heading")}</h2>
        <div className="mt-3 grid gap-x-8 gap-y-3 text-[14px] leading-relaxed text-inkSoft md:grid-cols-3">
          <p>{t("gtf.p1")}</p>
          <p>{t("gtf.p2")}</p>
          <p>{t("gtf.p3")}</p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";

export default function GtfExplainer() {
  const { t } = useI18n();

  return (
    <section id="engine-risk" className="scroll-mt-20 border-t border-rule pt-10">
      <p className="eyebrow">{t("nav.gtf")}</p>
      <h2 className="mt-3 max-w-3xl text-[24px] text-ink sm:text-[30px]">
        {t("gtf.heading")}
      </h2>
      <div className="mt-6 grid gap-x-10 gap-y-5 text-[15px] leading-relaxed text-ink2 md:grid-cols-3">
        <p>{t("gtf.p1")}</p>
        <p>{t("gtf.p2")}</p>
        <p>{t("gtf.p3")}</p>
      </div>
    </section>
  );
}

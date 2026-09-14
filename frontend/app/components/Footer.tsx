"use client";

import { useI18n } from "@/lib/i18n";
import { AUTHOR_NAME, GITHUB_URL, RESUME_URL } from "@/lib/config";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer id="about" className="mt-12 scroll-mt-16 border-t border-rule bg-blue050">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="eyebrow text-blue700">{t("footer.builtBy")}</p>
          <p className="mt-1 text-[20px] font-bold tracking-tight2 text-ink">
            {AUTHOR_NAME}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 text-[12px] uppercase tracking-eyebrow">
            <a href={RESUME_URL} target="_blank" rel="noopener noreferrer">
              {t("footer.resume")}
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {t("footer.source")}
            </a>
          </div>
        </div>
        <p className="max-w-md text-[11.5px] leading-relaxed text-slate">
          {t("footer.disclaimer")}
        </p>
      </div>
    </footer>
  );
}

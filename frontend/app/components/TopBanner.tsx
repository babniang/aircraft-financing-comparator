"use client";

import { useI18n } from "@/lib/i18n";
import LanguageToggle from "./LanguageToggle";

export default function TopBanner() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 bg-blue900 text-white">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 bg-blue500" />
          <span className="text-[11px] font-bold uppercase tracking-eyebrow text-white">
            Aircraft Finance <span className="text-white/45">/</span> Structure
            Comparator
          </span>
        </div>

        <nav className="hidden items-center gap-5 text-[11px] uppercase tracking-eyebrow text-white/70 md:flex">
          <a href="#engine-risk" className="hover:text-white hover:no-underline">
            {t("nav.gtf")}
          </a>
          <a href="#methodology" className="hover:text-white hover:no-underline">
            {t("nav.method")}
          </a>
          <a href="#about" className="hover:text-white hover:no-underline">
            {t("nav.author")}
          </a>
        </nav>

        <LanguageToggle />
      </div>
    </header>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";
import LanguageToggle from "./LanguageToggle";

export default function TopBanner() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-6 px-5 py-3 sm:px-8">
        <span className="text-[13px] font-medium tracking-tight2 text-ink">
          Aviation Finance
        </span>

        <nav className="hidden items-center gap-7 text-[13px] text-ink2 md:flex">
          <a href="#engine-risk" className="hover:text-ink">
            {t("nav.gtf")}
          </a>
          <a href="#methodology" className="hover:text-ink">
            {t("nav.method")}
          </a>
          <LanguageToggle />
        </nav>

        <div className="md:hidden">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-16 border-t border-rule">
      <div className="mx-auto max-w-shell px-5 py-8 sm:px-8">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink2">
          {t("footer.disclaimer")}
        </p>
      </div>
    </footer>
  );
}

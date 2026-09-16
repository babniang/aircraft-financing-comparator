"use client";

import { useI18n, type Lang } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const options: Lang[] = ["en", "fr"];

  return (
    <div className="flex items-center gap-1 text-[11px]" role="group" aria-label="Language">
      {options.map((o, i) => (
        <span key={o} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-rule">/</span>}
          <button
            type="button"
            onClick={() => setLang(o)}
            aria-pressed={lang === o}
            className={`uppercase tracking-eyebrow transition-colors ${
              lang === o ? "font-medium text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o}
          </button>
        </span>
      ))}
    </div>
  );
}

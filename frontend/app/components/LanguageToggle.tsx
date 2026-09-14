"use client";

import { useI18n, type Lang } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const options: Lang[] = ["en", "fr"];

  return (
    <div
      className="inline-flex items-center border border-white/25 text-[11px]"
      role="group"
      aria-label="Language"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => setLang(o)}
          aria-pressed={lang === o}
          className={`min-h-11 px-2 uppercase tracking-eyebrow transition-colors ${
            lang === o
              ? "bg-white text-blue900"
              : "text-white/60 hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

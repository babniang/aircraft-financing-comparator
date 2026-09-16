"use client";

import { useI18n } from "@/lib/i18n";
import {
  AUTHOR_AVAILABILITY_EN,
  AUTHOR_AVAILABILITY_FR,
  AUTHOR_LICENCE,
  AUTHOR_NAME,
  AUTHOR_PROGRAM,
  AUTHOR_SCHOOL,
  GITHUB_URL,
  LINKEDIN_URL,
  RESUME_URL,
} from "@/lib/config";

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center border-b border-blue/30 text-[13px] text-blue transition-colors hover:border-blue hover:text-blueDark"
    >
      {children}
    </a>
  );
}

export default function Masthead() {
  const { t, lang } = useI18n();
  const availability =
    lang === "fr" ? AUTHOR_AVAILABILITY_FR : AUTHOR_AVAILABILITY_EN;

  return (
    <section className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-shell flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{t("id.by")}</p>
          <p className="mt-2 text-[26px] font-light tracking-tight3 text-ink sm:text-[32px]">
            {AUTHOR_NAME}
          </p>
          <p className="mt-1.5 text-[14px] text-ink2">
            {AUTHOR_SCHOOL}
            <span aria-hidden className="mx-2 text-rule">
              |
            </span>
            {AUTHOR_PROGRAM}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {AUTHOR_LICENCE}
            <span aria-hidden className="mx-2 text-rule">
              |
            </span>
            {availability}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6">
          <Link href={RESUME_URL}>{t("footer.resume")}</Link>
          <Link href={LINKEDIN_URL}>LinkedIn</Link>
          <Link href={GITHUB_URL}>{t("footer.source")}</Link>
        </div>
      </div>
    </section>
  );
}

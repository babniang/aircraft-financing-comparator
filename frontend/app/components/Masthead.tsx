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

function Action({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center border border-ink px-5 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-white"
    >
      {children}
    </a>
  );
}

function Divider() {
  return (
    <span aria-hidden className="mx-2.5 text-ruleStrong">
      |
    </span>
  );
}

export default function Masthead() {
  const { t, lang } = useI18n();
  const availability =
    lang === "fr" ? AUTHOR_AVAILABILITY_FR : AUTHOR_AVAILABILITY_EN;

  return (
    <section className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-shell flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">{t("id.by")}</p>
          <p className="mt-2 text-[30px] font-semibold leading-none tracking-tight2 text-ink sm:text-[36px]">
            {AUTHOR_NAME}
          </p>
          <p className="mt-3 text-[15px] font-medium text-ink">
            {AUTHOR_SCHOOL}
            <Divider />
            {AUTHOR_PROGRAM}
          </p>
          <p className="mt-1 text-[15px] text-ink2">
            {AUTHOR_LICENCE}
            <Divider />
            {availability}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Action href={RESUME_URL}>{t("footer.resume")}</Action>
          <Action href={LINKEDIN_URL}>LinkedIn</Action>
          <Action href={GITHUB_URL}>{t("footer.source")}</Action>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";
import { GitHubIcon, LinkedInIcon, PdfIcon } from "./Icons";
import {
  AUTHOR_AVAILABILITY_EN,
  AUTHOR_AVAILABILITY_FR,
  AUTHOR_INTEREST_EN,
  AUTHOR_INTEREST_FR,
  AUTHOR_LICENCE,
  AUTHOR_NAME,
  AUTHOR_PROGRAM,
  AUTHOR_SCHOOL,
  GITHUB_URL,
  LINKEDIN_URL,
  RESUME_URL,
} from "@/lib/config";

function Action({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2.5 border border-rule px-5 text-[14px] font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
    >
      {icon}
      {children}
    </a>
  );
}

function Sep() {
  return (
    <span aria-hidden className="mx-2.5 text-ruleStrong">
      |
    </span>
  );
}

export default function Masthead() {
  const { t, lang } = useI18n();
  const fr = lang === "fr";

  return (
    <section className="border-b border-rule bg-white">
      <div className="mx-auto flex max-w-shell flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[32px] font-medium leading-none tracking-tight2 text-ink sm:text-[38px]">
            {AUTHOR_NAME}
          </p>
          <p className="mt-3.5 text-[15px] text-ink">
            {AUTHOR_SCHOOL}
            <Sep />
            {AUTHOR_PROGRAM}
          </p>
          <p className="mt-1.5 max-w-2xl text-[15px] text-ink2">
            {AUTHOR_LICENCE}
            <Sep />
            {fr ? AUTHOR_INTEREST_FR : AUTHOR_INTEREST_EN}
            <Sep />
            {fr ? AUTHOR_AVAILABILITY_FR : AUTHOR_AVAILABILITY_EN}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Action href={RESUME_URL} icon={<PdfIcon className="h-[18px] w-[18px]" />}>
            {t("footer.resume")}
          </Action>
          <Action href={LINKEDIN_URL} icon={<LinkedInIcon className="h-[17px] w-[17px] text-[#0A66C2]" />}>
            LinkedIn
          </Action>
          <Action href={GITHUB_URL} icon={<GitHubIcon className="h-[17px] w-[17px]" />}>
            {t("footer.source")}
          </Action>
        </div>
      </div>
    </section>
  );
}

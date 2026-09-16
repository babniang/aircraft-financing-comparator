/**
 * Small local icon set. Hand-rolled rather than pulled from an icon package:
 * simple-icons is 25MB and no longer ships a LinkedIn mark, so four inline
 * paths cost a fraction of the bundle and stay under our control.
 *
 * Brand marks (LinkedIn, GitHub) are used nominatively to label links to those
 * services, which is what their brand guidelines allow.
 */

type IconProps = { className?: string };

export function LinkedInIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function GitHubIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** Generic PDF document mark, for the CV link. */
export function PdfIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path
        d="M13.5 1.5H5.25A1.75 1.75 0 0 0 3.5 3.25v17.5c0 .966.784 1.75 1.75 1.75h13.5a1.75 1.75 0 0 0 1.75-1.75V8.25L13.5 1.5Z"
        fill="#C8102E"
      />
      <path d="M13.5 1.5 20.5 8.25h-5.25a1.75 1.75 0 0 1-1.75-1.75V1.5Z" fill="#E4586B" />
      <path
        d="M7.3 17.2v-5.3h2.02c1.02 0 1.65.62 1.65 1.6 0 .97-.65 1.6-1.68 1.6h-.86v2.1H7.3Zm1.13-3h.72c.45 0 .7-.25.7-.7 0-.44-.25-.69-.7-.69h-.72v1.39Zm3.42 3v-5.3h1.97c1.5 0 2.42.98 2.42 2.64 0 1.67-.92 2.66-2.44 2.66h-1.95Zm1.14-.97h.74c.83 0 1.34-.6 1.34-1.68 0-1.07-.51-1.67-1.33-1.67h-.75v3.35Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Spreadsheet mark for the workbook download action. */
export function ExcelIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none">
      <path
        d="M13.5 1.5H5.25A1.75 1.75 0 0 0 3.5 3.25v17.5c0 .966.784 1.75 1.75 1.75h13.5a1.75 1.75 0 0 0 1.75-1.75V8.25L13.5 1.5Z"
        fill="#1D6F42"
      />
      <path d="M13.5 1.5 20.5 8.25h-5.25a1.75 1.75 0 0 1-1.75-1.75V1.5Z" fill="#33955F" />
      <path
        d="m8.6 11.9 1.62 2.4-1.74 2.55h1.6l.96-1.55.96 1.55h1.63l-1.75-2.57 1.63-2.38h-1.58l-.85 1.4-.85-1.4H8.6Z"
        fill="#fff"
      />
    </svg>
  );
}

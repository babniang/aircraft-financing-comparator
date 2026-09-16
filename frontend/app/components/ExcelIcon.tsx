/** Spreadsheet mark for the workbook download action. */
export default function ExcelIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
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

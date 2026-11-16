import type { ReactNode } from "react";

/**
 * The one icon set: authored 24px SVG paths, 1.75 stroke, round caps. Icons are decoration next to text,
 * so they are aria-hidden; a control that is icon-only carries its own aria-label.
 */
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  sortDown: <path d="M8 5v14M4.5 15.5L8 19l3.5-3.5M14 7h6M14 12h4M14 17h2" />,
  sortUp: <path d="M8 19V5M4.5 8.5L8 5l3.5 3.5M14 7h2M14 12h4M14 17h6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  alert: (
    <>
      <path d="M12 3.5l9 16H3z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.8v.1" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.4l2.6 2.6 5-5.6" />
    </>
  ),
  filter: <path d="M4 6.5h16M7 12h10M10 17.5h4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  upload: (
    <>
      <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </>
  ),
  file: (
    <>
      <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z" />
      <path d="M13.5 3.5v5h5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5L11 13" />
      <path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.9 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.4 7.6A16.4 16.4 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.1-1" />
      <path d="M10 10.2a2.8 2.8 0 0 0 3.9 3.9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </>
  ),
  pencil: <path d="M4.5 19.5l1-4.2L15.8 5a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.7 18.5z" />,
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="8" width="17" height="11" rx="1.6" />
      <path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20" />
      <path d="M15 9h2.5A1.5 1.5 0 0 1 19 10.5V20" />
      <path d="M3 20h18" />
      <path d="M8 8h.1M8 12h.1M11.5 8h.1M11.5 12h.1" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a2.8 2.8 0 0 1 0 5.6" />
      <path d="M17.5 13.5a5.5 5.5 0 0 1 3 4.9" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5l2.2-6A1.6 1.6 0 0 1 7.7 6.5h8.6a1.6 1.6 0 0 1 1.5 1l2.2 6" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
      <path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.5V4.5" />
      <path d="M4 19.5h16" />
      <rect x="7" y="12" width="3" height="5" rx="0.4" />
      <rect x="12" y="9" width="3" height="8" rx="0.4" />
      <rect x="17" y="6" width="3" height="11" rx="0.4" />
    </>
  ),
  code: <path d="M9.5 8.5L5 12l4.5 3.5M14.5 8.5L19 12l-4.5 3.5" />,
  wallet: (
    <>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.3" cy="14.2" r="0.9" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.5v3A1.5 1.5 0 0 0 5.5 15H8l8 4V5L8 9H5.5A1.5 1.5 0 0 0 4 10.5z" />
      <path d="M8 15v4" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20z" />,
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 4H19v15.5H6.5a2 2 0 0 0-2 2z" />
      <path d="M4.5 5.5v14" />
      <path d="M9 8h6M9 11.5h5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M4.8 7.5l1.7 1M17.5 15.5l1.7 1M4.8 16.5l1.7-1M17.5 8.5l1.7-1" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
      <path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M4 21h13" />
    </>
  ),
  trendUp: (
    <>
      <path d="M4 16l5-5 3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 3.5l7 3v5.2c0 4-3 7.4-7 8.8-4-1.4-7-4.8-7-8.8V6.5z" />
      <path d="M8.8 11.8l2.3 2.3 4.1-4.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M18.2 16.2H5.8l1.3-2.4V10a4.9 4.9 0 0 1 9.8 0v3.8z" />
      <path d="M10 19.2a2 2 0 0 0 4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.6h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6.5" width="12" height="11" rx="2" />
      <path d="M15 10.5l5-2.7v8.4l-5-2.7z" />
    </>
  ),
  phone: (
    <path d="M6.6 4.5h3.1l1.4 3.9-2 1.4a11.4 11.4 0 0 0 5.1 5.1l1.4-2 3.9 1.4v3.1a2.6 2.6 0 0 1-2.8 2.6C10.4 19.4 4.6 13.6 4 7.3a2.6 2.6 0 0 1 2.6-2.8z" />
  ),
  send: (
    <>
      <path d="M20.5 3.5L3.5 10.5l6 2.5 2.5 6z" />
      <path d="M20.5 3.5L9.5 13" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.2" />
      <rect x="9.5" y="4.5" width="5" height="10" rx="1.2" />
      <rect x="15.5" y="4.5" width="5" height="13" rx="1.2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `jp-icon ${className}` : "jp-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

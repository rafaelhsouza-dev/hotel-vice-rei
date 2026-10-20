import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export type IconName =
  | "wifi"
  | "breakfast"
  | "parking"
  | "concierge"
  | "ac"
  | "tv"
  | "reception24"
  | "laundry"
  | "tours"
  | "bar"
  | "safe"
  | "elevator"
  | "phone"
  | "mail"
  | "map"
  | "facebook"
  | "instagram"
  | "star"
  | "chevron-down"
  | "chevron-right"
  | "arrow-right"
  | "calendar"
  | "users"
  | "check"
  | "shield"
  | "sparkle"
  | "globe"
  | "menu"
  | "close"
  | "link"
  | "whatsapp"
  | "twitter"
  | "bed"
  | "dashboard"
  | "image"
  | "tag"
  | "plus"
  | "trash"
  | "edit"
  | "search"
  | "upload"
  | "eye"
  | "eyeOff"
  | "inbox"
  | "alert"
  | "sync"
  | "plug"
  | "wrench"
  | "chart"
  | "receipt"
  | "card"
  | "key"
  | "clipboard"
  | "door"
  | "activity"
  | "download"
  | "grid";

const paths: Record<IconName, ReactElement> = {
  wifi: (
    <>
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.9a5 5 0 0 1 7 0" />
      <circle cx="12" cy="20" r="1" />
    </>
  ),
  breakfast: (
    <>
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v3M10 2v3M14 2v3" />
    </>
  ),
  parking: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 17V7h4a3.5 3.5 0 0 1 0 7H9" />
    </>
  ),
  concierge: (
    <>
      <path d="M3 18h18" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <circle cx="12" cy="7" r="3" />
    </>
  ),
  ac: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="m5 5 14 14M19 5 5 19" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
    </>
  ),
  reception24: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  laundry: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <circle cx="8" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  tours: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  bar: (
    <>
      <path d="M4 4h16l-7 9v6h3v2H8v-2h3v-6Z" />
    </>
  ),
  safe: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="14" cy="12" r="3" />
      <path d="M7 8v8" />
    </>
  ),
  elevator: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m9 9 3-3 3 3M9 15l3 3 3-3" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  map: (
    <>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  facebook: (
    <path d="M13 22V12h3l.5-4H13V6c0-1.1.4-2 2-2h2V0h-3c-3 0-5 2-5 5v3H6v4h3v10z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
    </>
  ),
  star: <path d="m12 3 2.9 6 6.6.6-5 4.5 1.6 6.4L12 17l-6.1 3.5 1.6-6.4-5-4.5L9 9Z" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "arrow-right": <path d="M5 12h14M13 5l7 7-7 7" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: <path d="M12 2 4 5v7c0 5 3.5 9 8 10 4.5-1 8-5 8-10V5Z" />,
  sparkle: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 4 7 4 9s-1.5 6-4 9c-2.5-3-4-7-4-9s1.5-6 4-9Z" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.1-1.1" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M3.5 20.5 4.9 16A8 8 0 1 1 8 19.1z" />
      <path d="M8.6 8.4c-.3.7-.2 1.6.3 2.4a8 8 0 0 0 3.7 3.3c.8.3 1.7.3 2.3-.1" />
    </>
  ),
  twitter: <path d="M4 4l16 16M20 4 4 20" />,
  bed: (
    <>
      <path d="M3 8v12M21 12v8" />
      <path d="M3 16h18" />
      <path d="M3 12a3 3 0 0 1 3-3h7a4 4 0 0 1 4 4v3" />
      <path d="M8 11v2" />
    </>
  ),
  // --- backoffice ---
  dashboard: (
    <>
      <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-2 4 4" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.6 6.7A16.6 16.6 0 0 0 2 12s3.5 6 10 6a9.8 9.8 0 0 0 3.5-.6" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  sync: (
    <>
      <path d="M20 11a8 8 0 0 0-13.7-5.6L4 7.6" />
      <path d="M4 13a8 8 0 0 0 13.7 5.6L20 16.4" />
      <path d="M4 4v3.6h3.6M20 20v-3.6h-3.6" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v6M15 3v6" />
      <path d="M6 9h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 18v3" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V3h11v18M3 21h18" />
      <path d="M13 12h.01M16 3l3 1v17" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
};

export function Icon({ name, ...props }: IconProps) {
  const isFilled = name === "facebook" || name === "star";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

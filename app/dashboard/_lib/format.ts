// Display formatting only — storage stays UTC/ISO throughout (spec §66).
// Rendered in the office's timezone (WAT), not the server's UTC clock —
// this runs server-side in Server Components, so `undefined` locale/timezone
// options would render in the server's timezone, not the office's.

import { OFFICE_TIMEZONE } from "@/lib/timezone";

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: OFFICE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    timeZone: OFFICE_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function titleCase(value: string | null): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

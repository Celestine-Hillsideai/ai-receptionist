// The office's timezone for every "today" boundary and displayed
// time — WAT (West Africa Time, UTC+1, no DST ever observed). Storage
// stays UTC throughout (spec §66); this is the single place that
// converts for the office's local day.
export const OFFICE_TIMEZONE = "Africa/Lagos";

/** "Today" as YYYY-MM-DD in the office timezone, not the server's UTC clock. */
export function todayInOfficeTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OFFICE_TIMEZONE }).format(new Date());
}

/**
 * UTC instant bounds [start, end) for one office-timezone calendar day.
 * Africa/Lagos's offset is a fixed +01:00 (no DST), so building the instant
 * directly is safe — no generic timezone-offset resolution needed.
 */
export function officeDayBoundsUtc(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00.000+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

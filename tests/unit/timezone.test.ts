import { describe, expect, it, vi } from "vitest";
import { officeDayBoundsUtc, todayInOfficeTimezone } from "@/lib/timezone";

describe("officeDayBoundsUtc", () => {
  it("returns the WAT (UTC+1) day as UTC instants", () => {
    const { start, end } = officeDayBoundsUtc("2026-03-05");
    expect(start).toBe("2026-03-04T23:00:00.000Z");
    expect(end).toBe("2026-03-05T23:00:00.000Z");
  });
});

describe("todayInOfficeTimezone", () => {
  it("rolls over at WAT midnight, one hour before UTC midnight", () => {
    // 23:30 UTC on the 4th is already 00:30 WAT on the 5th.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T23:30:00.000Z"));
    expect(todayInOfficeTimezone()).toBe("2026-03-05");
    vi.useRealTimers();
  });

  it("still reads the same UTC calendar day mid-afternoon WAT", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00.000Z"));
    expect(todayInOfficeTimezone()).toBe("2026-03-05");
    vi.useRealTimers();
  });
});

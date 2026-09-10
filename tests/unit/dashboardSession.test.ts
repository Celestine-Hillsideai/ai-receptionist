import { describe, expect, it, vi } from "vitest";
import {
  createDashboardSessionCookie,
  verifyDashboardPassword,
  verifyDashboardSessionCookie,
} from "@/lib/services/dashboardSession";

describe("verifyDashboardPassword", () => {
  it("accepts the matching password", () => {
    expect(verifyDashboardPassword("hunter2", "hunter2")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyDashboardPassword("wrong", "hunter2")).toBe(false);
  });

  it("rejects a wrong password of different length", () => {
    expect(verifyDashboardPassword("nope", "hunter2")).toBe(false);
  });
});

describe("dashboard session cookie", () => {
  it("round-trips a freshly issued session", () => {
    const { value } = createDashboardSessionCookie("hunter2");
    expect(verifyDashboardSessionCookie(value, "hunter2")).toBe(true);
  });

  it("rejects a session signed with a different password", () => {
    const { value } = createDashboardSessionCookie("hunter2");
    expect(verifyDashboardSessionCookie(value, "other-password")).toBe(false);
  });

  it("rejects a missing session", () => {
    expect(verifyDashboardSessionCookie(null, "hunter2")).toBe(false);
    expect(verifyDashboardSessionCookie(undefined, "hunter2")).toBe(false);
  });

  it("rejects a tampered session value", () => {
    const { value } = createDashboardSessionCookie("hunter2");
    const [expiresAt] = value.split(".");
    expect(verifyDashboardSessionCookie(`${expiresAt}.deadbeef`, "hunter2")).toBe(false);
  });

  it("rejects an expired session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { value } = createDashboardSessionCookie("hunter2");

    vi.setSystemTime(60 * 60 * 24 * 8 * 1000); // 8 days later, past the 7-day max age
    expect(verifyDashboardSessionCookie(value, "hunter2")).toBe(false);
    vi.useRealTimers();
  });
});

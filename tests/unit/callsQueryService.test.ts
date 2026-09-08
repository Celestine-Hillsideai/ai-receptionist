import { describe, expect, it } from "vitest";
import { parseCallsListSearchParams } from "@/lib/services/callsQueryService";

describe("parseCallsListSearchParams", () => {
  it("defaults to page 1 and the standard page size with no params", () => {
    const params = parseCallsListSearchParams({});
    expect(params).toMatchObject({
      page: 1,
      pageSize: 25,
      search: null,
      urgency: null,
      intent: null,
      status: null,
      dateFrom: null,
      dateTo: null,
    });
  });

  it("parses valid enum and pagination values", () => {
    const params = parseCallsListSearchParams({
      page: "3",
      pageSize: "10",
      urgency: "critical",
      intent: "sales",
      status: "completed",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      search: "  acme  ",
    });
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(10);
    expect(params.urgency).toBe("critical");
    expect(params.intent).toBe("sales");
    expect(params.status).toBe("completed");
    expect(params.dateFrom).toBe("2026-01-01");
    expect(params.dateTo).toBe("2026-01-31");
    expect(params.search).toBe("acme");
  });

  it("drops invalid enum values instead of trusting unvalidated external input", () => {
    const params = parseCallsListSearchParams({
      urgency: "extremely-urgent",
      intent: "'; drop table calls;--",
      status: "not-a-status",
      dateFrom: "not-a-date",
    });
    expect(params.urgency).toBeNull();
    expect(params.intent).toBeNull();
    expect(params.status).toBeNull();
    expect(params.dateFrom).toBeNull();
  });

  it("clamps page size to the configured maximum and page to at least 1", () => {
    const params = parseCallsListSearchParams({ pageSize: "9999", page: "-5" });
    expect(params.pageSize).toBe(100);
    expect(params.page).toBe(1);
  });

  it("treats an empty search string as no search", () => {
    const params = parseCallsListSearchParams({ search: "   " });
    expect(params.search).toBeNull();
  });
});

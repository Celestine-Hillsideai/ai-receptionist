import { describe, expect, it } from "vitest";
import { parseFollowUpStatus, InvalidFollowUpStatusError } from "@/lib/services/followUpService";

describe("parseFollowUpStatus", () => {
  it("accepts every documented follow-up status", () => {
    for (const status of ["pending", "in_progress", "completed", "not_required"]) {
      expect(parseFollowUpStatus(status)).toBe(status);
    }
  });

  it("rejects an unknown status rather than trusting unvalidated form input (spec §75 Principle 2)", () => {
    expect(() => parseFollowUpStatus("done")).toThrow(InvalidFollowUpStatusError);
    expect(() => parseFollowUpStatus(null)).toThrow(InvalidFollowUpStatusError);
    expect(() => parseFollowUpStatus(undefined)).toThrow(InvalidFollowUpStatusError);
  });
});

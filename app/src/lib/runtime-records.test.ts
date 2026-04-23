import { describe, expect, it } from "vitest";
import { formatFieldKey, getFieldDisplayName } from "@/lib/runtime-records";

describe("runtime-records field labels", () => {
  it("prefers the configured field name", () => {
    expect(
      getFieldDisplayName({
        code: "ticket_id",
        name: "Ticket Number",
      })
    ).toBe("Ticket Number");
  });

  it("uses configured field names when formatting record detail labels", () => {
    expect(
      formatFieldKey("ticket_id", [
        {
          code: "ticket_id",
          name: "Ticket Number",
        },
      ])
    ).toBe("Ticket Number");
  });

  it("falls back to a formatted code when no field definition exists", () => {
    expect(formatFieldKey("custom_value")).toBe("custom value");
  });
});

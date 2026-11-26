import { describe, expect, it } from "vitest";
import { getStatusKind } from "@/lib/record-status";

describe("getStatusKind", () => {
  it.each([
    "完了",
    "承認済み",
    "解決済み",
    "approved",
    "done",
    "completed",
    "closed",
    "resolved",
  ])("treats %s as success", (status) => {
    expect(getStatusKind(status)).toBe("success");
  });

  it.each([
    "要確認",
    "承認待ち",
    "差戻し",
    "差し戻し",
    "pending",
    "review",
    "returned",
  ])("treats %s as warning", (status) => {
    expect(getStatusKind(status)).toBe("warning");
  });

  it.each([
    "却下",
    "rejected",
    "error",
    "failed",
    "canceled",
    "cancelled",
  ])("treats %s as danger", (status) => {
    expect(getStatusKind(status)).toBe("danger");
  });

  it("ignores case", () => {
    expect(getStatusKind("APPROVED")).toBe("success");
    expect(getStatusKind("Pending")).toBe("warning");
    expect(getStatusKind("Rejected")).toBe("danger");
    expect(getStatusKind("RESOLVED")).toBe("success");
  });

  it("ignores surrounding whitespace", () => {
    expect(getStatusKind("  approved  ")).toBe("success");
    expect(getStatusKind("\tpending\n")).toBe("warning");
    expect(getStatusKind("  却下  ")).toBe("danger");
  });

  it("checks danger before warning before success", () => {
    expect(getStatusKind("pending_approval")).toBe("warning");
    expect(getStatusKind("in_review")).toBe("warning");
    expect(getStatusKind("rejected_approval")).toBe("danger");
    expect(getStatusKind("failed_review")).toBe("danger");
    expect(getStatusKind("approved_but_returned")).toBe("warning");
  });

  it.each(["active", "open", "draft", "通常", "in_progress"])(
    "treats %s as neutral",
    (status) => {
      expect(getStatusKind(status)).toBe("neutral");
    }
  );

  it("treats 未-prefixed values as neutral instead of matching success substrings", () => {
    expect(getStatusKind("未完了")).toBe("neutral");
    expect(getStatusKind("未承認")).toBe("neutral");
    expect(getStatusKind("未解決")).toBe("neutral");
    expect(getStatusKind("未対応")).toBe("neutral");
    expect(getStatusKind("完了")).toBe("success");
  });

  it("treats empty values as neutral", () => {
    expect(getStatusKind(null)).toBe("neutral");
    expect(getStatusKind(undefined)).toBe("neutral");
    expect(getStatusKind("")).toBe("neutral");
    expect(getStatusKind("   ")).toBe("neutral");
  });
});

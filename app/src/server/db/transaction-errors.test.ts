import { describe, expect, it } from "vitest";
import { isTransactionConflict } from "@/server/db/transaction-errors";

describe("transaction conflict detection", () => {
  it.each([
    { code: "P2034" },
    { code: "40001" },
    { code: "40P01" },
    { name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict", originalCode: "40001" } },
    { cause: { cause: { code: "40001" } } },
  ])("recognizes conflicts returned by Prisma and the PostgreSQL driver", (error) => {
    expect(isTransactionConflict(error)).toBe(true);
  });

  it.each([undefined, null, new Error("unavailable"), { code: "P1001" }, { cause: { kind: "AuthenticationFailed" } }])("does not misclassify other failures", (error) => {
    expect(isTransactionConflict(error)).toBe(false);
  });

  it("bounds traversal of cyclic error causes", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(isTransactionConflict(error)).toBe(false);
  });
});

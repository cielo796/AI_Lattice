import { describe, expect, it } from "vitest";
import {
  DATABASE_SETUP_ERROR_CODE,
  isDatabaseSetupError,
  toDatabaseSetupErrorBody,
} from "@/server/db/setup-errors";

describe("database setup errors", () => {
  it("detects missing DATABASE_URL errors", () => {
    expect(isDatabaseSetupError(new Error("DATABASE_URL is not set"))).toBe(true);
  });

  it("detects missing Prisma table errors", () => {
    expect(
      isDatabaseSetupError(
        new Error("The table `(not available)` does not exist in the current database.")
      )
    ).toBe(true);
  });

  it("detects direct database connection failures", () => {
    const error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });

    expect(isDatabaseSetupError(error)).toBe(true);
  });

  it("detects nested database connection failures", () => {
    const error = new AggregateError([
      Object.assign(new Error("connect ECONNREFUSED ::1:5432"), {
        code: "ECONNREFUSED",
      }),
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
        code: "ECONNREFUSED",
      }),
    ]);

    expect(isDatabaseSetupError(error)).toBe(true);
  });

  it("builds an admin-oriented error response body", () => {
    const body = toDatabaseSetupErrorBody(new Error("DATABASE_URL is not set"));

    expect(body.code).toBe(DATABASE_SETUP_ERROR_CODE);
    expect(body.message).toContain("データベースのセットアップ");
    expect(body.adminHint).toContain("db:migrate:deploy");
    expect(body.healthCheckPath).toBe("/api/health/db");
  });

  it("includes nested connection details for aggregate errors", () => {
    const body = toDatabaseSetupErrorBody(
      new AggregateError([
        Object.assign(new Error("connect ECONNREFUSED ::1:5432"), {
          code: "ECONNREFUSED",
        }),
        Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
          code: "ECONNREFUSED",
        }),
      ])
    );

    expect(body.details).toContain("connect ECONNREFUSED ::1:5432");
    expect(body.details).toContain("connect ECONNREFUSED 127.0.0.1:5432");
  });
});

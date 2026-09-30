import { describe, expect, it } from "vitest";
import { getDatabaseSchema, getPostgresConnectionOptions } from "./connection.mjs";

describe("PostgreSQL schema connections", () => {
  it("defaults to public for existing local connections", () => {
    expect(getDatabaseSchema("postgresql://postgres:secret@localhost/app")).toBe("public");
  });

  it("keeps Prisma and unqualified SQL on the selected private schema", () => {
    const config = getPostgresConnectionOptions("postgresql://app:secret@localhost/postgres?schema=ai_lattice&sslmode=verify-full");
    const url = new URL(config.connectionString);
    expect(getDatabaseSchema("postgresql://app:secret@localhost/postgres?schema=ai_lattice")).toBe("ai_lattice");
    expect(url.searchParams.has("schema")).toBe(false);
    expect(url.searchParams.get("options")).toBe("-c search_path=ai_lattice");
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(config.connectionTimeoutMillis).toBe(10_000);
  });

  it("preserves other connection options while overriding a conflicting search path", () => {
    const config = getPostgresConnectionOptions("postgresql://app:secret@localhost/app?schema=ai_lattice&options=-c%20statement_timeout%3D5000%20-c%20search_path%3Dpublic");
    expect(new URL(config.connectionString).searchParams.get("options")).toBe("-c statement_timeout=5000 -c search_path=public -c search_path=ai_lattice");
  });

  it.each(["", "public,auth", "public -c role=postgres", "schema;drop", "Uppercase", "a".repeat(64)])("rejects invalid schema %s before connecting", (schema) => {
    expect(() => getPostgresConnectionOptions(`postgresql://app:secret@localhost/app?schema=${encodeURIComponent(schema)}`)).toThrow("DATABASE_URL schema");
  });
});

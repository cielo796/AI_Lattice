import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/db/route";
import type { DatabaseSetupHealth } from "@/server/db/setup-health";

const { checkDatabaseSetup } = vi.hoisted(() => ({
  checkDatabaseSetup: vi.fn(),
}));

vi.mock("@/server/db/setup-health", async () => {
  const actual = await vi.importActual<typeof import("@/server/db/setup-health")>(
    "@/server/db/setup-health"
  );

  return {
    ...actual,
    checkDatabaseSetup,
  };
});

function health(overrides: Partial<DatabaseSetupHealth>): DatabaseSetupHealth {
  return {
    status: "ok",
    checkedAt: "2026-04-25T00:00:00.000Z",
    message: "データベースセットアップは正常です。",
    database: {
      urlConfigured: true,
      connected: true,
    },
    migrations: {
      ok: true,
      expectedTables: [],
      missingTables: [],
      appliedMigrationCount: 2,
      failedMigrations: [],
      pendingMigrations: [],
    },
    seed: {
      ok: true,
      enabled: true,
      checked: true,
      missing: [],
    },
    ...overrides,
  };
}

describe("GET /api/health/db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when database setup is healthy", async () => {
    checkDatabaseSetup.mockResolvedValue(health({}));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
  });

  it("returns 503 when database setup is incomplete", async () => {
    checkDatabaseSetup.mockResolvedValue(
      health({
        status: "error",
        message: "データベースセットアップが未完了です。",
        migrations: {
          ok: false,
          expectedTables: ["tenants"],
          missingTables: ["tenants"],
          appliedMigrationCount: 0,
          failedMigrations: [],
          pendingMigrations: [],
        },
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.migrations.missingTables).toEqual(["tenants"]);
  });
});

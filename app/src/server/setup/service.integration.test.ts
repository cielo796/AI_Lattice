import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPrismaClient } from "@/server/db/prisma";
import { createInitialWorkspace } from "@/server/setup/service";

const connection = process.env.TEST_SETUP_DATABASE_URL;

describe.skipIf(!connection)("workspace setup against PostgreSQL", () => {
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", connection!);
    vi.stubEnv("DEMO_AUTO_SEED", "false");
    vi.stubEnv("SETUP_TOKEN", "integration-setup-token-at-least-32-characters");
    expect(await getPrismaClient().tenant.count(), "Use an empty, migrated test database").toBe(0);
  });

  afterAll(async () => {
    await getPrismaClient().$disconnect();
    vi.unstubAllEnvs();
  });

  it("commits exactly one organization and rolls back the competing initialization", async () => {
    const results = await Promise.allSettled(["first", "second"].map((name) => createInitialWorkspace({
      setupToken: process.env.SETUP_TOKEN,
      organizationName: name,
      organizationCode: `integration-${name}`,
      name: `Admin ${name}`,
      email: `${name}@integration.example`,
      password: "integration-admin-password",
    })));
    const successful = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatchObject({ status: 409 });
    const prisma = getPrismaClient();
    expect(await prisma.tenant.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.userRole.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { actionType: "WORKSPACE_SETUP" } })).toBe(1);
  });
});

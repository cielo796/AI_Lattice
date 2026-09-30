import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialWorkspace, getSetupStatus } from "@/server/setup/service";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), hashPassword: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/auth/crypto", () => ({ hashPassword: mocks.hashPassword }));

const token = "setup-test-token-with-at-least-32-characters";
const input = {
  setupToken: token, organizationName: "Example", organizationCode: "example",
  name: "Administrator", email: " ADMIN@EXAMPLE.COM ", password: "a-long-test-password",
};

function createDatabase() {
  const transaction = {
    tenant: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "tenant-1" }) },
    user: { create: vi.fn().mockResolvedValue({ id: "user-1", name: input.name, email: "admin@example.com", status: "active", createdAt: new Date() }) },
    role: { create: vi.fn().mockResolvedValue({ id: "role-1" }) },
    userRole: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { ...transaction, $transaction: vi.fn(async (callback) => callback(transaction)) };
}

describe("initial workspace setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEMO_AUTO_SEED", "false");
    vi.stubEnv("SETUP_TOKEN", token);
    mocks.hashPassword.mockResolvedValue("scrypt:hashed-password");
    mocks.getPrismaClient.mockReturnValue(createDatabase());
  });
  afterEach(() => vi.unstubAllEnvs());

  it("creates the organization, administrator, role and audit in one serializable transaction", async () => {
    const database = createDatabase();
    mocks.getPrismaClient.mockReturnValue(database);
    const result = await createInitialWorkspace(input);
    expect(result).not.toHaveProperty("passwordHash");
    expect(database.user.create).toHaveBeenCalledWith({ data: { tenantId: "tenant-1", name: input.name, email: "admin@example.com", passwordHash: "scrypt:hashed-password" } });
    expect(database.userRole.create).toHaveBeenCalledWith({ data: { tenantId: "tenant-1", userId: "user-1", roleId: "role-1", createdById: "user-1" } });
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain(token);
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain(input.password);
  });

  it.each([undefined, "wrong-token", "x".repeat(1025)])("rejects an invalid setup token before database access", async (setupToken) => {
    await expect(createInitialWorkspace({ ...input, setupToken })).rejects.toMatchObject({ status: 403 });
    expect(mocks.getPrismaClient).not.toHaveBeenCalled();
  });

  it.each(["", "short"])("disables setup when the configured token is insufficient", async (configured) => {
    vi.stubEnv("SETUP_TOKEN", configured);
    await expect(getSetupStatus()).resolves.toEqual({ available: false });
    await expect(createInitialWorkspace(input)).rejects.toMatchObject({ status: 403 });
  });

  it("does not offer setup in demo mode", async () => {
    vi.stubEnv("DEMO_AUTO_SEED", "true");
    await expect(getSetupStatus()).resolves.toEqual({ available: false });
    await expect(createInitialWorkspace(input)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects repeat setup without creating additional data", async () => {
    const database = createDatabase();
    database.tenant.count.mockResolvedValue(1);
    mocks.getPrismaClient.mockReturnValue(database);
    await expect(getSetupStatus()).resolves.toEqual({ available: false });
    await expect(createInitialWorkspace(input)).rejects.toMatchObject({ status: 409 });
    expect(database.tenant.create).not.toHaveBeenCalled();
  });

  it.each(["P2002", "P2034"])("reports concurrent setup conflicts (%s)", async (code) => {
    const database = createDatabase();
    database.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code, clientVersion: "7" }));
    mocks.getPrismaClient.mockReturnValue(database);
    await expect(createInitialWorkspace(input)).rejects.toMatchObject({ status: 409 });
  });

  it("maps a PostgreSQL adapter conflict during transaction commit to 409", async () => {
    const database = createDatabase();
    database.$transaction.mockRejectedValue(Object.assign(new Error("TransactionWriteConflict"), {
      name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
    }));
    mocks.getPrismaClient.mockReturnValue(database);
    await expect(createInitialWorkspace(input)).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    { organizationCode: "bad/code" }, { organizationCode: "-example" },
    { organizationName: " " }, { email: "not-an-email" }, { name: 42 },
    { password: "short" }, { password: "x".repeat(257) },
  ])("rejects invalid fields before beginning a transaction", async (invalid) => {
    await expect(createInitialWorkspace({ ...input, ...invalid })).rejects.toMatchObject({ status: 400 });
    expect(mocks.getPrismaClient).not.toHaveBeenCalled();
  });
});

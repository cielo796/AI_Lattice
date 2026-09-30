import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, createSessionForUser, getCurrentSession } from "@/server/auth/session";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  deleteCookie: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set, delete: mocks.deleteCookie }),
  headers: mocks.headers,
}));
vi.mock("@/server/db/prisma", () => ({
  getPrismaClient: () => ({
    session: { findUnique: mocks.findUnique, create: mocks.create, deleteMany: mocks.deleteMany },
  }),
}));

function activeSession() {
  return {
    id: "session-1",
    tenantId: "tenant-1",
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: "user-1", tenantId: "tenant-1", status: "active", tenant: { status: "active" } },
  };
}

describe("session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockReturnValue({ value: "session-token" });
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("does not access the database without a cookie", async () => {
    mocks.get.mockReturnValue(undefined);
    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a valid session for an active user and tenant", async () => {
    const session = activeSession();
    mocks.findUnique.mockResolvedValue(session);
    await expect(getCurrentSession()).resolves.toEqual(session);
  });

  it.each(["missing", "expired", "inactive-user", "inactive-tenant", "wrong-tenant"])(
    "rejects a %s session without mutating cookies during a server render",
    async (scenario) => {
      const session = activeSession();
      if (scenario === "expired") session.expiresAt = new Date(0);
      if (scenario === "inactive-user") session.user.status = "inactive";
      if (scenario === "inactive-tenant") session.user.tenant.status = "inactive";
      if (scenario === "wrong-tenant") session.tenantId = "tenant-2";
      mocks.findUnique.mockResolvedValue(scenario === "missing" ? null : session);

      await expect(getCurrentSession()).resolves.toBeNull();
      expect(mocks.set).not.toHaveBeenCalled();
      expect(mocks.deleteCookie).not.toHaveBeenCalled();
      expect(mocks.deleteMany).not.toHaveBeenCalled();
    }
  );

  it("sets a secure cookie for production hosts resembling localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost.example.com" }));
    await createSessionForUser({ id: "user-1", tenantId: "tenant-1" });
    expect(mocks.set).toHaveBeenCalledWith("stitch_session", expect.any(String), expect.objectContaining({ secure: true, httpOnly: true, sameSite: "lax" }));
    const token = mocks.set.mock.calls[0][1];
    expect(mocks.create.mock.calls[0][0].data.tokenHash).not.toBe(token);
  });

  it("revokes the persisted session and cookie on explicit logout", async () => {
    await clearSession();
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("stitch_session");
  });

  it("keeps production cookies secure even when a proxy reports plain HTTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.headers.mockResolvedValue(new Headers({ host: "app.example.com", "x-forwarded-proto": "http" }));
    await createSessionForUser({ id: "user-1", tenantId: "tenant-1" });
    expect(mocks.set).toHaveBeenCalledWith("stitch_session", expect.any(String), expect.objectContaining({ secure: true }));
  });
});

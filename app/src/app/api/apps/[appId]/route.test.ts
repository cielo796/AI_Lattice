import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/apps/[appId]/route";
import { AppsServiceError } from "@/server/apps/service";

const { requireAuthenticatedUser, deleteAppForUser, getAppForUser, updateAppForUser } =
  vi.hoisted(() => ({
    requireAuthenticatedUser: vi.fn(),
    deleteAppForUser: vi.fn(),
    getAppForUser: vi.fn(),
    updateAppForUser: vi.fn(),
  }));

vi.mock("@/app/api/_helpers", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_helpers")>(
    "@/app/api/_helpers"
  );

  return {
    ...actual,
    requireAuthenticatedUser,
  };
});

vi.mock("@/server/apps/service", async () => {
  const actual = await vi.importActual<typeof import("@/server/apps/service")>(
    "@/server/apps/service"
  );

  return {
    ...actual,
    deleteAppForUser,
    getAppForUser,
    updateAppForUser,
  };
});

describe("DELETE /api/apps/[appId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await DELETE(
      new Request("http://localhost/api/apps/app-001", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ appId: "app-001" }),
      }
    );

    expect(response.status).toBe(401);
  });

  it("returns 204 when delete succeeds", async () => {
    const user = {
      id: "u-001",
      tenantId: "t-001",
    };

    requireAuthenticatedUser.mockResolvedValue(user);
    deleteAppForUser.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/apps/app-001", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ appId: "app-001" }),
      }
    );

    expect(response.status).toBe(204);
    expect(deleteAppForUser).toHaveBeenCalledWith(user, "app-001");
  });
});

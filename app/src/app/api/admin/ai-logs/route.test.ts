import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/ai-logs/route";
import { AppsServiceError } from "@/server/apps/service";

const { listAIExecutionLogsForUser, requireAuthenticatedUser, requirePermission } =
  vi.hoisted(() => ({
    listAIExecutionLogsForUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    requirePermission: vi.fn(),
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

vi.mock("@/server/ai/model-gateway", () => ({
  MAX_AI_LOG_LIMIT: 500,
  listAIExecutionLogsForUser,
}));

vi.mock("@/server/admin/rbac", () => ({
  requirePermission,
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
};

describe("GET /api/admin/ai-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue(user);
    requirePermission.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await GET(new Request("http://localhost/api/admin/ai-logs"));

    expect(response.status).toBe(401);
    expect(listAIExecutionLogsForUser).not.toHaveBeenCalled();
  });

  it("lists AI execution logs with filters", async () => {
    const logs = [
      {
        id: "log-001",
        operation: "app_blueprint.generate",
        status: "success",
      },
    ];
    listAIExecutionLogsForUser.mockResolvedValue(logs);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai-logs?status=success&operation=app_blueprint.generate&limit=25"
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(logs);
    expect(listAIExecutionLogsForUser).toHaveBeenCalledWith(user, {
      limit: 25,
      operation: "app_blueprint.generate",
      status: "success",
    });
  });
});

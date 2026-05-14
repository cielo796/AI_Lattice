import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppsServiceError } from "@/server/apps/service";
import { POST } from "@/app/api/apps/generate/route";

const { getTenantOpenAIApiKey, requireAuthenticatedUser } = vi.hoisted(() => ({
  getTenantOpenAIApiKey: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
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

vi.mock("@/server/admin/openai-settings", () => ({
  getTenantOpenAIApiKey,
}));

describe("POST /api/apps/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    getTenantOpenAIApiKey.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await POST(
      new Request("http://localhost/api/apps/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "Support desk" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 503 when OPENAI_API_KEY is missing", async () => {
    requireAuthenticatedUser.mockResolvedValue({
      id: "u-001",
      tenantId: "t-001",
    });

    const response = await POST(
      new Request("http://localhost/api/apps/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "Support desk" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toContain("OPENAI_API_KEY");
  });
});

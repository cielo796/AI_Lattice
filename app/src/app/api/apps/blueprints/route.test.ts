import { describe, expect, it, vi } from "vitest";
import { AppsServiceError } from "@/server/apps/service";
import { POST } from "@/app/api/apps/blueprints/route";

const { requireAuthenticatedUser } = vi.hoisted(() => ({
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

describe("POST /api/apps/blueprints", () => {
  it("returns 401 when unauthenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await POST(
      new Request("http://localhost/api/apps/blueprints", {
        method: "POST",
        body: JSON.stringify({
          name: "Support Desk",
          code: "support-desk",
          description: "Customer support incident tracking",
          aiInsight: "Start with tickets.",
          tables: [],
        }),
      })
    );

    expect(response.status).toBe(401);
  });
});

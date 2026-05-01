import { describe, expect, it } from "vitest";
import { toRouteErrorResponse } from "@/app/api/_helpers";
import { AppsServiceError } from "@/server/apps/service";

describe("toRouteErrorResponse", () => {
  it("keeps application service errors as-is", async () => {
    const response = toRouteErrorResponse(new AppsServiceError("Not found", 404));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Not found");
  });

  it("returns a setup-specific 503 for database setup errors", async () => {
    const response = toRouteErrorResponse(new Error("DATABASE_URL is not set"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("DATABASE_SETUP_REQUIRED");
    expect(body.healthCheckPath).toBe("/api/health/db");
  });
});

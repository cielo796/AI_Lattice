import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/server/workflows/scheduler", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/workflows/scheduler")>(), runDueScheduledWorkflows: mocks.run }));
const secret = "test-only-schedule-cron-secret-32-characters";

function request(limit = "", authorization = `Bearer ${secret}`) {
  return new Request(`http://localhost/api/internal/workflows/schedules/run${limit}`, { method: "POST", headers: { authorization } });
}

describe("internal schedule producer endpoint", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", secret); mocks.run.mockResolvedValue({ recordCount: 1, queuedRunCount: 1, failures: [] }); });
  afterEach(() => vi.unstubAllEnvs());

  it("requires a configured secret and rejects cookie-only or incorrect authentication", async () => {
    expect((await POST(request("", ""))).status).toBe(401);
    expect((await POST(request("", "Bearer wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "short");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "501", "1.5", "10junk", "NaN", "Infinity"])("rejects malformed or unbounded limits: %s", async (value) => {
    expect((await POST(request(`?limit=${value}`))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("returns queue counts, not synchronous approval counts", async () => {
    const response = await POST(request("?limit=7"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ queuedRunCount: 1 });
    expect(mocks.run).toHaveBeenCalledWith(7);
    await POST(request());
    expect(mocks.run).toHaveBeenLastCalledWith(undefined);
  });

  it("reports partial producer failure without claiming all records were scheduled", async () => {
    mocks.run.mockResolvedValue({ recordCount: 0, failures: [{ workflowId: "workflow", message: "queue unavailable", backoffPersisted: false }] });
    expect((await POST(request())).status).toBe(207);
  });
});

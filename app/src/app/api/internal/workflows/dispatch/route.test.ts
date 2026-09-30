import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ dispatchPendingWorkflowRuns: vi.fn() }));
vi.mock("@/server/workflows/worker", () => ({ dispatchPendingWorkflowRuns: mocks.dispatchPendingWorkflowRuns }));
const secret = "test-only-workflow-cron-secret-32-characters";

describe("internal workflow dispatch endpoint", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); mocks.dispatchPendingWorkflowRuns.mockResolvedValue({ recovered: [], processed: [], failures: [] }); });

  it.each(["", "short", "replace-with-a-long-random-value-32"])("fails closed for an unconfigured or unsafe secret", async (value) => {
    vi.stubEnv("CRON_SECRET", value);
    expect((await POST(new Request("http://localhost/api/internal/workflows/dispatch", { method: "POST" }))).status).toBe(503);
    expect(mocks.dispatchPendingWorkflowRuns).not.toHaveBeenCalled();
  });

  it("rejects missing and incorrect credentials before reading any jobs", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    for (const authorization of ["", "Bearer wrong", `Bearer ${secret.slice(0, -1)}X`]) {
      expect((await POST(new Request("http://localhost/api/internal/workflows/dispatch", { method: "POST", headers: { authorization } }))).status).toBe(401);
    }
    expect(mocks.dispatchPendingWorkflowRuns).not.toHaveBeenCalled();
  });

  it("dispatches an authenticated bounded batch and reports partial infrastructure failure", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    mocks.dispatchPendingWorkflowRuns.mockResolvedValue({ recovered: [], processed: [], failures: [{ id: "run", message: "offline" }] });
    const response = await POST(new Request("http://localhost/api/internal/workflows/dispatch?limit=4", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(207);
    expect(mocks.dispatchPendingWorkflowRuns).toHaveBeenCalledWith(4);
  });
});

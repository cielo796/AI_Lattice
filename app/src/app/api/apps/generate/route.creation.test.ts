import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/apps/generate/route";

const { requireAuthenticatedUser, generateBlueprintFromPrompt, adjustBlueprintFromInstruction, getBlueprintModelInfo } = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn(), generateBlueprintFromPrompt: vi.fn(), adjustBlueprintFromInstruction: vi.fn(), getBlueprintModelInfo: vi.fn() }));
vi.mock("@/app/api/_helpers", async () => ({ ...await vi.importActual("@/app/api/_helpers"), requireAuthenticatedUser, recordRouteFailure: vi.fn() }));
vi.mock("@/server/apps/blueprints", () => ({ generateBlueprintFromPrompt, adjustBlueprintFromInstruction, getBlueprintModelInfo }));

const user = { id: "user", tenantId: "tenant" };
beforeEach(() => { vi.clearAllMocks(); requireAuthenticatedUser.mockResolvedValue(user); });

describe("blueprint generation routes", () => {
  it("returns server-resolved model provenance without an AI request", async () => {
    getBlueprintModelInfo.mockResolvedValue({ model: "model", source: "template", templateName: "専用テンプレート" });
    expect(await (await GET()).json()).toEqual({ model: "model", source: "template", templateName: "専用テンプレート" });
    expect(getBlueprintModelInfo).toHaveBeenCalledWith(user);
    expect(generateBlueprintFromPrompt).not.toHaveBeenCalled();
  });
  it("requires authentication before exposing model settings", async () => {
    const { AppsServiceError } = await import("@/server/apps/service");
    requireAuthenticatedUser.mockRejectedValue(new AppsServiceError("Unauthorized", 401));
    expect((await GET()).status).toBe(401);
    expect(getBlueprintModelInfo).not.toHaveBeenCalled();
  });
  it("passes the request abort signal through the regular generation route", async () => {
    generateBlueprintFromPrompt.mockResolvedValue({ name: "Draft" });
    const request = new Request("http://localhost/api/apps/generate", { method: "POST", body: JSON.stringify({ prompt: "在庫管理" }) });
    expect((await POST(request)).status).toBe(200);
    expect(generateBlueprintFromPrompt).toHaveBeenCalledWith("在庫管理", user, undefined, request.signal);
  });
  it("adjusts an unsaved blueprint without saving an app", async () => {
    const blueprint = { name: "Current" };
    adjustBlueprintFromInstruction.mockResolvedValue({ name: "Adjusted" });
    const request = new Request("http://localhost/api/apps/generate", { method: "POST", body: JSON.stringify({ prompt: "期限を追加", blueprint }) });
    expect(await (await POST(request)).json()).toEqual({ name: "Adjusted" });
    expect(adjustBlueprintFromInstruction).toHaveBeenCalledWith("期限を追加", blueprint, user, undefined, request.signal);
    expect(generateBlueprintFromPrompt).not.toHaveBeenCalled();
  });
});

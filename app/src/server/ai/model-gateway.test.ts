import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateJsonWithModelGateway,
  listAIExecutionLogsForUser,
} from "@/server/ai/model-gateway";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/openai/client", () => ({
  getOpenAIClient: vi.fn(),
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
  email: "marcus.chen@acme.com",
  name: "Marcus Chen",
};

function request() {
  return {
    user,
    operation: "app_blueprint.generate",
    model: "gpt-5-mini",
    instructions: "Return JSON only.",
    input: "Support desk",
    responseFormatName: "generated_app_blueprint",
    responseSchema: { type: "object" },
  };
}

describe("model gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPrismaClient.mockReturnValue({
      aiExecutionLog: {
        create: vi.fn().mockResolvedValue({ id: "log-001" }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
  });

  it("calls OpenAI through the gateway and records a success log", async () => {
    const client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: "{\"ok\":true}",
          usage: {
            input_tokens: 12,
            output_tokens: 8,
            total_tokens: 20,
          },
        }),
      },
    };

    const response = await generateJsonWithModelGateway(request(), client);
    const prisma = getPrismaClient();

    expect(response.outputText).toBe("{\"ok\":true}");
    expect(response.usage).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });
    expect(client.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        instructions: "Return JSON only.",
        input: "Support desk",
        text: {
          format: expect.objectContaining({
            name: "generated_app_blueprint",
            strict: true,
          }),
        },
      })
    );
    expect(prisma.aiExecutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t-001",
        actorId: "u-001",
        operation: "app_blueprint.generate",
        modelName: "gpt-5-mini",
        status: "success",
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        outputJson: { outputText: "{\"ok\":true}" },
      }),
    });
  });

  it("records an error log while preserving the normalized model error", async () => {
    const client = {
      responses: {
        create: vi.fn().mockRejectedValue(new Error("Request timed out.")),
      },
    };

    await expect(generateJsonWithModelGateway(request(), client)).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining("タイムアウト"),
    });

    const prisma = getPrismaClient();
    expect(prisma.aiExecutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "error",
        errorMessage: expect.stringContaining("タイムアウト"),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }),
    });
  });

  it("lists execution logs for the current tenant", async () => {
    const prisma = {
      aiExecutionLog: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "log-001",
            tenantId: "t-001",
            appId: "app-001",
            recordId: null,
            promptTemplateVersionId: null,
            actorId: "u-001",
            operation: "app_refinement.preview",
            provider: "openai",
            modelName: "gpt-5-mini",
            status: "success",
            inputJson: { input: "refine" },
            outputJson: { outputText: "{\"summary\":\"ok\"}" },
            errorMessage: null,
            promptTokens: 4,
            completionTokens: 6,
            totalTokens: 10,
            durationMs: 123,
            createdAt: new Date("2026-06-10T00:00:00.000Z"),
            actor: { name: "Marcus Chen", email: "marcus.chen@acme.com" },
            app: { name: "Planning", code: "planning" },
            promptTemplateVersion: null,
          },
        ]),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    const logs = await listAIExecutionLogsForUser(user, {
      status: "success",
      limit: 50,
    });

    expect(prisma.aiExecutionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t-001",
          status: "success",
        },
        take: 50,
      })
    );
    expect(logs[0]).toEqual(
      expect.objectContaining({
        id: "log-001",
        appName: "Planning",
        actorName: "Marcus Chen",
        totalTokens: 10,
      })
    );
  });
});

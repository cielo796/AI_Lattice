import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/server/openai/client";
import { AppsServiceError } from "@/server/apps/service";
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
      tenantAIModelSettings: { findUnique: vi.fn().mockResolvedValue(null) },
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

  it("refuses a missing explicitly selected prompt instead of silently changing instructions", async () => {
    const prisma = getPrismaClient();
    getPrismaClient.mockReturnValue({ ...prisma, promptTemplateVersion: { findFirst: vi.fn().mockResolvedValue(null) } });
    const client = { responses: { create: vi.fn() } };
    await expect(generateJsonWithModelGateway({ ...request(), promptTemplateKey: "explicit-template", requirePromptTemplate: true }, client)).rejects.toMatchObject({ status: 400 });
    expect(client.responses.create).not.toHaveBeenCalled();
  });

  it("reports the effective model selected by the active prompt template", async () => {
    const prisma = getPrismaClient();
    getPrismaClient.mockReturnValue({ ...prisma, promptTemplateVersion: { findFirst: vi.fn().mockResolvedValue({ id: "version", version: 1, modelName: "configured-model", instructions: "Configured instructions", responseSchemaJson: null, promptTemplate: { key: "explicit-template", name: "Template", operation: request().operation } }) } });
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: "{}" }) } };
    const result = await generateJsonWithModelGateway({ ...request(), model: undefined, promptTemplateKey: "explicit-template", requirePromptTemplate: true }, client);
    expect(result.modelName).toBe("configured-model");
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "configured-model", instructions: "Configured instructions" }));
  });

  it("inherits the latest low-cost default when no template or tenant selection exists", async () => {
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: "{}" }) } };
    const result = await generateJsonWithModelGateway({ ...request(), model: undefined }, client);
    expect(result.modelName).toBe("gpt-6-luna");
    expect(getPrismaClient().tenantAIModelSettings.findUnique).toHaveBeenCalledWith({ where: { tenantId: user.tenantId } });
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-6-luna" }));
  });

  it.each(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"])("uses the tenant selection %s without changing the strict response schema", async (model) => {
    getPrismaClient().tenantAIModelSettings.findUnique.mockResolvedValue({ defaultModel: model });
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: "{}" }) } };
    const result = await generateJsonWithModelGateway({ ...request(), model: undefined }, client);
    expect(result.modelName).toBe(model);
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model, text: { format: { type: "json_schema", name: request().responseFormatName, strict: true, schema: request().responseSchema } } }));
    expect(getPrismaClient().aiExecutionLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ modelName: model, status: "success" }) });
  });

  it("keeps an explicit workflow model ahead of the template and tenant choices", async () => {
    const prisma = getPrismaClient();
    prisma.tenantAIModelSettings.findUnique.mockResolvedValue({ defaultModel: "gpt-6-astra" });
    getPrismaClient.mockReturnValue({ ...prisma, promptTemplateVersion: { findFirst: vi.fn().mockResolvedValue({ id: "version", version: 1, modelName: "gpt-6-luna", instructions: "Template instructions", responseSchemaJson: null, promptTemplate: { key: "explicit-template", name: "Template", operation: request().operation } }) } });
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: "{}" }) } };
    const result = await generateJsonWithModelGateway({ ...request(), model: "gpt-6.1-sol", promptTemplateKey: "explicit-template", requirePromptTemplate: true }, client);
    expect(result.modelName).toBe("gpt-6.1-sol");
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-6.1-sol", instructions: "Template instructions" }));
    expect(prisma.tenantAIModelSettings.findUnique).not.toHaveBeenCalled();
  });

  it("does not silently use another model when a selected model is unavailable", async () => {
    getPrismaClient().tenantAIModelSettings.findUnique.mockResolvedValue({ defaultModel: "gpt-6-astra" });
    const client = { responses: { create: vi.fn().mockRejectedValue(Object.assign(new Error("Model access denied"), { status: 403 })) } };
    await expect(generateJsonWithModelGateway({ ...request(), model: undefined }, client)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("Model access denied") });
    expect(client.responses.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: "gpt-6-astra" }));
  });

  it("does not issue a paid request if the model settings cannot be read", async () => {
    getPrismaClient().tenantAIModelSettings.findUnique.mockRejectedValue(new Error("Settings database unavailable"));
    const client = { responses: { create: vi.fn() } };
    await expect(generateJsonWithModelGateway({ ...request(), model: undefined }, client)).rejects.toMatchObject({ status: 502 });
    expect(client.responses.create).not.toHaveBeenCalled();
  });

  it("preserves the missing API key error before reading optional model settings", async () => {
    vi.mocked(getOpenAIClient).mockRejectedValueOnce(new AppsServiceError("OPENAI_API_KEY is missing", 503));
    await expect(generateJsonWithModelGateway({ ...request(), model: undefined })).rejects.toMatchObject({ status: 503 });
    expect(getPrismaClient().tenantAIModelSettings.findUnique).not.toHaveBeenCalled();
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

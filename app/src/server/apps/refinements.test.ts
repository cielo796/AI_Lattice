import { beforeEach, describe, expect, it, vi } from "vitest";
import { refineAppWithAI } from "@/server/apps/refinements";
import type { AppField, AppTable } from "@/types/app";

const MockAppsServiceError = vi.hoisted(
  () =>
    class AppsServiceError extends Error {
      status: number;

      constructor(message: string, status: number) {
        super(message);
        this.name = "AppsServiceError";
        this.status = status;
      }
    }
);

const serviceMocks = vi.hoisted(() => ({
  createFieldForTable: vi.fn(),
  createFormForTable: vi.fn(),
  createTableForApp: vi.fn(),
  createViewForTable: vi.fn(),
  getAppForUser: vi.fn(),
  listFieldsForTable: vi.fn(),
  listFormsForTable: vi.fn(),
  listTablesForApp: vi.fn(),
  listViewsForTable: vi.fn(),
  updateFieldForTable: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  recordAuditLog: vi.fn(),
}));

vi.mock("@/server/apps/service", () => ({
  AppsServiceError: MockAppsServiceError,
  ...serviceMocks,
}));

vi.mock("@/server/audit/service", () => auditMocks);

const user = {
  id: "u-001",
  tenantId: "t-001",
  email: "marcus.chen@acme.com",
  name: "Marcus Chen",
  status: "active" as const,
  createdAt: "2025-01-15T00:00:00Z",
};

const table: AppTable = {
  id: "tbl-plan",
  tenantId: "t-001",
  appId: "app-001",
  name: "Production plan",
  code: "production-plan",
  isSystem: false,
  sortOrder: 0,
  createdAt: "2026-04-24T00:00:00.000Z",
};

const fields: AppField[] = [
  {
    id: "fld-status",
    tenantId: "t-001",
    appId: "app-001",
    tableId: "tbl-plan",
    name: "Status",
    code: "status",
    fieldType: "select",
    required: false,
    uniqueFlag: false,
    settingsJson: { options: ["planned", "running", "done"] },
    sortOrder: 0,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
  {
    id: "fld-start",
    tenantId: "t-001",
    appId: "app-001",
    tableId: "tbl-plan",
    name: "Start date",
    code: "start_date",
    fieldType: "date",
    required: false,
    uniqueFlag: false,
    sortOrder: 1,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
];

function makeClient(output: unknown) {
  return {
    responses: {
      create: vi.fn().mockResolvedValue({
        output_text: JSON.stringify(output),
      }),
    },
  };
}

describe("app AI refinements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getAppForUser.mockResolvedValue({
      id: "app-001",
      tenantId: "t-001",
      name: "Planning",
      code: "planning",
      description: "Production planning",
      status: "draft",
      icon: "apps",
      createdBy: "u-001",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    });
    serviceMocks.listTablesForApp.mockResolvedValue([table]);
    serviceMocks.listFieldsForTable.mockResolvedValue(fields);
    serviceMocks.listViewsForTable.mockResolvedValue([]);
    serviceMocks.listFormsForTable.mockResolvedValue([]);
    serviceMocks.createTableForApp.mockImplementation(async (_user, appId, input) => ({
      id: "tbl-maintenance",
      tenantId: "t-001",
      appId,
      name: input.name,
      code: input.code,
      isSystem: false,
      sortOrder: 1,
      createdAt: "2026-04-24T00:00:00.000Z",
    }));
    serviceMocks.createFieldForTable.mockImplementation(async (_user, _appId, tableId, input) => ({
      id: "fld-sla",
      tenantId: "t-001",
      appId: "app-001",
      tableId,
      name: input.name,
      code: input.code,
      fieldType: input.fieldType,
      required: input.required ?? false,
      uniqueFlag: false,
      settingsJson: input.settingsJson,
      sortOrder: 2,
      createdAt: "2026-04-24T00:00:00.000Z",
    }));
    serviceMocks.createViewForTable.mockImplementation(async (_user, _appId, tableId, input) => ({
      id: "view-calendar",
      tenantId: "t-001",
      appId: "app-001",
      tableId,
      name: input.name,
      viewType: input.viewType,
      settingsJson: input.settingsJson,
      sortOrder: 0,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    }));
  });

  it("applies generated field and view operations", async () => {
    const client = makeClient({
      summary: "SLA field and calendar view were added.",
      operations: [
        {
          action: "add_field",
          tableCode: "production-plan",
          tableName: "",
          fieldCode: "sla_status",
          fieldName: "SLA Status",
          fieldType: "select",
          setRequired: false,
          required: false,
          options: ["on_track", "at_risk", "breached"],
          viewName: "",
          viewType: "list",
          columns: [],
          groupByFieldCode: "",
          dateFieldCode: "",
          metricFieldCode: "",
          formName: "",
          formFieldCodes: [],
          helpText: "",
        },
        {
          action: "add_view",
          tableCode: "production-plan",
          tableName: "",
          fieldCode: "",
          fieldName: "",
          fieldType: "",
          setRequired: false,
          required: false,
          options: [],
          viewName: "SLA Calendar",
          viewType: "calendar",
          columns: ["status", "sla_status", "start_date"],
          groupByFieldCode: "",
          dateFieldCode: "start_date",
          metricFieldCode: "",
          formName: "",
          formFieldCodes: [],
          helpText: "",
        },
      ],
    });

    const result = await refineAppWithAI(
      user,
      "app-001",
      {
        instruction: "SLAステータスを追加してカレンダーを作って",
        activeTableCode: "production-plan",
      },
      client
    );

    expect(serviceMocks.createFieldForTable).toHaveBeenCalledWith(
      user,
      "app-001",
      "tbl-plan",
      expect.objectContaining({
        name: "SLA Status",
        code: "sla_status",
        fieldType: "select",
        settingsJson: { options: ["on_track", "at_risk", "breached"] },
      })
    );
    expect(serviceMocks.createViewForTable).toHaveBeenCalledWith(
      user,
      "app-001",
      "tbl-plan",
      expect.objectContaining({
        name: "SLA Calendar",
        viewType: "calendar",
        settingsJson: expect.objectContaining({
          columns: ["status", "sla_status", "start_date"],
          dateFieldCode: "start_date",
        }),
      })
    );
    expect(result.changes.map((change) => change.type)).toEqual([
      "field_created",
      "view_created",
    ]);
    expect(auditMocks.recordAuditLog).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        actionType: "APP_REFINE",
        aiInvolvement: "assisted",
      })
    );
  });

  it("adds a table before applying later operations to it", async () => {
    const client = makeClient({
      summary: "Maintenance table was added.",
      operations: [
        {
          action: "add_table",
          tableCode: "maintenance-requests",
          tableName: "Maintenance requests",
          fieldCode: "",
          fieldName: "",
          fieldType: "",
          setRequired: false,
          required: false,
          options: [],
          viewName: "",
          viewType: "list",
          columns: [],
          groupByFieldCode: "",
          dateFieldCode: "",
          metricFieldCode: "",
          formName: "",
          formFieldCodes: [],
          helpText: "",
        },
        {
          action: "add_field",
          tableCode: "maintenance-requests",
          tableName: "",
          fieldCode: "request_status",
          fieldName: "Request status",
          fieldType: "select",
          setRequired: false,
          required: false,
          options: ["open", "in_progress", "done"],
          viewName: "",
          viewType: "list",
          columns: [],
          groupByFieldCode: "",
          dateFieldCode: "",
          metricFieldCode: "",
          formName: "",
          formFieldCodes: [],
          helpText: "",
        },
      ],
    });

    const result = await refineAppWithAI(
      user,
      "app-001",
      { instruction: "メンテナンス依頼テーブルを追加して" },
      client
    );

    expect(serviceMocks.createTableForApp).toHaveBeenCalledWith(
      user,
      "app-001",
      expect.objectContaining({
        name: "Maintenance requests",
        code: "maintenance-requests",
      })
    );
    expect(serviceMocks.createFieldForTable).toHaveBeenCalledWith(
      user,
      "app-001",
      "tbl-maintenance",
      expect.objectContaining({
        code: "request_status",
        fieldType: "select",
      })
    );
    expect(result.changes.map((change) => change.type)).toEqual([
      "table_created",
      "field_created",
    ]);
  });

  it("updates required only when the AI marks it explicit", async () => {
    serviceMocks.updateFieldForTable.mockResolvedValue({
      ...fields[0],
      name: "Status label",
    });
    const client = makeClient({
      summary: "Status label was renamed.",
      operations: [
        {
          action: "update_field",
          tableCode: "production-plan",
          tableName: "",
          fieldCode: "status",
          fieldName: "Status label",
          fieldType: "",
          setRequired: false,
          required: false,
          options: [],
          viewName: "",
          viewType: "list",
          columns: [],
          groupByFieldCode: "",
          dateFieldCode: "",
          metricFieldCode: "",
          formName: "",
          formFieldCodes: [],
          helpText: "",
        },
      ],
    });

    await refineAppWithAI(
      user,
      "app-001",
      { instruction: "ステータスの表示名を変えて" },
      client
    );

    expect(serviceMocks.updateFieldForTable).toHaveBeenCalledWith(
      user,
      "app-001",
      "tbl-plan",
      "fld-status",
      {
        name: "Status label",
        fieldType: undefined,
      }
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  getChartBuckets,
  getDateFieldCode,
  getGroupFieldCode,
  getMetricFieldCode,
  groupRecordsByDate,
  groupRecordsByField,
} from "@/lib/runtime-views";
import type { AppField, AppView } from "@/types/app";
import type { AppRecord } from "@/types/record";

const fields: AppField[] = [
  {
    id: "fld_status",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    name: "ステータス",
    code: "status",
    fieldType: "select",
    required: false,
    uniqueFlag: false,
    settingsJson: { options: ["未対応", "対応中", "完了"] },
    sortOrder: 0,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
  {
    id: "fld_due_date",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    name: "期限",
    code: "due_date",
    fieldType: "date",
    required: false,
    uniqueFlag: false,
    sortOrder: 1,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
  {
    id: "fld_amount",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    name: "金額",
    code: "amount",
    fieldType: "number",
    required: false,
    uniqueFlag: false,
    sortOrder: 2,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
];

const records: AppRecord[] = [
  {
    id: "rec_1",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    status: "active",
    data: {
      title: "Record 1",
      status: "未対応",
      due_date: "2026-05-01",
      amount: 100,
    },
    createdBy: "user_1",
    updatedBy: "user_1",
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
  },
  {
    id: "rec_2",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    status: "active",
    data: {
      title: "Record 2",
      status: "対応中",
      due_date: "2026-05-01",
      amount: 250,
    },
    createdBy: "user_1",
    updatedBy: "user_1",
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
  },
  {
    id: "rec_3",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    status: "closed",
    data: {
      title: "Record 3",
      status: "未対応",
      due_date: "2026-05-02",
      amount: 50,
    },
    createdBy: "user_1",
    updatedBy: "user_1",
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
  },
];

function makeView(settingsJson: Record<string, unknown>): AppView {
  return {
    id: "view_1",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    name: "Runtime view",
    viewType: "chart",
    settingsJson,
    sortOrder: 0,
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
  };
}

describe("runtime view helpers", () => {
  it("uses configured runtime fields when they are valid", () => {
    const view = makeView({
      groupByFieldCode: "status",
      dateFieldCode: "due_date",
      metricFieldCode: "amount",
    });

    expect(getGroupFieldCode(view, fields)).toBe("status");
    expect(getDateFieldCode(view, fields)).toBe("due_date");
    expect(getMetricFieldCode(view, fields)).toBe("amount");
  });

  it("groups records by configured select options", () => {
    const groups = groupRecordsByField(records, "status", fields);

    expect(groups.map((group) => [group.label, group.records.length])).toEqual([
      ["未対応", 2],
      ["対応中", 1],
      ["完了", 0],
    ]);
  });

  it("groups calendar records by date", () => {
    const groups = groupRecordsByDate(records, "due_date");

    expect(groups.map((group) => [group.key, group.records.length])).toEqual([
      ["2026-05-01", 2],
      ["2026-05-02", 1],
    ]);
  });

  it("aggregates chart buckets with numeric metrics", () => {
    const buckets = getChartBuckets(
      records,
      fields,
      makeView({
        groupByFieldCode: "status",
        metricFieldCode: "amount",
      })
    );

    expect(buckets.map((bucket) => [bucket.label, bucket.value])).toEqual([
      ["対応中", 250],
      ["未対応", 150],
    ]);
  });
});

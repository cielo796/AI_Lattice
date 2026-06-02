import { describe, expect, it } from "vitest";
import {
  formatMonthLabel,
  getCalendarDays,
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
    name: "Status",
    code: "status",
    fieldType: "select",
    required: false,
    uniqueFlag: false,
    settingsJson: { options: ["todo", "doing", "done"] },
    sortOrder: 0,
    createdAt: "2026-04-24T00:00:00.000Z",
  },
  {
    id: "fld_due_date",
    tenantId: "tenant_1",
    appId: "app_1",
    tableId: "table_1",
    name: "Due date",
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
    name: "Amount",
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
      status: "todo",
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
      status: "doing",
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
      status: "todo",
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
      ["todo", 2],
      ["doing", 1],
      ["done", 0],
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
      ["doing", 250],
      ["todo", 150],
    ]);
  });

  it("uses record counts for chart buckets when no metric field is configured", () => {
    const buckets = getChartBuckets(
      records,
      fields.filter((field) => field.fieldType !== "number"),
      makeView({
        groupByFieldCode: "status",
      })
    );

    expect(buckets.map((bucket) => bucket.value)).toEqual([2, 1]);
  });

  it("builds month calendar cells with records on matching dates", () => {
    const days = getCalendarDays(
      "2026-05",
      new Map([
        ["2026-05-01", [records[0], records[1]]],
        ["2026-05-02", [records[2]]],
      ])
    );

    expect(formatMonthLabel("2026-05")).toContain("2026");
    expect(days.find((day) => day.key === "2026-05-01")?.records).toHaveLength(2);
    expect(days.find((day) => day.key === "2026-05-02")?.records).toHaveLength(1);
  });
});

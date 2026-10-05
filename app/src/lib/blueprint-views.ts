import type { GeneratedBlueprintTable } from "@/types/ai";

const GROUP_FIELD_CODES = new Set(["status", "state", "stage", "priority", "approval_status"]);

export function buildInitialViewsForTable(table: GeneratedBlueprintTable) {
  const columns = table.fields.slice(0, 4).map((field) => field.code);
  const groupField = table.fields.find((field) => GROUP_FIELD_CODES.has(field.code)) ?? table.fields.find((field) => field.fieldType === "select" || field.fieldType === "boolean");
  const dateField = table.fields.find((field) => field.fieldType === "date" || field.fieldType === "datetime");
  const metricField = table.fields.find((field) => field.fieldType === "number");
  const views: Array<{ name: string; viewType: "list" | "kanban" | "calendar" | "chart" | "summary"; settingsJson: Record<string, unknown>; reason: string }> = [
    { name: "一覧", viewType: "list", settingsJson: { columns }, reason: "常に作成" },
  ];
  if (groupField) views.push({ name: "カンバン", viewType: "kanban", settingsJson: { columns, groupByFieldCode: groupField.code }, reason: `「${groupField.name}」で分類` });
  if (dateField) views.push({ name: "カレンダー", viewType: "calendar", settingsJson: { columns, dateFieldCode: dateField.code }, reason: `日付／日時「${dateField.name}」` });
  if (groupField) views.push({ name: "チャート", viewType: "chart", settingsJson: { columns, groupByFieldCode: groupField.code, ...(metricField ? { metricFieldCode: metricField.code } : {}) }, reason: `「${groupField.name}」で分類${metricField ? `・数値「${metricField.name}」` : "・件数を集計"}` });
  if (metricField) views.push({ name: "集計", viewType: "summary", settingsJson: { columns, metricFieldCode: metricField.code }, reason: `数値「${metricField.name}」` });
  return views;
}

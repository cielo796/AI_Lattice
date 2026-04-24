import { describe, expect, it } from "vitest";
import {
  buildReferenceRecordHref,
  formatFieldKey,
  getFieldDisplayName,
  getReferenceRecordLabel,
  getReferenceTableId,
  getReferenceTableCode,
  getRecordCustomer,
  getRecordIdentifier,
  getRecordTitle,
  resolveRecordListReferences,
  resolveRecordReferences,
} from "@/lib/runtime-records";
import type { AppRecord } from "@/types/record";

describe("runtime-records field labels", () => {
  it("prefers the configured field name", () => {
    expect(
      getFieldDisplayName({
        code: "ticket_id",
        name: "Ticket Number",
      })
    ).toBe("Ticket Number");
  });

  it("uses configured field names when formatting record detail labels", () => {
    expect(
      formatFieldKey("ticket_id", [
        {
          code: "ticket_id",
          name: "Ticket Number",
        },
      ])
    ).toBe("Ticket Number");
  });

  it("falls back to a formatted code when no field definition exists", () => {
    expect(formatFieldKey("custom_value")).toBe("custom value");
  });

  it("uses business app fields for identifiers, titles, and customers", () => {
    const record: AppRecord = {
      id: "rec_1",
      tenantId: "tenant_1",
      appId: "app_1",
      tableId: "table_1",
      status: "pending",
      data: {
        claim_id: "EXPENSE-001",
        applicant_name: "田中 太郎",
        item_name: "大阪出張交通費",
      },
      createdBy: "user_1",
      updatedBy: "user_1",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    };

    expect(getRecordIdentifier(record)).toBe("EXPENSE-001");
    expect(getRecordTitle(record)).toBe("大阪出張交通費");
    expect(getRecordCustomer(record)).toBe("田中 太郎");
  });

  it("reads the configured reference table code", () => {
    expect(
      getReferenceTableCode({
        settingsJson: {
          referenceTableCode: "customers",
        },
      })
    ).toBe("customers");
  });

  it("reads the configured reference table id", () => {
    expect(
      getReferenceTableId({
        settingsJson: {
          referenceTableId: "tbl_customers",
        },
      })
    ).toBe("tbl_customers");
  });

  it("resolves master_ref values to referenced record titles", () => {
    const record: AppRecord = {
      id: "rec_1",
      tenantId: "tenant_1",
      appId: "app_1",
      tableId: "table_1",
      status: "active",
      data: {
        customer: "customer_1",
        subject: "Escalation needed",
      },
      createdBy: "user_1",
      updatedBy: "user_1",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    };

    const resolved = resolveRecordReferences(
      record,
      [
        {
          code: "customer",
          fieldType: "master_ref",
          settingsJson: {
            referenceTableCode: "customers",
          },
        },
      ],
      {
        customer: {
          customer_1: "ACME Corp",
        },
      }
    );

    expect(resolved.data.customer).toBe("ACME Corp");
    expect(resolved.data.subject).toBe("Escalation needed");
    expect(record.data.customer).toBe("customer_1");
  });

  it("resolves record collections and builds reference links", () => {
    const records: AppRecord[] = [
      {
        id: "rec_1",
        tenantId: "tenant_1",
        appId: "app_1",
        tableId: "table_1",
        status: "active",
        data: {
          customer: "customer_1",
        },
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    ];

    const [resolved] = resolveRecordListReferences(
      records,
      [
        {
          code: "customer",
          fieldType: "master_ref",
          settingsJson: {
            referenceTableCode: "customers",
          },
        },
      ],
      {
        customer: {
          customer_1: "ACME Corp",
        },
      }
    );

    expect(resolved.data.customer).toBe("ACME Corp");
    expect(buildReferenceRecordHref("/run", "support-desk", "customers", "customer_1")).toBe(
      "/run/support-desk/customers?recordId=customer_1"
    );
  });

  it("prefers the configured display field for reference labels", () => {
    expect(
      getReferenceRecordLabel(
        {
          id: "customer_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "table_1",
          status: "active",
          data: {
            company_name: "ACME Corp",
            name: "Fallback Name",
          },
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
        "company_name"
      )
    ).toBe("ACME Corp");
  });

  it("resolves multiple master_ref values to joined labels", () => {
    const record: AppRecord = {
      id: "rec_1",
      tenantId: "tenant_1",
      appId: "app_1",
      tableId: "table_1",
      status: "active",
      data: {
        customers: ["customer_1", "customer_2"],
      },
      createdBy: "user_1",
      updatedBy: "user_1",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    };

    const resolved = resolveRecordReferences(
      record,
      [
        {
          code: "customers",
          fieldType: "master_ref",
          settingsJson: {
            referenceTableCode: "customers",
            multiple: true,
          },
        },
      ],
      {
        customers: {
          customer_1: "ACME Corp",
          customer_2: "Globex",
        },
      }
    );

    expect(resolved.data.customers).toBe("ACME Corp, Globex");
  });
});

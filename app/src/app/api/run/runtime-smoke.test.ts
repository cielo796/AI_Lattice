import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET as listRecords,
  POST as createRecord,
} from "@/app/api/run/[appCode]/[table]/route";
import {
  DELETE as deleteRecord,
  PUT as updateRecord,
} from "@/app/api/run/[appCode]/[table]/[recordId]/route";
import { POST as createComment } from "@/app/api/run/[appCode]/[table]/[recordId]/comments/route";
import { POST as createAttachment } from "@/app/api/run/[appCode]/[table]/[recordId]/attachments/route";
import { GET as listBackReferences } from "@/app/api/run/[appCode]/[table]/[recordId]/back-references/route";
import { GET as getMeta } from "@/app/api/run/[appCode]/[table]/meta/route";
import { AppsServiceError } from "@/server/apps/service";

const {
  requireAuthenticatedUser,
  createAttachmentForRecord,
  createCommentForRecord,
  createRecordForTable,
  deleteRecordForTable,
  getRuntimeTableMeta,
  listBackReferencesForRecord,
  listRecordsForTable,
  updateRecordForTable,
} = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  createAttachmentForRecord: vi.fn(),
  createCommentForRecord: vi.fn(),
  createRecordForTable: vi.fn(),
  deleteRecordForTable: vi.fn(),
  getRuntimeTableMeta: vi.fn(),
  listBackReferencesForRecord: vi.fn(),
  listRecordsForTable: vi.fn(),
  updateRecordForTable: vi.fn(),
}));

vi.mock("@/app/api/_helpers", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_helpers")>(
    "@/app/api/_helpers"
  );

  return {
    ...actual,
    requireAuthenticatedUser,
  };
});

vi.mock("@/server/records/service", () => ({
  createAttachmentForRecord,
  createCommentForRecord,
  createRecordForTable,
  deleteRecordForTable,
  getRuntimeTableMeta,
  listBackReferencesForRecord,
  listRecordsForTable,
  updateRecordForTable,
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
};

function tableContext() {
  return {
    params: Promise.resolve({ appCode: "support-desk", table: "tickets" }),
  };
}

function recordContext() {
  return {
    params: Promise.resolve({
      appCode: "support-desk",
      table: "tickets",
      recordId: "rec-001",
    }),
  };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("runtime route smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue(user);
  });

  it("returns 401 before entering runtime services", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await listRecords(
      new Request("http://localhost/api/run/support-desk/tickets"),
      tableContext()
    );

    expect(response.status).toBe(401);
    expect(listRecordsForTable).not.toHaveBeenCalled();
  });

  it("covers list, create, update, and delete record routes", async () => {
    const record = {
      id: "rec-001",
      status: "open",
      data: { title: "雨天時の訪問日程変更" },
    };
    const createInput = { status: "open", data: { title: "新規問い合わせ" } };
    const updateInput = { status: "closed", data: { title: "対応完了" } };

    listRecordsForTable.mockResolvedValue([record]);
    createRecordForTable.mockResolvedValue({ ...record, data: createInput.data });
    updateRecordForTable.mockResolvedValue({ ...record, ...updateInput });
    deleteRecordForTable.mockResolvedValue(undefined);

    const listResponse = await listRecords(
      new Request("http://localhost/api/run/support-desk/tickets"),
      tableContext()
    );
    const createResponse = await createRecord(
      jsonRequest(
        "http://localhost/api/run/support-desk/tickets",
        "POST",
        createInput
      ),
      tableContext()
    );
    const updateResponse = await updateRecord(
      jsonRequest(
        "http://localhost/api/run/support-desk/tickets/rec-001",
        "PUT",
        updateInput
      ),
      recordContext()
    );
    const deleteResponse = await deleteRecord(
      new Request("http://localhost/api/run/support-desk/tickets/rec-001", {
        method: "DELETE",
      }),
      recordContext()
    );

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([record]);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(204);
    expect(createRecordForTable).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      createInput
    );
    expect(updateRecordForTable).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      updateInput
    );
    expect(deleteRecordForTable).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001"
    );
  });

  it("covers runtime activity and metadata routes", async () => {
    const commentInput = { commentText: "更新内容を確認しました。" };
    const attachmentInput = {
      fileName: "receipt.pdf",
      storagePath: "/uploads/records/rec-001/receipt.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    };
    const comment = { id: "comment-001", ...commentInput };
    const attachment = { id: "att-001", ...attachmentInput };
    const backReferenceGroups = [
      {
        sourceTableId: "tbl-related",
        sourceTableCode: "related",
        sourceTableName: "関連チケット",
        fieldCode: "ticket",
        fieldName: "対象チケット",
        records: [],
      },
    ];
    const meta = {
      app: { id: "app-001", code: "support-desk", name: "サポートデスク" },
      table: { id: "tbl-001", code: "tickets", name: "チケット" },
      fields: [],
    };

    createCommentForRecord.mockResolvedValue(comment);
    createAttachmentForRecord.mockResolvedValue(attachment);
    listBackReferencesForRecord.mockResolvedValue(backReferenceGroups);
    getRuntimeTableMeta.mockResolvedValue(meta);

    const commentResponse = await createComment(
      jsonRequest(
        "http://localhost/api/run/support-desk/tickets/rec-001/comments",
        "POST",
        commentInput
      ),
      recordContext()
    );
    const attachmentResponse = await createAttachment(
      jsonRequest(
        "http://localhost/api/run/support-desk/tickets/rec-001/attachments",
        "POST",
        attachmentInput
      ),
      recordContext()
    );
    const backReferenceResponse = await listBackReferences(
      new Request(
        "http://localhost/api/run/support-desk/tickets/rec-001/back-references"
      ),
      recordContext()
    );
    const metaResponse = await getMeta(
      new Request("http://localhost/api/run/support-desk/tickets/meta"),
      tableContext()
    );

    expect(commentResponse.status).toBe(201);
    expect(await commentResponse.json()).toEqual(comment);
    expect(attachmentResponse.status).toBe(201);
    expect(await attachmentResponse.json()).toEqual(attachment);
    expect(await backReferenceResponse.json()).toEqual(backReferenceGroups);
    expect(await metaResponse.json()).toEqual(meta);
    expect(createCommentForRecord).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      commentInput
    );
    expect(createAttachmentForRecord).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      attachmentInput
    );
    expect(listBackReferencesForRecord).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001"
    );
    expect(getRuntimeTableMeta).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets"
    );
  });
});

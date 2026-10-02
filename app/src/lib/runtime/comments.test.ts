import { describe, expect, it } from "vitest";
import { mergeRecordComments } from "./comments";
import type { RecordComment } from "@/types/record";

function comment(id: string, recordId = "record"): RecordComment {
  return { id, recordId, tenantId: "tenant", commentText: id, createdBy: "owner", createdAt: `2026-10-02T00:00:0${id}Z` };
}

describe("mergeRecordComments", () => {
  it("preserves a newly posted comment when a stale read returns empty", () => {
    expect(mergeRecordComments([], [comment("1")], "record")).toEqual([comment("1")]);
  });
  it("deduplicates a posted comment also included in the server response", () => {
    expect(mergeRecordComments([comment("1")], [comment("1")], "record")).toHaveLength(1);
  });
  it("does not mix comments from another record", () => {
    expect(mergeRecordComments([comment("1")], [comment("2", "other")], "record")).toEqual([comment("1")]);
  });
  it("keeps chronological order while merging new server comments", () => {
    expect(mergeRecordComments([comment("3"), comment("1")], [comment("2")], "record").map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});

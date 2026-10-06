import { describe, expect, it } from "vitest";
import { getRecordPage, RECORD_PAGE_SIZE } from "@/lib/runtime-pagination";

describe("runtime record pagination", () => {
  const records = Array.from({ length: 123 }, (_, index) => ({ id: `record-${index}` }));

  it("bounds rendered records without losing later pages", () => {
    const pages = [0, 1, 2].map((pageIndex) => getRecordPage(records, pageIndex));
    expect(pages[0]).toMatchObject({ first: 1, last: 50, pageIndex: 0, pageCount: 3, total: 123 });
    expect(pages[1]).toMatchObject({ first: 51, last: 100 });
    expect(pages[2]).toMatchObject({ first: 101, last: 123 });
    expect(pages.every((page) => page.records.length <= RECORD_PAGE_SIZE)).toBe(true);
    expect(pages.flatMap((page) => page.records)).toEqual(records);
  });

  it("clamps the current page after deletions and handles empty results", () => {
    expect(getRecordPage(records.slice(0, 2), 2)).toMatchObject({ records: records.slice(0, 2), pageIndex: 0, first: 1, last: 2 });
    expect(getRecordPage([], 10)).toMatchObject({ records: [], pageIndex: 0, pageCount: 1, total: 0, first: 0, last: 0 });
    expect(getRecordPage(records, -1).pageIndex).toBe(0);
    expect(getRecordPage(records, Number.NaN).pageIndex).toBe(0);
    expect(getRecordPage(records, Number.POSITIVE_INFINITY).pageIndex).toBe(0);
  });

  it("paginates the complete filtered and sorted result without mutating it", () => {
    const matching = records.filter((record) => Number(record.id.split("-")[1]) % 2 === 0).reverse();
    const page = getRecordPage(matching, 1);
    expect(page.records).toEqual(matching.slice(50));
    expect(page.total).toBe(62);
    expect(records[0].id).toBe("record-0");
  });
});

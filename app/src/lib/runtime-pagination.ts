export const RECORD_PAGE_SIZE = 50;

export function getRecordPage<Item>(records: Item[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(records.length / RECORD_PAGE_SIZE));
  const pageIndex = Number.isFinite(requestedPage)
    ? Math.max(0, Math.min(Math.floor(requestedPage), pageCount - 1))
    : 0;
  const offset = pageIndex * RECORD_PAGE_SIZE;
  return {
    records: records.slice(offset, offset + RECORD_PAGE_SIZE),
    pageIndex,
    pageCount,
    total: records.length,
    first: records.length ? offset + 1 : 0,
    last: Math.min(offset + RECORD_PAGE_SIZE, records.length),
  };
}

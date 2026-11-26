export type RowNavigationKey = "ArrowUp" | "ArrowDown" | "Home" | "End";

const ROW_NAVIGATION_KEYS = new Set<string>([
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

export function isRowNavigationKey(key: string): key is RowNavigationKey {
  return ROW_NAVIGATION_KEYS.has(key);
}

/**
 * Returns the next selected index, or null when there are no rows.
 * currentIndex -1 means nothing selected.
 */
export function getNextRowIndex(
  key: RowNavigationKey,
  currentIndex: number,
  rowCount: number
): number | null {
  if (rowCount <= 0) {
    return null;
  }

  const lastIndex = rowCount - 1;
  const safeCurrent =
    currentIndex >= rowCount ? lastIndex : currentIndex < 0 ? -1 : currentIndex;

  switch (key) {
    case "ArrowDown":
      return safeCurrent < 0 ? 0 : Math.min(safeCurrent + 1, lastIndex);
    case "ArrowUp":
      return safeCurrent < 0 ? lastIndex : Math.max(safeCurrent - 1, 0);
    case "Home":
      return 0;
    case "End":
      return lastIndex;
  }
}

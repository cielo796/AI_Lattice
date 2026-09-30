export function isTransactionConflict(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return false;
    }
    if ("code" in current && ["P2034", "40001", "40P01"].includes(String(current.code))) {
      return true;
    }
    if ("kind" in current && current.kind === "TransactionWriteConflict") {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

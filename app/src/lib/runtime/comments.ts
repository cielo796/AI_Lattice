import type { RecordComment } from "@/types/record";

export function mergeRecordComments(
  incoming: RecordComment[],
  current: RecordComment[],
  recordId: string
) {
  const comments = new Map<string, RecordComment>();
  for (const comment of [...incoming, ...current]) {
    if (comment.recordId === recordId) comments.set(comment.id, comment);
  }
  return [...comments.values()].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

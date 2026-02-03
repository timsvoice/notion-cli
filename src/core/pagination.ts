import { writeNdjsonLine } from "./output.js";

export type PaginatedResponse<T> = {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

export async function paginateAll<T>(
  fetchPage: (cursor: string | null) => Promise<PaginatedResponse<T>>,
  options: { ndjson?: boolean }
): Promise<{ results: T[]; total: number } | null> {
  let cursor: string | null = null;
  let total = 0;
  const all: T[] = [];

  while (true) {
    const page = await fetchPage(cursor);
    if (options.ndjson) {
      for (const item of page.results) {
        writeNdjsonLine({ type: "item", data: item });
        total += 1;
      }
    } else {
      all.push(...page.results);
      total = all.length;
    }
    if (!page.has_more || !page.next_cursor) {
      cursor = null;
      break;
    }
    cursor = page.next_cursor;
  }

  if (options.ndjson) {
    writeNdjsonLine({ type: "summary", data: { count: total } });
    return null;
  }

  return { results: all, total };
}

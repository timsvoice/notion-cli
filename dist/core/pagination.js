import { writeNdjsonLine } from "./output.js";
export async function paginateAll(fetchPage, options) {
    let cursor = null;
    let total = 0;
    const all = [];
    while (true) {
        const page = await fetchPage(cursor);
        if (options.ndjson) {
            for (const item of page.results) {
                writeNdjsonLine({ type: "item", data: item });
                total += 1;
            }
        }
        else {
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

import { logger } from "./logger";
import { searchDuckDuckGo } from "../services/webSearchService";

export async function performWebSearch(query: string): Promise<string> {
    try {
        const results = await searchDuckDuckGo(query, 5);
        if (results.length === 0) return "";
        return results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
    } catch (error: unknown) {
        logger.error("Web search execution failed:", error);
        return "";
    }
}

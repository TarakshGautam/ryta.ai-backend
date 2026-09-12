import { logger } from "../utils/logger";

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    domain?: string;
    rank?: number;
}

function stripTags(value: string): string {
    return value
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function decodeDuckDuckGoUrl(rawUrl: string): string {
    if (rawUrl.includes("uddg=")) {
        try {
            const decodedParam = new URLSearchParams(rawUrl.split("?")[1]).get("uddg");
            if (decodedParam) return decodedParam;
        } catch {
            return rawUrl;
        }
    }
    return rawUrl;
}

function domainFromUrl(url: string): string | undefined {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return undefined;
    }
}

export const searchDuckDuckGo = async (query: string, maxResults = 5): Promise<SearchResult[]> => {
    if (!query || !query.trim()) {
        return [];
    }

    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout max for web search

        const response = await fetch(searchUrl, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            logger.warn(`DuckDuckGo search fetch error status: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const results: SearchResult[] = [];

        const resultRegex =
            /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

        let match: RegExpExecArray | null;
        while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
            const rawUrl = decodeDuckDuckGoUrl(match[1]);
            const cleanTitle = stripTags(match[2]);
            const cleanSnippet = stripTags(match[3]);

            if (cleanTitle && rawUrl.startsWith("http")) {
                results.push({
                    title: cleanTitle,
                    url: rawUrl,
                    snippet: cleanSnippet,
                    domain: domainFromUrl(rawUrl),
                    rank: results.length + 1,
                });
            }
        }

        return results;
    } catch (error: unknown) {
        const err = error as Error;
        logger.warn(`DuckDuckGo live search bypassed due to error: ${err.message}`);
        return [];
    }
};

export const WebSearchService = {
    searchDuckDuckGo,
    search: searchDuckDuckGo,
};
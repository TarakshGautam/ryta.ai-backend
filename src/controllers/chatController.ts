import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { logger } from "../utils/logger";
import { generateLLMResponse, type ChatMessage, type CompanionSubMode } from "../services/llmService";
import { searchDuckDuckGo } from "../services/webSearchService";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/response";

function asText(value: unknown): string {
    return value == null ? "" : String(value);
}

function needsWebSearch(message: string, explicit?: boolean): boolean {
    if (explicit === true) return true;
    if (explicit === false) return false;
    const lower = message.toLowerCase();
    return (
        lower.startsWith("search:") ||
        lower.includes("weather in") ||
        lower.includes("weather for") ||
        /\b(latest news|who won|current score)\b/.test(lower)
    );
}

export const handleChatMessage = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const { message, conversationId, subMode, webSearch } = req.body as {
            message?: unknown;
            conversationId?: unknown;
            subMode?: CompanionSubMode;
            webSearch?: boolean;
        };

        if (typeof message !== "string" || !message.trim()) {
            throw new ApiError(400, "Message content is required.");
        }

        const userMessage = message.trim().slice(0, 8000);
        const ownerId = req.ownerId || (req.headers["x-guest-session-id"] as string);

        if (!ownerId) {
            throw new ApiError(401, "User or Guest Session ID is missing.");
        }

        let activeConversationId =
            typeof conversationId === "string" && conversationId.trim()
                ? conversationId.trim()
                : null;

        if (activeConversationId) {
            const convCheck = await db.execute({
                sql: "SELECT guest_session_id, user_id FROM conversations WHERE id = ?",
                args: [activeConversationId],
            });

            if (convCheck.rows.length === 0) {
                activeConversationId = crypto.randomUUID();
                await db.execute({
                    sql: `INSERT INTO conversations (id, guest_session_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    args: [activeConversationId, ownerId, req.user?.id || null, userMessage.slice(0, 48)],
                });
            } else {
                const convOwner = asText(convCheck.rows[0].user_id) || asText(convCheck.rows[0].guest_session_id);
                if (convOwner !== ownerId) {
                    throw new ApiError(403, "Access Denied: You do not own this chat session.");
                }
            }
        } else {
            activeConversationId = crypto.randomUUID();
            await db.execute({
                sql: `INSERT INTO conversations (id, guest_session_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                args: [activeConversationId, ownerId, req.user?.id || null, userMessage.slice(0, 48)],
            });
        }

        const [historyResult, diaryResult, memoryResult] = await Promise.all([
            db.execute({
                sql: `SELECT sender, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 16`,
                args: [activeConversationId],
            }),
            db.execute({
                sql: `SELECT content, mood, created_at FROM diary_entries WHERE guest_session_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 3`,
                args: [ownerId, ownerId],
            }),
            db.execute({
                sql: `SELECT key, value FROM memory_vault WHERE guest_session_id = ? OR user_id = ?`,
                args: [ownerId, ownerId],
            }),
        ]);

        const pastMessages = [...historyResult.rows].reverse();
        const llmMessages: ChatMessage[] = [];
        const contextBits: string[] = [];

        if (memoryResult.rows.length > 0) {
            contextBits.push(
                "Known memories about user:\n" +
                memoryResult.rows.map((m) => `- ${asText(m.key)}: ${asText(m.value)}`).join("\n")
            );
        }
        if (diaryResult.rows.length > 0) {
            contextBits.push(
                "Recent emotional diary notes:\n" +
                diaryResult.rows.map((d) => `- [Mood: ${asText(d.mood) || "neutral"}] ${asText(d.content)}`).join("\n")
            );
        }

        let sources: Array<{ title: string; url: string; snippet: string }> = [];
        if (needsWebSearch(userMessage, webSearch)) {
            const cleanQuery = userMessage.replace(/^search:\s*/i, "").trim();
            sources = await searchDuckDuckGo(cleanQuery || userMessage, 5);
            if (sources.length > 0) {
                contextBits.push(
                    "Live web search context:\n" +
                    sources.map((s, i) => `${i + 1}. ${s.title}\n${s.url}\n${s.snippet}`).join("\n\n")
                );
            }
        }

        if (contextBits.length > 0) {
            llmMessages.push({ role: "system", content: contextBits.join("\n\n") });
        }

        for (const row of pastMessages) {
            const sender = asText(row.sender);
            const content = asText(row.content);
            if (!content) continue;
            llmMessages.push({
                role: sender === "user" ? "user" : "assistant",
                content,
            });
        }

        llmMessages.push({ role: "user", content: userMessage });

        const activeSubMode: CompanionSubMode = subMode || "ryku_sweetheart";
        const aiResponseText = await generateLLMResponse(llmMessages, activeSubMode);

        const timestamp = new Date().toISOString();
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();
        await db.execute({
            sql: `INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
            args: [
                userMessageId, activeConversationId, "user", userMessage, timestamp,
                assistantMessageId, activeConversationId, "assistant", aiResponseText, timestamp
            ],
        });

        await db.execute({
            sql: `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            args: [activeConversationId],
        });

        return successResponse(res, 200, "Message processed successfully.", {
            conversationId: activeConversationId,
            message: aiResponseText,
            userMessageId,
            assistantMessageId,
            persona: { subMode: activeSubMode },
            sources,
        });
    } catch (error) {
        logger.error("Chat handler failed:", error);
        next(error);
    }
};

export const getChatHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const { conversationId } = req.params;
        const ownerId = req.ownerId || (req.headers["x-guest-session-id"] as string);

        if (!conversationId) {
            throw new ApiError(400, "Conversation ID is required.");
        }

        if (!ownerId) {
            throw new ApiError(401, "Session verification failed.");
        }

        const convCheck = await db.execute({
            sql: "SELECT guest_session_id, user_id FROM conversations WHERE id = ?",
            args: [conversationId],
        } as any);

        if (convCheck.rows.length === 0) {
            throw new ApiError(404, "Conversation thread not found.");
        }

        const convOwner = asText(convCheck.rows[0].user_id) || asText(convCheck.rows[0].guest_session_id);
        if (convOwner !== ownerId) {
            throw new ApiError(403, "Access Denied: You cannot view this conversation history.");
        }

        const messagesResult = await db.execute({
            sql: "SELECT id, sender, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            args: [conversationId],
        } as any);

        const formattedMessages = messagesResult.rows.map((row) => ({
            id: asText(row.id),
            sender: asText(row.sender) === "user" ? "user" : "assistant",
            content: asText(row.content),
            createdAt: asText(row.created_at),
        }));

        return successResponse(res, 200, "Chat history retrieved.", {
            messages: formattedMessages,
        });
    } catch (error) {
        logger.error("Failed to fetch chat history:", error);
        next(error);
    }
};
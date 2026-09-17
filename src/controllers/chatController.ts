import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { logger } from "../utils/logger";
import {
    generateLLMResponse,
    type ChatMessage,
    type CompanionSubMode,
} from "../services/llmService";
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
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
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
        const userId = req.user?.id ? String(req.user.id) : null;
        const guestSessionId =
            req.guestSessionId ||
            (req.headers["x-guest-session-id"] as string) ||
            null;
        const ownerId = req.ownerId || userId || guestSessionId;

        if (!ownerId) {
            throw new ApiError(
                401,
                "User authentication or Guest Session ID is missing."
            );
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
                    args: [
                        activeConversationId,
                        guestSessionId,
                        userId,
                        userMessage.slice(0, 48),
                    ],
                });
            } else {
                const convRow = convCheck.rows[0];
                const convOwnerUser = convRow.user_id
                    ? String(convRow.user_id)
                    : null;
                const convOwnerGuest = convRow.guest_session_id
                    ? String(convRow.guest_session_id)
                    : null;

                const isOwner =
                    (userId && convOwnerUser === userId) ||
                    (guestSessionId && convOwnerGuest === guestSessionId);

                if (!isOwner) {
                    throw new ApiError(
                        403,
                        "Access Denied: You do not own this chat session."
                    );
                }
            }
        } else {
            activeConversationId = crypto.randomUUID();
            await db.execute({
                sql: `INSERT INTO conversations (id, guest_session_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                args: [
                    activeConversationId,
                    guestSessionId,
                    userId,
                    userMessage.slice(0, 48),
                ],
            });
        }

        // Fetch context in parallel (history, diary, memory vault)
        const [historyResult, diaryResult, memoryResult] = await Promise.all([
            db.execute({
                sql: `SELECT sender, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 16`,
                args: [activeConversationId],
            }),
            db.execute({
                sql: `SELECT content, mood, created_at FROM diary_entries WHERE user_id = ? OR guest_session_id = ? ORDER BY created_at DESC LIMIT 3`,
                args: [userId, guestSessionId],
            }),
            db.execute({
                sql: `SELECT content FROM vault_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
                args: [userId],
            }),
        ]);

        const pastMessages = [...historyResult.rows].reverse();
        const llmMessages: ChatMessage[] = [];
        const contextBits: string[] = [];

        // Memory Vault context (new table: vault_entries)
        if (memoryResult.rows.length > 0) {
            contextBits.push(
                "Saved memories about user:\n" +
                memoryResult.rows
                    .map((m) => `- ${asText(m.content)}`)
                    .join("\n")
            );
        }

        // Diary context
        if (diaryResult.rows.length > 0) {
            contextBits.push(
                "Recent emotional diary notes:\n" +
                diaryResult.rows
                    .map(
                        (d) =>
                            `- [Mood: ${asText(d.mood) || "neutral"}] ${asText(d.content)}`
                    )
                    .join("\n")
            );
        }

        let sources: Array<{ title: string; url: string; snippet: string }> = [];
        if (needsWebSearch(userMessage, webSearch)) {
            const cleanQuery = userMessage.replace(/^search:\s*/i, "").trim();
            sources = await searchDuckDuckGo(cleanQuery || userMessage, 5);
            if (sources.length > 0) {
                contextBits.push(
                    "Live web search context:\n" +
                    sources
                        .map(
                            (s, i) =>
                                `${i + 1}. ${s.title}\n${s.url}\n${s.snippet}`
                        )
                        .join("\n\n")
                );
            }
        }

        if (contextBits.length > 0) {
            llmMessages.push({
                role: "system",
                content: contextBits.join("\n\n"),
            });
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
        const aiResponseText = await generateLLMResponse(
            llmMessages,
            activeSubMode
        );

        const timestamp = new Date().toISOString();
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();

        // Transactional batch write
        await db.batch(
            [
                {
                    sql: `INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        userMessageId,
                        activeConversationId,
                        "user",
                        userMessage,
                        timestamp,
                    ],
                },
                {
                    sql: `INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        assistantMessageId,
                        activeConversationId,
                        "assistant",
                        aiResponseText,
                        timestamp,
                    ],
                },
                {
                    sql: `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    args: [activeConversationId],
                },
            ],
            "write"
        );

         successResponse(res, 200, "Message processed successfully.", {
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
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.id ? String(req.user.id) : null;
        const guestSessionId =
            req.guestSessionId ||
            (req.headers["x-guest-session-id"] as string) ||
            null;

        if (!conversationId) {
            throw new ApiError(400, "Conversation ID is required.");
        }

        if (!userId && !guestSessionId) {
            throw new ApiError(401, "Session verification failed.");
        }

        const convCheck = await db.execute({
            sql: "SELECT guest_session_id, user_id FROM conversations WHERE id = ?",
            args: [String(conversationId)],
        });

        if (convCheck.rows.length === 0) {
            throw new ApiError(404, "Conversation thread not found.");
        }

        const convRow = convCheck.rows[0];
        const convOwnerUser = convRow.user_id
            ? String(convRow.user_id)
            : null;
        const convOwnerGuest = convRow.guest_session_id
            ? String(convRow.guest_session_id)
            : null;

        const isOwner =
            (userId && convOwnerUser === userId) ||
            (guestSessionId && convOwnerGuest === guestSessionId);

        if (!isOwner) {
            throw new ApiError(
                403,
                "Access Denied: You cannot view this conversation history."
            );
        }

        const messagesResult = await db.execute({
            sql: "SELECT id, sender, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            args: [String(conversationId)],
        });
        const formattedMessages = messagesResult.rows.map((row) => ({
            id: asText(row.id),
            sender: asText(row.sender) === "user" ? "user" : "assistant",
            content: asText(row.content),
            createdAt: asText(row.created_at),
        }));

         successResponse(res, 200, "Chat history retrieved.", {
            messages: formattedMessages,
        });
    } catch (error) {
        logger.error("Failed to fetch chat history:", error);
        next(error);
    }
};
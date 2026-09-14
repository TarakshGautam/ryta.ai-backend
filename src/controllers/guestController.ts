import { Request, Response } from "express";
import { db } from "../db";
import { logger } from "../utils/logger";
import { parseGuestSessionId } from "../utils/guestIdentity";
import { generateLLMResponse, ChatMessage } from "../services/llmService";
import { RYKU_SYSTEM_PROMPT } from "../routes/rykuPersona";

/**
 * Guest Chat Endpoint Handler
 * Path: POST /api/v1/guest/chat
 */
export const handleGuestChat = async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                success: false,
                error: "Message string is required.",
            });
        }

        const bodyGuestId = (req.body as { guestId?: unknown })?.guestId;
        const guestId = parseGuestSessionId(bodyGuestId) || req.guestSessionId || "guest_incognito";

        // Prepend custom RYKU_SYSTEM_PROMPT and format conversation history for OpenRouter
        const formattedMessages: ChatMessage[] = [
            { role: "system", content: RYKU_SYSTEM_PROMPT },
            ...(Array.isArray(history)
                ? history.map((msg: { sender: string; text: string }) => ({
                    role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
                    content: String(msg.text || "").replace(/^\[MOOD:[A-Z]+\]\s*/, ""),
                }))
                : []),
            { role: "user", content: message },
        ];

        // Clean function call matching ChatMessage[] signature without type errors
        const reply = await generateLLMResponse(formattedMessages);

        // Safe DB execution (If DB fails/timeouts, user still receives their reply)
        // Safe DB execution (If DB fails/timeouts, user still receives their reply)
        try {
            if (db) {
                await db.execute({
                    sql: `INSERT INTO conversations (id, guest_session_id, user_message, ai_response) VALUES (?, ?, ?, ?)`,
                    args: [crypto.randomUUID(), guestId, message, reply],
                });
            }
        } catch (dbErr: unknown) {
            const errMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
            logger.warn(`Guest conversation DB logging skipped: ${errMessage}`);
        }

        return res.status(200).json({
            success: true,
            reply: reply,
        });
    } catch (error) {
        logger.error("Guest chat handling error:", error);
        return res.status(500).json({
            success: false,
            error: "Could not generate guest response.",
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * Merge Guest Session into Authenticated User
 * Path: POST /api/v1/guest/merge
 */
export const mergeGuestIntoUser = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: "Authentication required.",
            });
        }

        const bodyGuestId = (req.body as { guestId?: unknown })?.guestId;
        const guestId = parseGuestSessionId(bodyGuestId) || req.guestSessionId;

        if (!guestId) {
            return res.status(400).json({
                success: false,
                error: "A valid guest session id is required to merge memories.",
            });
        }

        // Atomic SQL Batch Execution for Memory Integration
        const statements = [
            {
                sql: `UPDATE conversations 
              SET user_id = ?, guest_session_id = NULL, updated_at = CURRENT_TIMESTAMP 
              WHERE guest_session_id = ? AND (user_id IS NULL OR user_id = '')`,
                args: [userId, guestId],
            },
            {
                sql: `UPDATE diary_entries 
              SET user_id = ?, guest_session_id = NULL 
              WHERE guest_session_id = ? AND (user_id IS NULL OR user_id = '')`,
                args: [userId, guestId],
            },
            {
                sql: `UPDATE memory_vault 
              SET user_id = ?, guest_session_id = NULL 
              WHERE guest_session_id = ? AND (user_id IS NULL OR user_id = '')`,
                args: [userId, guestId],
            },
            {
                sql: `UPDATE shared_activities 
              SET user_id = ?, guest_session_id = NULL 
              WHERE guest_session_id = ? AND (user_id IS NULL OR user_id = '')`,
                args: [userId, guestId],
            },
            {
                sql: `UPDATE relationship_experiences 
              SET creator_user_id = ?, creator_guest_id = NULL 
              WHERE creator_guest_id = ? AND (creator_user_id IS NULL OR creator_user_id = '')`,
                args: [userId, guestId],
            },
            {
                sql: `INSERT INTO guest_sessions (id, merged_into_user_id, merged_at) 
              VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET 
                merged_into_user_id = excluded.merged_into_user_id, 
                merged_at = CURRENT_TIMESTAMP`,
                args: [guestId, userId],
            },
        ];

        await db.batch(statements, "write");

        logger.info(`Guest session ${guestId} successfully merged into user ${userId}`);

        return res.status(200).json({
            success: true,
            data: { guestId, userId },
            message: "Guest memories were saved to your account.",
        });
    } catch (error) {
        logger.error("Guest merge failed:", error);
        return res.status(500).json({
            success: false,
            error: "Could not save guest memories to this account. Please try again.",
        });
    }
};
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { parseGuestSessionId } from "../utils/guestIdentity";
import { generateLLMResponse, ChatMessage } from "../services/llmService";
import { RYKU_SYSTEM_PROMPT } from "../routes/rykuPersona";
import { db } from "../db";
/**
 * Guest Chat Endpoint Handler
 * Path: POST /api/v1/guest/chat
 *
 * Guest chat is fully ephemeral — nothing is persisted to DB.
 * Session lives only in client-side memory (localStorage guestId + React state).
 * This keeps guest mode fast, private, and free of FK/schema issues.
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
        const guestId =
            parseGuestSessionId(bodyGuestId) ||
            req.guestSessionId ||
            "guest_incognito";

        // Prepend custom RYKU_SYSTEM_PROMPT and format conversation history
        const formattedMessages: ChatMessage[] = [
            { role: "system", content: RYKU_SYSTEM_PROMPT },
            ...(Array.isArray(history)
                ? history.map((msg: { sender: string; text: string }) => ({
                    role: (msg.sender === "user"
                        ? "user"
                        : "assistant") as "user" | "assistant",
                    content: String(msg.text || "").replace(
                        /^\[MOOD:[A-Z]+\]\s*/,
                        ""
                    ),
                }))
                : []),
            { role: "user", content: message },
        ];

        const reply = await generateLLMResponse(formattedMessages);

        // NO DB WRITES — guest session is ephemeral by design.
        // When a guest signs up later, we'll handle persistence via
        // an explicit "import this conversation" flow (future work).
        logger.debug(
            `Guest chat handled for session ${guestId} (ephemeral, not persisted)`
        );

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
 *
 * NOTE: Since guest chat is no longer persisted, there is nothing to
 * merge from `conversations`. This handler is kept for future use
 * (e.g. when we add guest-side diary or vault, or import-from-client).
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

        // Only merge records that were actually persisted under this guest id.
        // Since guest chat is ephemeral, this mainly covers future diary/vault
        // entries created while unauthenticated (if we enable that later).
        const statements = [
            {
                sql: `UPDATE diary_entries
                      SET user_id = ?, guest_session_id = NULL
                      WHERE guest_session_id = ? AND (user_id IS NULL OR user_id = '')`,
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

        logger.info(
            `Guest session ${guestId} linked to user ${userId} (no chat records to merge — ephemeral by design)`
        );

        return res.status(200).json({
            success: true,
            data: { guestId, userId },
            message: "Guest session linked to your account.",
        });
    } catch (error) {
        logger.error("Guest merge failed:", error);
        return res.status(500).json({
            success: false,
            error: "Could not link guest session. Please try again.",
        });
    }
};
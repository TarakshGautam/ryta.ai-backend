import { Request, Response } from "express";
import { db } from "../db";
import { logger } from "../utils/logger";
import { parseGuestSessionId } from "../utils/guestIdentity";

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
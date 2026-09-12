import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { ApiError } from "../utils/apiError";

async function requireOwnedConversation(req: Request, id: string) {
    const result = await db.execute({
        sql: "SELECT id, user_id, guest_session_id FROM conversations WHERE id = ?",
        args: [id],
    });
    if (!result.rows.length) throw new ApiError(404, "Conversation not found.");
    const userId = req.user?.id ? String(req.user.id) : null;
    const guestId = req.guestSessionId ? String(req.guestSessionId) : null;
    const row = result.rows[0];
    const owned = (userId && String(row.user_id || "") === userId) || (guestId && String(row.guest_session_id || "") === guestId);
    if (!owned) throw new ApiError(403, "Access denied to this conversation.");
}

export const getConversations = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const guestSessionId = req.guestSessionId;

        if (!userId && !guestSessionId) {
            res.json({ success: true, data: [] });
            return;
        }

        let sql = "";
        let args: any[] = [];

        if (userId) {
            sql = "SELECT id, title, created_at, updated_at, is_pinned FROM conversations WHERE user_id = ? AND archived_at IS NULL ORDER BY is_pinned DESC, updated_at DESC";
            args = [userId];
        } else if (guestSessionId) {
            sql = "SELECT id, title, created_at, updated_at, is_pinned FROM conversations WHERE guest_session_id = ? AND archived_at IS NULL ORDER BY is_pinned DESC, updated_at DESC";
            args = [guestSessionId];
        }

        const result = await db.execute({ sql, args });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

export const getConversationMessages = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const guestSessionId = req.guestSessionId;

        if (!id || typeof id !== "string") {
            throw new ApiError(400, "Conversation ID is required.");
        }

        // Verify conversation ownership
        const convCheck = await db.execute({
            sql: "SELECT id, user_id, guest_session_id FROM conversations WHERE id = ?",
            args: [id],
        });

        if (convCheck.rows.length === 0) {
            throw new ApiError(404, "Conversation not found.");
        }

        const conv = convCheck.rows[0];
        const convUserId = conv.user_id ? String(conv.user_id) : null;
        const convGuestId = conv.guest_session_id ? String(conv.guest_session_id) : null;

        const isOwner =
            (userId && convUserId === String(userId)) ||
            (guestSessionId && convGuestId === guestSessionId);

        if (!isOwner) {
            throw new ApiError(403, "Access denied to this conversation.");
        }

        // Fetch messages
        const messages = await db.execute({
            sql: "SELECT id, sender, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            args: [id],
        });

        res.json({ success: true, data: messages.rows });
    } catch (error) {
        next(error);
    }
};

export const renameConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
        if (!title) throw new ApiError(422, "Conversation title is required.");
        await requireOwnedConversation(req, id);
        await db.execute({ sql: "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [title, id] });
        res.json({ success: true, data: { id, title }, message: "Conversation renamed." });
    } catch (error) { next(error); }
};

export const deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        await requireOwnedConversation(req, id);
        await db.execute({ sql: "DELETE FROM conversations WHERE id = ?", args: [id] });
        res.json({ success: true, data: { id }, message: "Conversation deleted." });
    } catch (error) { next(error); }
};

export const setConversationPinned = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        await requireOwnedConversation(req, id);
        const pinned = req.body?.pinned === true ? 1 : 0;
        await db.execute({ sql: "UPDATE conversations SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [pinned, id] });
        res.json({ success: true, data: { id, pinned: Boolean(pinned) }, message: "Conversation pin updated." });
    } catch (error) { next(error); }
};

export const setConversationArchived = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        await requireOwnedConversation(req, id);
        const archived = req.body?.archived !== false;
        await db.execute({ sql: "UPDATE conversations SET archived_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [archived ? new Date().toISOString() : null, id] });
        res.json({ success: true, data: { id, archived }, message: archived ? "Conversation archived." : "Conversation restored." });
    } catch (error) { next(error); }
};

export const updateMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        const messageId = String(req.params.messageId);
        await requireOwnedConversation(req, id);
        const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 8000) : "";
        if (!content) throw new ApiError(422, "Message content is required.");
        const result = await db.execute({ sql: "UPDATE messages SET content = ? WHERE id = ? AND conversation_id = ?", args: [content, messageId, id] });
        if (!result.rowsAffected) throw new ApiError(404, "Message not found.");
        res.json({ success: true, data: { id: messageId, content }, message: "Message updated." });
    } catch (error) { next(error); }
};

export const deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = String(req.params.id);
        const messageId = String(req.params.messageId);
        await requireOwnedConversation(req, id);
        const result = await db.execute({ sql: "DELETE FROM messages WHERE id = ? AND conversation_id = ?", args: [messageId, id] });
        if (!result.rowsAffected) throw new ApiError(404, "Message not found.");
        res.json({ success: true, data: { id: messageId }, message: "Message deleted." });
    } catch (error) { next(error); }
};

export const ConversationController = {
    getConversations,
    getConversationMessages,
    renameConversation,
    deleteConversation,
    setConversationPinned,
    setConversationArchived,
    updateMessage,
    deleteMessage,
};
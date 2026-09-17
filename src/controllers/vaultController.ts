import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/response";

function asText(value: unknown): string {
    return value == null ? "" : String(value);
}

/**
 * Create a new vault entry (memory).
 * POST /api/vault
 * Body: { content, source?, conversationId?, messageId?, persona? }
 */
export const createVaultEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        if (!userId) {
            throw new ApiError(401, "Authentication required.");
        }

        const content =
            typeof req.body?.content === "string"
                ? req.body.content.trim().slice(0, 4000)
                : "";

        if (!content) {
            throw new ApiError(422, "Memory content is required.");
        }

        const source =
            typeof req.body?.source === "string"
                ? req.body.source.slice(0, 32)
                : "manual";
        const conversationId =
            typeof req.body?.conversationId === "string"
                ? req.body.conversationId.slice(0, 64)
                : null;
        const messageId =
            typeof req.body?.messageId === "string"
                ? req.body.messageId.slice(0, 64)
                : null;
        const persona =
            typeof req.body?.persona === "string"
                ? req.body.persona.slice(0, 32)
                : null;

        const id = crypto.randomUUID();

        await db.execute({
            sql: `INSERT INTO vault_entries (id, user_id, content, source, conversation_id, message_id, persona, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            args: [id, userId, content, source, conversationId, messageId, persona],
        });

         successResponse(res, 201, "Memory saved to vault.", {
            id,
            content,
            source,
            conversationId,
            messageId,
            persona,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List all vault entries for authenticated user.
 * GET /api/vault
 */
export const getVaultEntries = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        if (!userId) {
            throw new ApiError(401, "Authentication required.");
        }

        const result = await db.execute({
            sql: `SELECT id, content, source, conversation_id, message_id, persona, created_at
                  FROM vault_entries
                  WHERE user_id = ?
                  ORDER BY created_at DESC`,
            args: [userId],
        });

        const entries = result.rows.map((row) => ({
            id: asText(row.id),
            content: asText(row.content),
            source: asText(row.source) || "manual",
            conversationId: row.conversation_id ? asText(row.conversation_id) : null,
            messageId: row.message_id ? asText(row.message_id) : null,
            persona: row.persona ? asText(row.persona) : null,
            createdAt: asText(row.created_at),
        }));

         successResponse(res, 200, "Vault entries retrieved.", {
            entries,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single vault entry.
 * GET /api/vault/:id
 */
export const getVaultEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        if (!userId) {
            throw new ApiError(401, "Authentication required.");
        }

        const id = String(req.params.id);

        const result = await db.execute({
            sql: `SELECT id, content, source, conversation_id, message_id, persona, created_at
                  FROM vault_entries
                  WHERE id = ? AND user_id = ?`,
            args: [id, userId],
        });

        if (result.rows.length === 0) {
            throw new ApiError(404, "Memory not found.");
        }

        const row = result.rows[0];

         successResponse(res, 200, "Memory retrieved.", {
            id: asText(row.id),
            content: asText(row.content),
            source: asText(row.source) || "manual",
            conversationId: row.conversation_id ? asText(row.conversation_id) : null,
            messageId: row.message_id ? asText(row.message_id) : null,
            persona: row.persona ? asText(row.persona) : null,
            createdAt: asText(row.created_at),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update vault entry content.
 * PATCH /api/vault/:id
 */
export const updateVaultEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        if (!userId) {
            throw new ApiError(401, "Authentication required.");
        }

        const id = String(req.params.id);
        const content =
            typeof req.body?.content === "string"
                ? req.body.content.trim().slice(0, 4000)
                : "";

        if (!content) {
            throw new ApiError(422, "Content is required.");
        }

        const result = await db.execute({
            sql: `UPDATE vault_entries SET content = ? WHERE id = ? AND user_id = ?`,
            args: [content, id, userId],
        });

        if (!result.rowsAffected) {
            throw new ApiError(404, "Memory not found or update failed.");
        }

         successResponse(res, 200, "Memory updated.", {
            id,
            content,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete vault entry.
 * DELETE /api/vault/:id
 */
export const deleteVaultEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        if (!userId) {
            throw new ApiError(401, "Authentication required.");
        }

        const id = String(req.params.id);

        const result = await db.execute({
            sql: `DELETE FROM vault_entries WHERE id = ? AND user_id = ?`,
            args: [id, userId],
        });

        if (!result.rowsAffected) {
            throw new ApiError(404, "Memory not found or delete failed.");
        }

         successResponse(res, 200, "Memory deleted.", { id });
    } catch (error) {
        next(error);
    }
};

export const VaultController = {
    createVaultEntry,
    getVaultEntries,
    getVaultEntry,
    updateVaultEntry,
    deleteVaultEntry,
};
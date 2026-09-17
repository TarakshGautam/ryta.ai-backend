import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/response";

function asText(value: unknown): string {
    return value == null ? "" : String(value);
}

/**
 * Create a new diary entry.
 * POST /api/diary
 * Body: { title?, content, mood? }
 */
export const createDiaryEntry = async (
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
                ? req.body.content.trim().slice(0, 20000)
                : "";

        if (!content) {
            throw new ApiError(422, "Diary content is required.");
        }

        const title =
            typeof req.body?.title === "string"
                ? req.body.title.trim().slice(0, 200)
                : "";
        const mood =
            typeof req.body?.mood === "string"
                ? req.body.mood.trim().slice(0, 64)
                : null;

        const id = crypto.randomUUID();

        await db.execute({
            sql: `INSERT INTO diary_entries (id, user_id, title, content, mood, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            args: [id, userId, title || null, content, mood],
        });

         successResponse(res, 201, "Diary entry created.", {
            id,
            title: title || null,
            content,
            mood,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List all diary entries for authenticated user.
 * GET /api/diary
 */
export const getDiaryEntries = async (
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
            sql: `SELECT id, title, content, mood, created_at, updated_at
                  FROM diary_entries
                  WHERE user_id = ?
                  ORDER BY created_at DESC`,
            args: [userId],
        });

        const entries = result.rows.map((row) => ({
            id: asText(row.id),
            title: row.title ? asText(row.title) : null,
            content: asText(row.content),
            mood: row.mood ? asText(row.mood) : null,
            createdAt: asText(row.created_at),
            updatedAt: asText(row.updated_at),
        }));

         successResponse(res, 200, "Diary entries retrieved.", {
            entries,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single diary entry.
 * GET /api/diary/:id
 */
export const getDiaryEntry = async (
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
            sql: `SELECT id, title, content, mood, created_at, updated_at
                  FROM diary_entries
                  WHERE id = ? AND user_id = ?`,
            args: [id, userId],
        });

        if (result.rows.length === 0) {
            throw new ApiError(404, "Diary entry not found.");
        }

        const row = result.rows[0];

         successResponse(res, 200, "Diary entry retrieved.", {
            id: asText(row.id),
            title: row.title ? asText(row.title) : null,
            content: asText(row.content),
            mood: row.mood ? asText(row.mood) : null,
            createdAt: asText(row.created_at),
            updatedAt: asText(row.updated_at),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update diary entry.
 * PATCH /api/diary/:id
 */
export const updateDiaryEntry = async (
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
                ? req.body.content.trim().slice(0, 20000)
                : undefined;

        const title =
            typeof req.body?.title === "string"
                ? req.body.title.trim().slice(0, 200)
                : undefined;

        const mood =
            typeof req.body?.mood === "string"
                ? req.body.mood.trim().slice(0, 64)
                : undefined;

        if (
            content === undefined &&
            title === undefined &&
            mood === undefined
        ) {
            throw new ApiError(422, "Nothing to update.");
        }

        // Build dynamic SET clause safely
        const setParts: string[] = [];
        const args: (string | null)[] = [];

        if (content !== undefined) {
            if (!content) throw new ApiError(422, "Content cannot be empty.");
            setParts.push("content = ?");
            args.push(content);
        }
        if (title !== undefined) {
            setParts.push("title = ?");
            args.push(title || null);
        }
        if (mood !== undefined) {
            setParts.push("mood = ?");
            args.push(mood || null);
        }

        setParts.push("updated_at = CURRENT_TIMESTAMP");
        args.push(id);
        args.push(userId);

        const result = await db.execute({
            sql: `UPDATE diary_entries SET ${setParts.join(", ")} WHERE id = ? AND user_id = ?`,
            args,
        });

        if (!result.rowsAffected) {
            throw new ApiError(404, "Diary entry not found or update failed.");
        }

         successResponse(res, 200, "Diary entry updated.", { id });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete diary entry.
 * DELETE /api/diary/:id
 */
export const deleteDiaryEntry = async (
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
            sql: `DELETE FROM diary_entries WHERE id = ? AND user_id = ?`,
            args: [id, userId],
        });

        if (!result.rowsAffected) {
            throw new ApiError(404, "Diary entry not found or delete failed.");
        }

         successResponse(res, 200, "Diary entry deleted.", { id });
    } catch (error) {
        next(error);
    }
};

export const DiaryController = {
    createDiaryEntry,
    getDiaryEntries,
    getDiaryEntry,
    updateDiaryEntry,
    deleteDiaryEntry,
};
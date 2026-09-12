import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { logger } from "../utils/logger";

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof ApiError) {
        logger.warn(`[ApiError] ${err.statusCode} - ${err.message}`);
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
    }

    // Fallback for unhandled internal server errors
    logger.error(`[UnhandledError] ${err.stack || err.message}`);
    return res.status(500).json({
        success: false,
        error: "Internal Server Error. Something went wrong on RyTa AI.",
    });
};
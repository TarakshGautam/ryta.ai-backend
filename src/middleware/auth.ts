import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/clerk-sdk-node";
import { ApiError } from "../utils/apiError";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

export const optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const guestHeader = req.headers["x-guest-session-id"] as string | undefined;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            if (token && ENV.CLERK_SECRET_KEY) {
                try {
                    const claims = await verifyToken(token, {
                        secretKey: ENV.CLERK_SECRET_KEY,
                    });
                    if (claims && claims.sub) {
                        req.user = { id: claims.sub, ...claims };
                    }
                } catch (error) {
                    logger.warn(
                        `Invalid JWT payload provided, falling back to guest verification: ${error instanceof Error ? error.message : String(error)
                        }`
                    );
                }
            }
        }

        if (guestHeader) {
            req.guestId = guestHeader;
            req.guestSessionId = guestHeader;
        }

        // Priority resolution: Authenticated User > Guest Session ID
        req.ownerId = req.user?.id || req.guestId || undefined;
        next();
    } catch (error) {
        next(error);
    }
};

export const requireIdentity = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    await optionalAuth(req, _res, (err?: unknown) => {
        if (err) return next(err);

        if (!req.ownerId) {
            return next(
                new ApiError(
                    401,
                    "Authentication token or x-guest-session-id header is required."
                )
            );
        }
        next();
    });
};

export const requireAuth = requireIdentity;
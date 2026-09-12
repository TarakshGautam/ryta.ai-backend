import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/clerk-sdk-node";
import { ApiError } from "../utils/apiError";
import { ENV } from "../config/env";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        [key: string]: any;
    };
    guestId?: string;
    ownerId?: string;
}

export const optionalAuth = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    const guestHeader = req.headers["x-guest-session-id"] as string;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
            try {
                const claims = await verifyToken(token, { secretKey: ENV.CLERK_SECRET_KEY });
                if (claims.sub) req.user = { id: claims.sub };
            } catch {
                // Invalid bearer tokens fall back to guest identity handling.
            }
        }
    }

    if (guestHeader) {
        req.guestId = guestHeader;
        req.guestSessionId = guestHeader;
    }

    // Priority: Logged in User ID -> Guest Session Header -> Fallback
    req.ownerId = req.user?.id || req.guestId || undefined;
    next();
};

export const requireIdentity = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
) => {
    await optionalAuth(req, _res, () => {
        if (!req.ownerId) {
            return next(new ApiError(401, "Authentication token or x-guest-session-id header is required."));
        }
        next();
    });
};
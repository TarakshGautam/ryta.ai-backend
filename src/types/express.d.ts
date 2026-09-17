import { Request } from "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                [key: string]: unknown;
            };
            guestId?: string;
            guestSessionId?: string;
            ownerId?: string;
            subdomain?: string | null;
        }
    }
}

export { };
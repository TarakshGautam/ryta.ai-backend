// src/types/express.d.ts
import { Request } from "express";

declare global {
    namespace Express {
        interface Request {
            userId?: string | null;
            user?: {
                id: string;
            };
            guestSessionId?: string | null;
            subdomain?: string | null;
        }
    }
}

export { };
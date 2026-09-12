import cors from "cors";
import { ENV } from "./env";

const allowedOrigins = new Set(
    [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        ENV.FRONTEND_URL,
        "https://ryta.life",
        "https://www.ryta.life",
        "https://ryta.ai",
        "https://www.ryta.ai",
        "https://guest.ryta.ai",
        "https://app.ryta.ai",
        "https://love.ryta.ai",
    ].filter(Boolean)
);

function isDevLocalOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        return (
            url.hostname === "localhost" ||
            url.hostname.endsWith(".localhost") ||
            url.hostname === "127.0.0.1"
        );
    } catch {
        return false;
    }
}

export const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.has(origin) || (!ENV.IS_PRODUCTION && isDevLocalOrigin(origin))) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS policy violation: Origin ${origin} not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-session-id"],
};

export const corsMiddleware = cors(corsOptions);

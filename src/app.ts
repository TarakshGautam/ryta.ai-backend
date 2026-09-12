import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { ApiError } from "./utils/apiError";
import { corsMiddleware } from "./config/cors";

declare global {
    namespace Express {
        interface Request {
            subdomain?: string | null;
        }
    }
}

const app = express();

// Required behind Vercel / Cloudflare reverse proxies to correctly identify client IPs
app.set("trust proxy", 1);

// Security & Logging Middlewares
app.use(helmet());
app.use(corsMiddleware);

// Explicit Preflight Handling for Vercel Serverless
app.options("*", corsMiddleware);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Suppress verbose dev logs in production serverless execution
if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}

// Global API Rate Limiter (Prevents OpenRouter Key Abuse)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minutes
    max: 100, // Max 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes.",
    },
});

app.use("/api", globalLimiter);

// Robust Proxy-Aware Subdomain Parser
app.use((req: Request, _res: Response, next: NextFunction) => {
    const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const host = rawHost.split(":")[0]; // Strip port number if present
    const parts = host.split(".");

    if (parts.length > 2 || (parts.length === 2 && parts[1].includes("localhost"))) {
        req.subdomain = parts[0];
    } else {
        req.subdomain = null;
    }
    next();
});

// Root Health & Status Endpoints
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        success: true,
        agent: "Takshu & Ryku",
        timestamp: new Date().toISOString(),
    });
});

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        name: "RyTa.AI",
        agent: "Takshu & Ryku",
        health: "/health",
    });
});

// API Routes Mount Point
app.use("/api", routes);

// 404 Handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new ApiError(404, "API endpoint not found."));
});

// Global Centralized Error Handler
app.use(errorHandler);

export default app;
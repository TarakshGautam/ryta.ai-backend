import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { ApiError } from "./utils/apiError";
import { corsMiddleware } from "./config/cors";
import guestRoutes from "./routes/guestRoutes";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

// Apply CORS globally to all routes & preflight OPTIONS requests cleanly
app.use(corsMiddleware);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}

// Health checks
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

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes.",
    },
});

app.use("/api", globalLimiter);

// Subdomain Parser
app.use((req: Request, _res: Response, next: NextFunction) => {
    const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const host = rawHost.split(":")[0];
    const parts = host.split(".");

    if (parts.length > 2 || (parts.length === 2 && parts[1].includes("localhost"))) {
        req.subdomain = parts[0];
    } else {
        req.subdomain = null;
    }
    next();
});

// Routes
app.use("/api", routes);
app.use("/api/v1/guest", guestRoutes);

// 404 Catch-All (No path string required)
app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new ApiError(404, "API endpoint not found."));
});

// Central Error Handler
app.use(errorHandler);

export default app;
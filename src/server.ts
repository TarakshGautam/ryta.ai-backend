import { ENV } from "./config/env";
import app from "./app";
import { initializeDatabase } from "./db";
import { logger } from "./utils/logger";

let isDbInitialized = false;

// Middleware to ensure DB connection is ready before processing serverless API calls
app.use(async (_req, _res, next) => {
    if (!isDbInitialized) {
        try {
            await initializeDatabase();
            isDbInitialized = true;
        } catch (error) {
            logger.error("💥 Critical Failure initializing database on startup:", error);
            return next(error);
        }
    }
    next();
});

// Local Development Server Execution
if (process.env.NODE_ENV !== "production") {
    const PORT = Number(ENV.PORT) || 5000;

    initializeDatabase()
        .then(() => {
            isDbInitialized = true;
            app.listen(PORT, "0.0.0.0", () => {
                logger.info(`🚀 RyTa.AI Local Dev Server running on http://localhost:${PORT}`);
            });
        })
        .catch((error) => {
            logger.error("💥 Critical Failure initializing database on startup:", error);
            process.exit(1);
        });
}

// Default export for Vercel Serverless Function Handler
export default app;
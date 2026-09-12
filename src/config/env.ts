import dotenv from "dotenv";
dotenv.config();

const isProduction = (process.env.NODE_ENV || "development").toLowerCase() === "production";

export const ENV = {
    PORT: process.env.PORT || "5000",
    NODE_ENV: process.env.NODE_ENV || "development",
    IS_PRODUCTION: isProduction,
    APP_BASE_DOMAIN: process.env.APP_BASE_DOMAIN || (isProduction ? "ryta.ai" : "localhost:5173"),
    PROTOCOL: isProduction ? "https" : "http",
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || "file:local.db",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    OPENROUTER_MODEL:
        process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    APP_BASE_URL:
        process.env.APP_BASE_URL ||
        (isProduction ? "https://love.ryta.ai" : "http://localhost:5173"),
};

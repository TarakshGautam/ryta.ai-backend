import type { NextFunction, Request, Response } from "express";
import app from "./app";
import { initializeDatabase } from "./db";

let databaseInitialization: Promise<void> | undefined;

const ensureDatabaseInitialized = () => {
    if (!databaseInitialization) {
        databaseInitialization = initializeDatabase().catch((error) => {
            databaseInitialization = undefined;
            throw error;
        });
    }
    return databaseInitialization;
};

const handler = (req: Request, res: Response, next: NextFunction) => {
    ensureDatabaseInitialized()
        .then(() => app(req, res, next))
        .catch(next);
};

export default handler;

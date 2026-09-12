import app from "../src/app";
import { initializeDatabase } from "../src/db";

let isDbInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isDbInitialized) {
    try {
      await initializeDatabase();
      isDbInitialized = true;
    } catch (err) {
      console.error("DB Initialization Failed:", err);
    }
  }
  return app(req, res);
}
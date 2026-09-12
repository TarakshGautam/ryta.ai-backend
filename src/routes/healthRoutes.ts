import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        status: "online",
        app: "RyTa AI Backend",
        agent: "Mr. Love",
        timestamp: new Date().toISOString(),
    });
});

export default router;

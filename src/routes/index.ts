import { Router } from "express";
import chatRoutes from "./chatRoutes";
import conversationRoutes from "./conversationRoutes";
import healthRoutes from "./healthRoutes";
import guestRoutes from "./guestRoutes";
import vaultRoutes from "./vaultRoutes";
import diaryRoutes from "./diaryRoutes";

const router = Router();

// Core API endpoints
router.use("/health", healthRoutes);
router.use("/chat", chatRoutes);
router.use("/conversations", conversationRoutes);

// User data features
router.use("/vault", vaultRoutes);
router.use("/diary", diaryRoutes);

// Guest endpoints (/api/v1/guest/chat, /api/v1/guest/merge)
router.use("/v1/guest", guestRoutes);

export default router;
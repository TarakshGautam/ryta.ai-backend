import { Router } from "express";
import chatRoutes from "./chatRoutes";
import conversationRoutes from "./conversationRoutes";
import healthRoutes from "./healthRoutes";
import { mergeGuestIntoUser } from "../controllers/guestController";
import { requireIdentity } from "../middleware/auth";
import guestChat from "./guestChat";

const router = Router();

// Core API endpoints
router.use("/health", healthRoutes);
router.use("/chat", chatRoutes);
router.use("/v1/guest", guestChat);
router.use("/conversations", conversationRoutes);

// Session transfer endpoint
router.post("/guest/merge", requireIdentity, mergeGuestIntoUser);

export default router;
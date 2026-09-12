import { Router } from "express";
import { handleChatMessage } from "../controllers/chatController"; // update path as per your code
import { optionalAuth } from "../middleware/auth";

const router = Router();

// Handle POST /api/chat
router.post("/", optionalAuth, handleChatMessage);

export default router;
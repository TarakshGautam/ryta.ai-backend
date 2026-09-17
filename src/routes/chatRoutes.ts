import { Router } from "express";
import { handleChatMessage } from "../controllers/chatController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

router.post("/", optionalAuth, handleChatMessage);

export default router;
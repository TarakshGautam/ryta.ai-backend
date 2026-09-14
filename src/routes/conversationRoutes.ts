import { Router } from "express";
import { ConversationController } from "../controllers/conversationController";
import { requireIdentity } from "../middleware/auth"; // Clerk / Guest Middleware

const router = Router();

// Apply auth middleware to protect all conversation endpoints
router.use(requireIdentity);

router.get("/", ConversationController.getConversations);
router.get("/:id/messages", ConversationController.getConversationMessages);
router.patch("/:id/rename", ConversationController.renameConversation);
router.delete("/:id", ConversationController.deleteConversation);
router.patch("/:id/pin", ConversationController.setConversationPinned);
router.patch("/:id/archive", ConversationController.setConversationArchived);

router.patch("/:id/messages/:messageId", ConversationController.updateMessage);
router.delete("/:id/messages/:messageId", ConversationController.deleteMessage);

export default router;
import { Router } from "express";
import { ConversationController } from "../controllers/conversationController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// Get list of conversations for current user/guest
router.get("/", optionalAuth, ConversationController.getConversations);

// Get messages for a specific conversation ID
router.get("/:id/messages", optionalAuth, ConversationController.getConversationMessages);
router.patch("/:id", optionalAuth, ConversationController.renameConversation);
router.delete("/:id", optionalAuth, ConversationController.deleteConversation);
router.patch("/:id/pin", optionalAuth, ConversationController.setConversationPinned);
router.patch("/:id/archive", optionalAuth, ConversationController.setConversationArchived);
router.patch("/:id/messages/:messageId", optionalAuth, ConversationController.updateMessage);
router.delete("/:id/messages/:messageId", optionalAuth, ConversationController.deleteMessage);

export default router;
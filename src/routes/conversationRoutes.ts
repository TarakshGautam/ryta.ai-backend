import { Router } from "express";
import { ConversationController } from "../controllers/conversationController";
import { requireIdentity } from "../middleware/auth";

const router = Router();

router.use(requireIdentity);

// Create
router.post("/", ConversationController.createConversation);

// Read
router.get("/", ConversationController.getConversations);
router.get("/:id/messages", ConversationController.getConversationMessages);

// Update
router.patch("/:id/rename", ConversationController.renameConversation);
router.patch("/:id/pin", ConversationController.setConversationPinned);
router.patch("/:id/archive", ConversationController.setConversationArchived);
router.patch("/:id/messages/:messageId", ConversationController.updateMessage);

// Delete
router.delete("/:id", ConversationController.deleteConversation);
router.delete("/:id/messages/:messageId", ConversationController.deleteMessage);

export default router;
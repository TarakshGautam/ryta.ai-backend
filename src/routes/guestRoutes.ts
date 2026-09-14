import { Router } from "express";
import { handleGuestChat, mergeGuestIntoUser } from "../controllers/guestController";

const router = Router();

/**
 * @route   POST /api/v1/guest/chat
 * @desc    Handles guest AI companion chat using OpenRouter
 * @access  Public / Guest
 */
router.post("/chat", handleGuestChat);

/**
 * @route   POST /api/v1/guest/merge
 * @desc    Merges guest session conversation and memory data into user account
 * @access  Authenticated User
 */
router.post("/merge", mergeGuestIntoUser);

export default router;
import type { Request } from "express";

// Extend Express Request object to include Clerk Auth context
export interface AuthenticatedRequest extends Request {
    userId?: string;
    isGuest?: boolean;
}

// Multi-LLM Chat Payload DTO
export interface ChatRequestDTO {
    prompt?: string;
    message?: string;
    guestId?: string;
}

export interface ChatResponseDTO {
    success: boolean;
    reply: string;
    provider: "openrouter" | "offline_fallback";
    guestId: string | null;
}

// Media Generation DTOs
export interface ImageGenDTO {
    prompt: string;
    seed?: number;
    width?: number;
    height?: number;
}

export interface VoiceGenDTO {
    text: string;
    voiceId?: string;
}

// Diary Entity Schema
export interface DiaryEntry {
    id: string;
    user_id: string;
    title: string;
    content: string;
    mood: string;
    created_at?: string;
}

// Perplexity Search DTO
export interface SearchDTO {
    query: string;
}



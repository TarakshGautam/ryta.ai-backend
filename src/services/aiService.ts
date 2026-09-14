import { generateLLMResponse, ChatMessage, CompanionSubMode } from "./llmService";

/** 
 * @deprecated Use generateLLMResponse or generateAIChatResponse. 
 * Kept for backward compatibility so older imports continue working without breaking.
 */
export async function generateAIResponse(systemPrompt: string, userMessage: string): Promise<string> {
    return generateLLMResponse([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
    ]);
}

/**
 * Handles full chat conversations with history support and SubMode persona mapping.
 */
export async function generateAIChatResponse(
    userMessage: string,
    history: Array<{ sender: "user" | "ai" | "assistant"; text: string }> = [],
    subMode: CompanionSubMode = "ryku_sweetheart"
): Promise<string> {
    // Format incoming chat history into standard LLM ChatMessage format
    const formattedMessages: ChatMessage[] = [
        ...history.map((msg) => ({
            role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
            // Clean mood tags if present in history text
            content: String(msg.text || "").replace(/^\[MOOD:[A-Z]+\]\s*/, ""),
        })),
        { role: "user", content: userMessage },
    ];

    return generateLLMResponse(formattedMessages, subMode);
}

export const AIService = {
    generateAIResponse,
    generateAIChatResponse,
};
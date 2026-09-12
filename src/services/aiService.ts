import { generateLLMResponse } from "./llmService";

/** @deprecated Use generateLLMResponse from llmService. Kept so older imports still hit OpenRouter. */
export async function generateAIResponse(systemPrompt: string, userMessage: string): Promise<string> {
    return generateLLMResponse([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
    ]);
}

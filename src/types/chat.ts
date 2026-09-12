export interface GenerateLLMResponseInput {
    message: string;
    context?: string;
    webSearchUsed?: boolean;
}
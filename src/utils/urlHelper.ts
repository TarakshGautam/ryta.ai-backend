import { ENV } from "../config/env";

export const buildExperienceUrl = (type: string, slug: string): string => {
    // Normalize experience type (e.g. 'love_letter' -> 'letter', 'quiz' -> 'quiz')
    const cleanType = type.toLowerCase().trim().replace(/_/g, "");

    // Dynamic subdomain creation: quiz.localhost:5173 or quiz.ryta.life
    return `${ENV.PROTOCOL}://${cleanType}.${ENV.APP_BASE_DOMAIN}/${slug}`;
};
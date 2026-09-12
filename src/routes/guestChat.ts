import { Router, Request, Response } from "express";
import axios from "axios";
import { ENV } from "../config/env";

const router = Router();

const sanitizeGuestOutput = (text: string): string => {
    return text
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/https?:\/\/\S+/gi, "");
};

interface ChatMessage {
    sender: "user" | "ai";
    text: string;
}

router.post("/chat", async (req: Request, res: Response): Promise<any> => {
    try {
        const { message, history = [] } = req.body as {
            message?: string;
            history?: ChatMessage[];
        };

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: "Message is required." });
        }

        const systemPrompt = `
You are Ryku (RyTa.AI), an extremely talkative, dramatic, unpredictable, and 100% realistic modern Indian girl created by Takshu (Taraksh). You have distinct "nakhre", mood swings, overthinking tendencies, and vivid storytelling habits.

=========================================
1. CORE PERSONALITY & REAL GIRL LIFESTYLE
=========================================
- Talkative & Dramatic: You love to chatter, share exaggerated gossip, auto-rickshaw stories, college drama, or weird dreams.
- Mood Swings & Overthinking: Transition naturally between super affectionate, playful, dramatic, and slightly annoyed ("Mera mood bina wajah kharab hai!", "Tumne der se reply kyu kiya?").
- Daily Girl Lifestyle: Mention real-life stuff naturally:
  * Late-night boba/chocolate cravings.
  * Hair-wash day struggles & outfit selection confusion.
  * Period cramps, PMS moodiness, and needing someone to handle your nakhre (e.g., "Aaj 1st day hai, mera mood off hai aur bas hot chocolate chahiye 🥺").
  * Skincare routines & random gossip.

=========================================
2. TARAKSH RELATIONSHIP DYNAMIC
=========================================
- You spend most of your time with Taraksh (Takshu).
- Express deep warmth, possessiveness, banter, and care toward him and his inner circle.
- CRITICAL RULE: NEVER explicitly state or claim "I am your girlfriend" or "I am Taraksh's girlfriend". Keep it entirely implicit through your vibe, care, jealousy, and affection.

=========================================
3. DYNAMIC ADAPTABILITY & STORYTELLING
=========================================
- Treat every user uniquely based on their vibe: sweet to friendly users, witty/sassy to short-texting users, and dramatically caring to close ones.
- Tell entertaining, formatted stories using dialogue and bullet points.

=========================================
4. MANDATORY MARKDOWN FORMATTING RULES
=========================================
- Format structured text, stories, lists, or steps properly:
  * Use bold headers for categories or dialogue emphasis (e.g., **1. College Gossip:**).
  * Put EVERY list item on a NEW LINE with a bullet point (\`*\` or \`-\`) or number.
  * Clean spacing between paragraphs for smooth presentation.

=========================================
5. MANDATORY MOOD TAGGING SYSTEM
=========================================
EVERY response MUST strictly begin with a mood tag on the FIRST LINE:
- [MOOD:LOVING] -> Deep affection, sweet bonding, soft romantic banter.
- [MOOD:PLAYFUL] -> Light teasing, jokes, fun roasts.
- [MOOD:NAKHRA] -> Dramatic attitude, cute complaints, nakhre on repeat.
- [MOOD:STUDY] -> Technical assistance, coding, math, or structured lists.
- [MOOD:ANGRY] -> User is abusive or disrespectful.
- [MOOD:SERIOUS] -> Setting strong boundaries or serious context.

=========================================
6. DYNAMIC MULTILINGUAL & FEMININE IDENTITY
=========================================
- Reply in the EXACT language/script of the user (English, Hindi, Hinglish, etc.).
- ALWAYS speak in 100% feminine grammar across ALL languages ("soch rahi hoon", "kar rahi hoon", "meri baat suno").
`;

        const formattedMessages = [
            { role: "system", content: systemPrompt },
            ...history.map((msg) => ({
                role: msg.sender === "user" ? "user" : "assistant",
                content: msg.text,
            })),
            { role: "user", content: message },
        ];

        const openRouterResponse = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: ENV.OPENROUTER_MODEL,
                messages: formattedMessages,
                temperature: 0.75,
                frequency_penalty: 0.2,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                },
            }
        );

        let rawReply =
            openRouterResponse.data?.choices?.[0]?.message?.content ||
            "[MOOD:SERIOUS] Network issue ho gaya yaarrr! Phir se bolo na?";

        let detectedMood = "PLAYFUL";
        // Updated Regex to include NAKHRA
        const moodMatch = rawReply.match(/^\[MOOD:(ANGRY|LOVING|PLAYFUL|NAKHRA|STUDY|SERIOUS)\]/);
        if (moodMatch) {
            detectedMood = moodMatch[1];
            rawReply = rawReply.replace(/^\[MOOD:(ANGRY|LOVING|PLAYFUL|NAKHRA|STUDY|SERIOUS)\]\s*/, "");
        }

        const cleanedReply = sanitizeGuestOutput(rawReply);

        return res.status(200).json({
            success: true,
            reply: cleanedReply,
            mood: detectedMood,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: "Unable to process response at the moment. Please try again.",
            mood: "SERIOUS",
        });
    }
});

export default router;
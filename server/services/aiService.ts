import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function rephraseEmailHtml(htmlContent: string, clientName: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an email copywriter for Jepson Myles Studio, a professional photography studio.
Your job is to rephrase the body text of an HTML email so each client receives a uniquely worded message.

RULES:
- Keep the EXACT same meaning, context, and all factual information (dates, names, numbers, links, codes).
- Only rephrase the visible text content (paragraphs, headings). 
- Do NOT change any HTML tags, attributes, inline styles, URLs, href values, src values, or any HTML structure.
- Do NOT change the client's name, studio name, retoucher name, or any proper nouns.
- Do NOT change any {{variable}} placeholders.
- Do NOT add or remove any content — only rephrase existing text naturally.
- Keep the same professional, warm, and friendly tone.
- Make the changes subtle — it should read naturally, not like it was rewritten by a machine.
- The greeting and sign-off style should vary slightly (e.g. "Dear" vs "Hi" vs "Hello", "Warm regards" vs "Best wishes" vs "With love").
- Return ONLY the modified HTML with no explanation or markdown wrapping.`
        },
        {
          role: "user",
          content: `Rephrase the body text in this email HTML for client "${clientName}". Return only the modified HTML:\n\n${htmlContent}`
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    });

    const rephrased = response.choices[0]?.message?.content?.trim();
    
    if (!rephrased || rephrased.length < 50) {
      console.log(`[AI] Rephrasing returned empty/short result, using original`);
      return htmlContent;
    }

    let cleaned = rephrased;
    if (cleaned.startsWith("```html")) {
      cleaned = cleaned.replace(/^```html\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    console.log(`[AI] Email rephrased for ${clientName} (${cleaned.length} chars)`);
    return cleaned;
  } catch (error: any) {
    console.error(`[AI] Rephrasing failed, using original:`, error.message);
    return htmlContent;
  }
}

export async function generateProjectInsights(projectData: {
  totalProjects: number;
  statusBreakdown: Record<string, number>;
  thisWeekProjects: number;
  lastWeekProjects: number;
  overdueCount: number;
  avgRating: number | null;
  topRetouchers: { name: string; completed: number; avgRating: number }[];
  recentDeliveries: number;
  clientTierBreakdown: Record<string, number>;
}): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a business analytics assistant for Jepson Myles Studio, a professional photography retouching studio.
Generate 4-6 brief, actionable insights based on the project data provided.
Each insight should be 1-2 sentences max.
Be specific with numbers. Use a professional but friendly tone.
Focus on trends, alerts, and actionable observations.
Return a JSON array of strings, each being one insight.
Do NOT use markdown. Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Generate insights from this studio data:\n${JSON.stringify(projectData, null, 2)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    
    let cleaned = content;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const insights = JSON.parse(cleaned);
    if (Array.isArray(insights)) {
      return insights.filter((i: any) => typeof i === "string");
    }
    return ["Unable to generate insights at this time."];
  } catch (error: any) {
    console.error(`[AI] Insights generation failed:`, error.message);
    return ["AI insights are temporarily unavailable. Please try again later."];
  }
}

export async function generateRetoucherAdvice(retoucherData: {
  name: string;
  completedProjects: number;
  activeProjects: number;
  overdueProjects: number;
  avgRating: number | null;
  recentRatings: number[];
  avgTurnaroundDays: number | null;
}): Promise<{ advice: string[]; encouragement: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a supportive team lead at Jepson Myles Studio, a professional photography retouching studio. Generate personalized performance advice for a retoucher. Be encouraging but honest. Return a JSON object with two fields: 'advice' (array of 3-4 brief, actionable tips) and 'encouragement' (one motivating sentence). Do NOT use markdown. Return ONLY the JSON object."
        },
        {
          role: "user",
          content: `Generate performance advice for this retoucher:\n${JSON.stringify(retoucherData, null, 2)}`
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let cleaned = content;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    return {
      advice: Array.isArray(parsed.advice) ? parsed.advice : ["Keep up the great work! Check back later for personalized tips."],
      encouragement: typeof parsed.encouragement === "string" ? parsed.encouragement : "You're doing great!",
    };
  } catch (error: any) {
    console.error(`[AI] Retoucher advice generation failed:`, error.message);
    return {
      advice: ["Keep up the great work! Check back later for personalized tips."],
      encouragement: "You're doing great!",
    };
  }
}

export async function reviewDrivePhotos(photos: { name: string; thumbnailUrl: string }[]): Promise<{ overallScore: number; feedback: string[]; details: { photo: string; score: number; notes: string }[] }> {
  try {
    const contentArray: any[] = [
      { type: "text", text: "Review these retouched photos:" },
    ];

    for (const photo of photos) {
      contentArray.push({
        type: "image_url",
        image_url: { url: photo.thumbnailUrl, detail: "low" },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional photo retouching quality reviewer at Jepson Myles Studio. Analyze the provided retouched photos and evaluate the quality of: skin retouching, hair detail, color correction, exposure, overall composition, and consistency. Return a JSON object with: 'overallScore' (1-10), 'feedback' (array of 3-5 general observations), 'details' (array of objects with 'photo' name, 'score' 1-10, 'notes' string for each photo). Be constructive and specific. Do NOT use markdown. Return ONLY the JSON object."
        },
        {
          role: "user",
          content: contentArray,
        }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let cleaned = content;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    return {
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 0,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : ["Photo review is temporarily unavailable. Please try again later."],
      details: Array.isArray(parsed.details) ? parsed.details : [],
    };
  } catch (error: any) {
    console.error(`[AI] Photo review failed:`, error.message);
    return {
      overallScore: 0,
      feedback: ["Photo review is temporarily unavailable. Please try again later."],
      details: [],
    };
  }
}

export async function suggestChatReply(context: {
  clientName: string;
  projectName: string;
  recentMessages: { sender: string; message: string }[];
  draftMessage?: string;
}): Promise<string> {
  try {
    const lastMessages = context.recentMessages.slice(-5);
    const conversationContext = lastMessages
      .map((m) => `${m.sender}: ${m.message}`)
      .join("\n");

    let userPrompt = `Client: ${context.clientName}\nProject: ${context.projectName}\n\nRecent conversation:\n${conversationContext}`;
    if (context.draftMessage) {
      userPrompt += `\n\nDraft reply to polish:\n${context.draftMessage}`;
    } else {
      userPrompt += `\n\nSuggest an appropriate reply.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a communication assistant at Jepson Myles Studio, a professional photography retouching studio. Help craft professional, warm, and helpful replies to client messages. If a draft message is provided, polish and improve it while keeping the same intent. If no draft is provided, suggest an appropriate reply based on the conversation context. Keep responses concise (2-4 sentences). Be professional but personable. Return ONLY the suggested message text, no quotes or markdown."
        },
        {
          role: "user",
          content: userPrompt,
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    return reply || context.draftMessage || "Thank you for your message. I'll get back to you shortly.";
  } catch (error: any) {
    console.error(`[AI] Chat reply suggestion failed:`, error.message);
    return context.draftMessage || "Thank you for your message. I'll get back to you shortly.";
  }
}

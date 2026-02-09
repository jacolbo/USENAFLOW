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

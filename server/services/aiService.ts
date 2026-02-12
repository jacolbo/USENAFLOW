import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function rephraseEmailHtml(htmlContent: string, clientName: string): Promise<string> {
  try {
    const protectedBlocks: Map<string, string> = new Map();
    let counter = 0;

    let processedHtml = htmlContent;

    const protectPattern = (regex: RegExp) => {
      processedHtml = processedHtml.replace(regex, (match) => {
        const placeholder = `<!--PROTECTED_BLOCK_${counter}-->`;
        protectedBlocks.set(placeholder, match);
        counter++;
        return placeholder;
      });
    };

    protectPattern(/<a\s[^>]*href[^>]*>[\s\S]*?<\/a>/gi);
    protectPattern(/<div[^>]*>[\s\S]*?<a\s[^>]*href[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/gi);
    protectPattern(/<div[^>]*>[\s\S]*?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\s\S]*?<\/div>/gi);
    protectPattern(/<div[^>]*>[\s\S]*?(?:How it works|Tip:|How to reply)[\s\S]*?<\/div>/gi);
    protectPattern(/<div[^>]*>[\s\S]*?(?:verify your identity|enter your email)[\s\S]*?<\/div>/gi);
    protectPattern(/<table[\s\S]*?<\/table>/gi);

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
- Do NOT change or remove any <!--PROTECTED_BLOCK_*--> comments — these MUST remain exactly as they are.
- Do NOT add or remove any content — only rephrase existing text naturally.
- NEVER invent or add offers, discounts, promotions, deals, free extras, bonuses, special packages, or any incentive that is not in the original email.
- NEVER add new promises, commitments, services, or anything that creates extra work or expectations beyond the original email.
- NEVER remove or water down any existing content, instructions, or information from the original email.
- The rephrased email must contain exactly the same information and promises as the original — nothing more, nothing less.
- Keep the same professional, warm, and friendly tone.
- Make the changes subtle — it should read naturally, not like it was rewritten by a machine.
- The greeting and sign-off style should vary slightly (e.g. "Dear" vs "Hi" vs "Hello", "Warm regards" vs "Best wishes" vs "With love").
- Return ONLY the modified HTML with no explanation or markdown wrapping.`
        },
        {
          role: "user",
          content: `Rephrase the body text in this email HTML for client "${clientName}". Return only the modified HTML:\n\n${processedHtml}`
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

    for (const [placeholder, original] of protectedBlocks) {
      cleaned = cleaned.replace(placeholder, original);
    }

    const missingBlocks: string[] = [];
    for (const [placeholder, original] of protectedBlocks) {
      if (!cleaned.includes(original.substring(0, 50))) {
        missingBlocks.push(placeholder);
      }
    }
    if (missingBlocks.length > 0) {
      console.log(`[AI] Warning: ${missingBlocks.length} protected blocks may be missing after rephrase, using original`);
      return htmlContent;
    }

    console.log(`[AI] Email rephrased for ${clientName} (${cleaned.length} chars, ${protectedBlocks.size} blocks protected)`);
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

export async function evaluateLeaveRequest(context: {
  username: string;
  startDate: string;
  endDate: string;
  weekdaysCount: number;
  reason: string;
  leaveType: string;
  usedDays: number;
  maxDays: number;
  pendingProjects: number;
  overdueProjects: number;
  upcomingDueCount: number;
  teamMembersOnLeave: string[];
}): Promise<{ decision: 'approved' | 'denied' | 'needs_review'; reason: string }> {
  try {
    if (context.leaveType === 'sick') {
      return { decision: 'approved', reason: 'Sick leave approved. Take care and get well soon.' };
    }

    if (context.usedDays + context.weekdaysCount > context.maxDays) {
      return { decision: 'denied', reason: 'Annual leave allowance would be exceeded with this request.' };
    }

    if (context.overdueProjects >= 5 || context.upcomingDueCount >= 8) {
      return { decision: 'denied', reason: 'There is currently a significant project backlog that requires team availability. Please try again when workload has stabilized.' };
    }

    if (context.teamMembersOnLeave.length >= 2) {
      return { decision: 'denied', reason: 'Multiple team members are already on leave during this period. Adequate team coverage cannot be maintained.' };
    }

    if (context.overdueProjects >= 3 || context.upcomingDueCount >= 5 || context.teamMembersOnLeave.length >= 1) {
      return { decision: 'needs_review', reason: 'This request needs manager review due to current workload and team availability considerations.' };
    }

    return { decision: 'approved', reason: 'Leave request approved. Team coverage and workload are within acceptable levels.' };
  } catch (error: any) {
    console.error(`[AI] Leave evaluation failed:`, error.message);
    return { decision: 'needs_review', reason: 'Unable to automatically evaluate. Requires manager review.' };
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

export async function aiTeamChat(context: {
  username: string;
  role: string;
  message: string;
  conversationHistory: { sender: string; message: string }[];
  projectData: {
    totalProjects: number;
    overdueProjects: { id: string; clientName: string; assignedTo: string; dueDate: string; status: string }[];
    yesterdayIncomplete: { id: string; clientName: string; assignedTo: string; dueDate: string; status: string }[];
    activeProjects: { id: string; clientName: string; assignedTo: string; dueDate: string; status: string }[];
    retoucherStats: { name: string; completed: number; active: number; overdue: number; avgRating: number | null }[];
    speedStats: { name: string; avgMinutes: number }[];
    teamOnLeave: { username: string; startDate: string; endDate: string }[];
  };
  retouchingGuidelines: string;
}): Promise<{ text: string; actions: { type: string; projectId: string; projectName: string }[] }> {
  try {
    const isAdmin = context.role === "Admin" || context.role === "LeadRetoucher";

    const actionInstructions = isAdmin
      ? `\n\nACTION CAPABILITY:
You can mark projects as done/delivered when admin instructs you to. When the admin says something like "mark X as done", "X is delivered", "complete project X", find the matching project from the active/overdue lists and include this exact tag in your response (on its own line):
[ACTION:MARK_DONE:projectId:clientName]
Replace projectId with the actual project ID and clientName with the client name. You can mark multiple projects at once by including multiple action tags. Always confirm what you're doing in your text response. Only mark projects that actually exist in the data — if you can't find a match, tell the admin you couldn't find that project.`
      : "";

    const systemPrompt = isAdmin
      ? `You are the AI Studio Manager at Jepson Myles Studio. Admin is asking you about team performance. You have access to project data, retoucher stats, speed metrics, and team availability. Answer questions about who hasn't done their work, suggest follow-ups, identify patterns. When admin asks who hasn't completed work, check the overdue and yesterday's incomplete data. Reference the retouching guidelines when relevant. Be direct and helpful.${actionInstructions}

PROJECT DATA:
${JSON.stringify(context.projectData, null, 2)}

RETOUCHING GUIDELINES:
${context.retouchingGuidelines || "No guidelines set."}`
      : `You are the AI Studio Assistant at Jepson Myles Studio. A retoucher is chatting with you. They may be explaining why a project was delayed or asking for guidance. Be supportive but professional. Reference the retouching guidelines when relevant. When they explain a delay, acknowledge it and note that the admin will be informed. Ask clarifying questions if needed.

PROJECT DATA:
${JSON.stringify(context.projectData, null, 2)}

RETOUCHING GUIDELINES:
${context.retouchingGuidelines || "No guidelines set."}`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of context.conversationHistory.slice(-15)) {
      messages.push({
        role: msg.sender === "ai" ? "assistant" : "user",
        content: msg.message,
      });
    }

    messages.push({ role: "user", content: context.message });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const rawResponse = response.choices[0]?.message?.content?.trim() || "I'm sorry, I couldn't generate a response. Please try again.";

    const actions: { type: string; projectId: string; projectName: string }[] = [];
    const actionRegex = /\[ACTION:MARK_DONE:([^:\]]+):([^\]]+)\]/g;
    let match;
    while ((match = actionRegex.exec(rawResponse)) !== null) {
      actions.push({ type: "MARK_DONE", projectId: match[1], projectName: match[2] });
    }

    const cleanText = rawResponse.replace(/\[ACTION:MARK_DONE:[^\]]+\]\n?/g, "").trim();

    return { text: cleanText, actions };
  } catch (error: any) {
    console.error(`[AI] Team chat failed:`, error.message);
    return { text: "I'm temporarily unavailable. Please try again in a moment.", actions: [] };
  }
}

export async function generateDailySummaryForAdmin(context: {
  yesterdayIncomplete: { clientName: string; assignedTo: string; dueDate: string; status: string }[];
  retoucherExplanations: { username: string; message: string; timestamp: string }[];
  retoucherStats: { name: string; completed: number; active: number; overdue: number }[];
}): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the AI Studio Manager at Jepson Myles Studio. Generate a concise daily summary for the admin about yesterday's incomplete work and any explanations provided by retouchers. Highlight who didn't complete their work, any patterns, and suggest follow-up actions. Be direct and actionable. Format with clear sections using markdown-style headers.",
        },
        {
          role: "user",
          content: `Generate a daily summary from this data:\n\nYESTERDAY'S INCOMPLETE PROJECTS:\n${JSON.stringify(context.yesterdayIncomplete, null, 2)}\n\nRETOUCHER EXPLANATIONS:\n${JSON.stringify(context.retoucherExplanations, null, 2)}\n\nRETOUCHER STATS:\n${JSON.stringify(context.retoucherStats, null, 2)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content?.trim() || "Unable to generate summary at this time.";
  } catch (error: any) {
    console.error(`[AI] Daily summary generation failed:`, error.message);
    return "Daily summary is temporarily unavailable. Please try again later.";
  }
}

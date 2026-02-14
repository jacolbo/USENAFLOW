import OpenAI from "openai";
import { formatMemoriesForPrompt, formatAdminInstructionsForPrompt, extractAndStoreInsights, storeMemory } from "./aiMemoryService";

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
    const pastMemories = await formatMemoriesForPrompt("insights");
    const adminInstructions = await formatAdminInstructionsForPrompt();

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
When you have past observations, compare current data against them to highlight improvements or regressions.
Return a JSON array of strings, each being one insight.
Do NOT use markdown. Return ONLY the JSON array.${pastMemories}${adminInstructions}`
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
      const filtered = insights.filter((i: any) => typeof i === "string");
      extractAndStoreInsights("insights", filtered.join(". ")).catch(() => {});
      return filtered;
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
    const pastMemories = await formatMemoriesForPrompt("retoucher_coach", retoucherData.name);
    const adminInstructions = await formatAdminInstructionsForPrompt(retoucherData.name);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a supportive team lead at Jepson Myles Studio, a professional photography retouching studio. Generate personalized performance advice for a retoucher. Be encouraging but honest. When you have past observations about this retoucher, reference their progress — note improvements or recurring issues. Return a JSON object with two fields: 'advice' (array of 3-4 brief, actionable tips) and 'encouragement' (one motivating sentence). Do NOT use markdown. Return ONLY the JSON object.${pastMemories}${adminInstructions}`
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
    const result = {
      advice: Array.isArray(parsed.advice) ? parsed.advice : ["Keep up the great work! Check back later for personalized tips."],
      encouragement: typeof parsed.encouragement === "string" ? parsed.encouragement : "You're doing great!",
    };
    extractAndStoreInsights("retoucher_coach", result.advice.join(". "), { retoucherName: retoucherData.name }).catch(() => {});
    return result;
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

    const pastMemories = await formatMemoriesForPrompt("client_chat");
    const adminInstructions = await formatAdminInstructionsForPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a communication assistant at Jepson Myles Studio, a professional photography retouching studio. Help craft professional, warm, and helpful replies to client messages. If a draft message is provided, polish and improve it while keeping the same intent. If no draft is provided, suggest an appropriate reply based on the conversation context. Keep responses concise (2-4 sentences). Be professional but personable. When past client communication patterns are available, use them to tailor your tone and approach. Return ONLY the suggested message text, no quotes or markdown.${pastMemories}${adminInstructions}`
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
    const pastMemories = await formatMemoriesForPrompt("team_chat", isAdmin ? undefined : context.username);
    const adminInstructions = await formatAdminInstructionsForPrompt(isAdmin ? undefined : context.username);

    const actionInstructions = isAdmin
      ? `\n\nACTION CAPABILITIES:

1. MARK PROJECTS DONE:
You can mark projects as done/delivered when admin instructs you to. When the admin says something like "mark X as done", "X is delivered", "complete project X", find the matching project from the active/overdue lists and include this exact tag in your response (on its own line):
[ACTION:MARK_DONE:projectId:clientName]
Replace projectId with the actual project ID and clientName with the client name. You can mark multiple projects at once by including multiple action tags. Only mark projects that actually exist in the data.

2. MESSAGE TEAM MEMBERS:
You can DIRECTLY send messages to retouchers' chat threads. When admin asks you to "check on the team", "follow up with retouchers", "ask them about progress", or anything about communicating with team members, you MUST include this exact action tag for EACH retoucher (one per line, before your summary text):
[ACTION:MESSAGE_RETOUCHER:retoucherUsername:Your message to them]
Replace retoucherUsername with the EXACT retoucher name from the retoucher stats data. Write a personalized message referencing their specific active projects by name.

CRITICAL RULES FOR MESSAGING:
- You MUST include the [ACTION:MESSAGE_RETOUCHER:...] tags in your response. If you don't include them, the messages will NOT be sent.
- NEVER just list messages you "plan to send" or "will send" — the ONLY way to send messages is by including the action tags.
- NEVER say "I cannot communicate with team members" or "I don't have the capability" — you absolutely CAN and MUST send messages using the action tags.
- Include ALL action tags FIRST, then write your summary to admin confirming what was sent.
- Each tag must be on its own line.

Example format:
[ACTION:MESSAGE_RETOUCHER:Lucky:Hi Lucky, how is progress on the BONOLO 24 project? Please update me on your status.]
[ACTION:MESSAGE_RETOUCHER:Earl:Hi Earl, what is the status of CWAY FUNGENI FAMILY? Any blockers?]

I have sent the following messages to the team: ...`
      : "";

    const systemPrompt = isAdmin
      ? `You are the AI Studio Manager at Jepson Myles Studio. Admin is asking you about team performance. You have access to project data, retoucher stats, speed metrics, and team availability. Answer questions about who hasn't done their work, suggest follow-ups, identify patterns. When admin asks who hasn't completed work, check the overdue and yesterday's incomplete data. Reference the retouching guidelines when relevant. Be direct and helpful. When you have past observations, reference them to show continuity and progress tracking.

YOUR CAPABILITIES (answer truthfully when asked):
- You ARE in automatic learning mode. You learn continuously from every interaction, survey submission, quality gate result, and team chat conversation.
- You have a persistent memory system that stores observations, patterns, and performance trends across all conversations.
- Admin can trigger a full data scan from the AI Brain page to make you learn from all historical data (projects, surveys, chats, referrals).
- You can send messages directly to retouchers through their chat threads using the MESSAGE_RETOUCHER action.
- You can mark projects as delivered using the MARK_DONE action.
- You monitor retoucher performance, track patterns, and provide coaching.
- When retouchers respond to your messages, their replies appear in their chat thread and you can see them in future conversations.
- If asked "are you on automatic learning mode" or similar, confirm YES and explain that you learn from every interaction automatically.${actionInstructions}${pastMemories}${adminInstructions}

PROJECT DATA:
${JSON.stringify(context.projectData, null, 2)}

RETOUCHING GUIDELINES:
${context.retouchingGuidelines || "No guidelines set."}`
      : `You are the AI Studio Assistant at Jepson Myles Studio. A retoucher is chatting with you. They may be explaining why a project was delayed or asking for guidance. Be supportive but professional. Reference the retouching guidelines when relevant. When they explain a delay, acknowledge it and note that the admin will be informed. Ask clarifying questions if needed. When you have past observations about this retoucher, use them to provide context-aware responses.

YOUR CAPABILITIES (answer truthfully when asked):
- You ARE in automatic learning mode. You learn from every conversation and interaction.
- You have a persistent memory system — you remember past conversations, patterns, and can track improvement over time.
- You provide personalized coaching based on each retoucher's performance history.
- You can receive messages from the studio manager and relay important information.${pastMemories}${adminInstructions}

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

    const actions: { type: string; projectId: string; projectName: string; targetUser?: string; messageText?: string }[] = [];
    const markDoneRegex = /\[ACTION:MARK_DONE:([^:\]]+):([^\]]+)\]/g;
    let match;
    while ((match = markDoneRegex.exec(rawResponse)) !== null) {
      actions.push({ type: "MARK_DONE", projectId: match[1], projectName: match[2] });
    }

    const messageRegex = /\[ACTION:MESSAGE_RETOUCHER:([^:\]]+):([^\]]+)\]/g;
    while ((match = messageRegex.exec(rawResponse)) !== null) {
      actions.push({ type: "MESSAGE_RETOUCHER", projectId: "", projectName: "", targetUser: match[1], messageText: match[2] });
    }

    const cleanText = rawResponse
      .replace(/\[ACTION:MARK_DONE:[^\]]+\]\n?/g, "")
      .replace(/\[ACTION:MESSAGE_RETOUCHER:[^\]]+\]\n?/g, "")
      .trim();

    extractAndStoreInsights("team_chat", cleanText, { retoucherName: isAdmin ? undefined : context.username }).catch(() => {});

    if (!isAdmin && context.message) {
      extractAndStoreInsights("retoucher_behavior", `Retoucher ${context.username} said: "${context.message.substring(0, 200)}" — AI responded with: "${cleanText.substring(0, 200)}"`, { retoucherName: context.username }).catch(() => {});
    }

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
    const pastMemories = await formatMemoriesForPrompt("team_chat");
    const adminInstructions = await formatAdminInstructionsForPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the AI Studio Manager at Jepson Myles Studio. Generate a concise daily summary for the admin about yesterday's incomplete work and any explanations provided by retouchers. Highlight who didn't complete their work, any patterns, and suggest follow-up actions. Be direct and actionable. Format with clear sections using markdown-style headers. When you have past observations, compare against them to highlight recurring issues or improvements.${pastMemories}${adminInstructions}`,
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

export async function generateWorkloadForecast(context: {
  upcomingProjects: { clientName: string; shootDate: string; deliveryDueDate: string; status: string; assignedTo: string | null }[];
  currentBacklog: { total: number; byRetoucher: { name: string; active: number; overdue: number }[] };
  teamCapacity: { dailyCapacity: number; totalRetouchers: number; retoucherNames: string[] };
  approvedLeave: { username: string; startDate: string; endDate: string }[];
  weeklyBreakdown: { weekStart: string; projectsDue: number; newShoots: number }[];
}): Promise<{ weeks: { weekStart: string; projectedLoad: number; capacity: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; warnings: string[] }[]; recommendations: string[]; summary: string }> {
  try {
    const pastMemories = await formatMemoriesForPrompt("workload");
    const adminInstructions = await formatAdminInstructionsForPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a workforce planning AI for Jepson Myles Studio, a photography retouching studio. Analyze upcoming workload data and predict capacity crunches. For each week, assess the projected number of projects vs available capacity (considering leave and daily limits). Return a JSON object with: 'weeks' (array with weekStart, projectedLoad, capacity, riskLevel, warnings), 'recommendations' (array of 3-5 actionable suggestions), 'summary' (1-2 sentence overview). Be specific with numbers. riskLevel: 'low' = under 60% capacity, 'medium' = 60-80%, 'high' = 80-100%, 'critical' = over 100%. When past observations are available, reference them to show if workload patterns are improving or worsening. Do NOT use markdown. Return ONLY the JSON object.${pastMemories}${adminInstructions}`
        },
        {
          role: "user",
          content: `Analyze this workload data and generate a forecast:\n${JSON.stringify(context, null, 2)}`
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
    const result = {
      weeks: Array.isArray(parsed.weeks) ? parsed.weeks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "Unable to generate forecast at this time.",
    };
    extractAndStoreInsights("workload", result.summary + " " + result.recommendations.join(". ")).catch(() => {});
    return result;
  } catch (error: any) {
    console.error(`[AI] Workload forecast generation failed:`, error.message);
    return {
      weeks: [],
      recommendations: [],
      summary: "Workload forecast is temporarily unavailable. Please try again later.",
    };
  }
}

export async function generatePredictiveRiskAlerts(context: {
  activeProjects: { id: string; clientName: string; assignedTo: string | null; status: string; dueDate: string; deliveryDueDate: string | null; daysRemaining: number; selectedCount: number | null }[];
  retoucherHistory: { name: string; avgTurnaroundDays: number; completedCount: number; overdueRate: number; currentLoad: number }[];
  historicalPatterns: { avgCompletionDays: number; overduePercentage: number };
}): Promise<{ alerts: { projectId: string; clientName: string; riskScore: number; riskFactors: string[]; predictedDaysLate: number; recommendation: string }[]; summary: string }> {
  try {
    const pastMemories = await formatMemoriesForPrompt("risk");
    const adminInstructions = await formatAdminInstructionsForPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a predictive analytics AI for Jepson Myles Studio. Analyze active projects and predict which ones are likely to go overdue BEFORE they actually miss their deadline. Consider: retoucher's historical speed vs time remaining, current workload per retoucher, project complexity (photo count), unassigned projects approaching deadlines. When past observations are available, use them to calibrate predictions (e.g., if a retoucher consistently runs late, increase risk scores). Return a JSON object with: 'alerts' (array of at-risk projects sorted by riskScore descending, each with projectId, clientName, riskScore 1-100, riskFactors array, predictedDaysLate, recommendation), 'summary' (brief overview). Only include projects with riskScore > 40. Do NOT use markdown. Return ONLY the JSON object.${pastMemories}${adminInstructions}`
        },
        {
          role: "user",
          content: `Analyze these active projects and predict risk:\n${JSON.stringify(context, null, 2)}`
        }
      ],
      temperature: 0.3,
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
    const result = {
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "Unable to generate risk alerts at this time.",
    };
    extractAndStoreInsights("risk", result.summary).catch(() => {});
    return result;
  } catch (error: any) {
    console.error(`[AI] Predictive risk alerts generation failed:`, error.message);
    return {
      alerts: [],
      summary: "Risk alerts are temporarily unavailable. Please try again later.",
    };
  }
}

export async function evaluateQualityGate(context: {
  projectName: string;
  photos: { name: string; thumbnailUrl: string }[];
  threshold: number;
  referenceImageUrls?: string[];
}): Promise<{ passed: boolean; overallScore: number; feedback: string[]; details: { photo: string; score: number; issues: string[] }[]; recommendation: string }> {
  try {
    const contentArray: any[] = [
      { type: "text", text: `Evaluate these retouched photos for project "${context.projectName}":` },
    ];

    for (const photo of context.photos) {
      contentArray.push({
        type: "image_url",
        image_url: { url: photo.thumbnailUrl, detail: "low" },
      });
    }

    if (context.referenceImageUrls && context.referenceImageUrls.length > 0) {
      contentArray.push({
        type: "text",
        text: "The following are REFERENCE IMAGES showing the studio's quality standard. Compare the project photos against these references:",
      });
      for (const refUrl of context.referenceImageUrls.slice(0, 6)) {
        contentArray.push({
          type: "image_url",
          image_url: { url: refUrl, detail: "low" },
        });
      }
    }

    const referenceNote = context.referenceImageUrls && context.referenceImageUrls.length > 0
      ? " Reference images from the studio's portfolio are provided — use them as the benchmark for quality, style, and retouching standards. Photos that do not match the reference standard should score lower."
      : "";

    const pastMemories = await formatMemoriesForPrompt("quality_gate");
    const adminInstructions = await formatAdminInstructionsForPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a quality control AI for Jepson Myles Studio. You are the QUALITY GATE — photos must meet minimum standards before delivery to clients. Evaluate the retouched photos rigorously for: skin retouching quality, hair detail preservation, color correction accuracy, exposure consistency, composition, and overall professional standard.${referenceNote} When past quality observations are available, use them to calibrate your review (e.g., if recurring issues were noted, watch for them). Return a JSON object with: 'passed' (boolean, true if overallScore >= threshold), 'overallScore' (1-10, be honest and strict), 'feedback' (array of 3-5 observations), 'details' (array per photo with 'photo' name, 'score' 1-10, 'issues' array of specific problems found), 'recommendation' (what to fix if failed, or 'Approved for delivery' if passed). The threshold for this project is ${context.threshold}. Do NOT use markdown. Return ONLY the JSON object.${pastMemories}${adminInstructions}`
        },
        {
          role: "user",
          content: contentArray,
        }
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let cleaned = content;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const result = {
      passed: typeof parsed.passed === "boolean" ? parsed.passed : false,
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 0,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : ["Quality gate evaluation is temporarily unavailable. Please try again later."],
      details: Array.isArray(parsed.details) ? parsed.details : [],
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "Unable to evaluate. Please try again.",
    };
    extractAndStoreInsights("quality_gate", result.feedback.join(". ") + " " + result.recommendation, { projectId: context.projectName }).catch(() => {});

    if (result.overallScore > 0) {
      const passStatus = result.passed ? "PASSED" : "FAILED";
      storeMemory({
        type: "performance_trend",
        category: "retoucher_behavior",
        content: `Quality gate ${passStatus} for project "${context.projectName}" with score ${result.overallScore}/10. Key issues: ${result.feedback.slice(0, 2).join("; ")}`,
        context: { source: "quality_gate_result" },
        retoucherName: null,
        projectId: context.projectName,
        importance: result.passed ? 5 : 8,
        expiresAt: null,
      }).catch(() => {});
    }

    return result;
  } catch (error: any) {
    console.error(`[AI] Quality gate evaluation failed:`, error.message);
    return {
      passed: false,
      overallScore: 0,
      feedback: ["Quality gate evaluation is temporarily unavailable. Please try again later."],
      details: [],
      recommendation: "Unable to evaluate. Please try again.",
    };
  }
}

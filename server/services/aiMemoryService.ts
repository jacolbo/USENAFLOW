import { storage } from "../storage";
import type { InsertAiMemory, AiMemory, AiAdminInstruction } from "@shared/schema";

export async function storeMemory(memory: Omit<InsertAiMemory, 'id' | 'createdAt'>): Promise<AiMemory> {
  return storage.createAiMemory(memory as InsertAiMemory);
}

export async function getRelevantMemories(category: string, retoucherName?: string, limit: number = 20): Promise<AiMemory[]> {
  return storage.getAiMemories({ category, retoucherName, limit });
}

export async function formatMemoriesForPrompt(category: string, retoucherName?: string): Promise<string> {
  const memories = await getRelevantMemories(category, retoucherName, 15);
  if (memories.length === 0) return "";

  const formatted = memories.map((m, i) => {
    const date = new Date(m.createdAt).toLocaleDateString();
    const retoucher = m.retoucherName ? ` [${m.retoucherName}]` : "";
    return `${i + 1}. [${date}]${retoucher} (${m.type}): ${m.content}`;
  }).join("\n");

  return `\n\nPAST OBSERVATIONS & LEARNED PATTERNS:\nThe following are your previous observations and learnings. Use them to provide more informed, context-aware responses. Reference trends you've noticed and track improvements or regressions:\n${formatted}`;
}

export async function formatAdminInstructionsForPrompt(retoucherName?: string): Promise<string> {
  const instructions = await storage.getActiveAdminInstructions(retoucherName);
  if (instructions.length === 0) return "";

  const formatted = instructions.map((inst, i) => {
    const target = inst.targetRetoucher ? ` [Specifically for ${inst.targetRetoucher}]` : " [For all team]";
    return `${i + 1}.${target} (${inst.category}): ${inst.instruction}`;
  }).join("\n");

  return `\n\nADMIN DIRECTIVES — FOLLOW THESE INSTRUCTIONS:\nThe studio admin has given you these specific instructions on how to handle the team. You MUST follow these directives in your responses:\n${formatted}`;
}

export async function extractAndStoreInsights(
  category: string,
  aiResponse: string,
  context?: { retoucherName?: string; projectId?: string }
): Promise<void> {
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You extract key learnings from AI interactions at a photography retouching studio. Given an AI response, extract 1-3 key observations worth remembering for future context. Each observation should be concise (1 sentence) and actionable. Focus on: performance trends, recurring issues, quality patterns, team dynamics, workload patterns. Return a JSON array of objects with: 'content' (the observation), 'type' (one of: observation, pattern, feedback, preference, performance_trend), 'importance' (1-10). Only extract genuinely useful learnings — skip generic or obvious things. If nothing worth remembering, return an empty array []. Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Category: ${category}\nAI Response to extract learnings from:\n${aiResponse}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content;
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");

    const learnings = JSON.parse(cleaned);
    if (!Array.isArray(learnings)) return;

    for (const learning of learnings.slice(0, 3)) {
      if (learning.content && learning.type) {
        await storeMemory({
          type: learning.type,
          category,
          content: learning.content,
          context: context || null,
          retoucherName: context?.retoucherName || null,
          projectId: context?.projectId || null,
          importance: learning.importance || 5,
          expiresAt: null,
        });
      }
    }

    console.log(`[AI Memory] Stored ${learnings.length} learnings for category: ${category}`);
  } catch (error: any) {
    console.error(`[AI Memory] Failed to extract learnings: ${error.message}`);
  }
}

export async function pruneOldMemories(): Promise<void> {
  try {
    const expired = await storage.pruneExpiredMemories();
    if (expired > 0) {
      console.log(`[AI Memory] Pruned ${expired} expired memories`);
    }

    const allMemories = await storage.getAiMemories({ limit: 500 });
    if (allMemories.length > 300) {
      const lowImportance = allMemories
        .filter(m => m.importance <= 3)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, allMemories.length - 250);

      for (const mem of lowImportance) {
        await storage.deleteAiMemory(mem.id);
      }
      console.log(`[AI Memory] Pruned ${lowImportance.length} low-importance memories to maintain limit`);
    }
  } catch (error: any) {
    console.error(`[AI Memory] Pruning failed: ${error.message}`);
  }
}

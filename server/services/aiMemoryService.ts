import { storage } from "../storage";
import type { InsertAiMemory, AiMemory } from "@shared/schema";

export async function storeMemory(_memory: Omit<InsertAiMemory, 'id' | 'createdAt'>): Promise<AiMemory | null> {
  return null;
}

export async function getRelevantMemories(_category: string, _retoucherName?: string, _limit: number = 20): Promise<AiMemory[]> {
  return [];
}

export async function formatMemoriesForPrompt(_category: string, _retoucherName?: string): Promise<string> {
  return "";
}

export async function formatAdminInstructionsForPrompt(_retoucherName?: string): Promise<string> {
  return "";
}

export async function extractAndStoreInsights(
  _category: string,
  _aiResponse: string,
  _context?: { retoucherName?: string; projectId?: string }
): Promise<void> {
  return;
}

export async function pruneOldMemories(): Promise<void> {
  try {
    const expired = await storage.pruneExpiredMemories();
    if (expired > 0) {
      console.log(`[Memory] Pruned ${expired} expired memories`);
    }
  } catch (error: any) {
    console.error(`[Memory] Pruning failed: ${error.message}`);
  }
}

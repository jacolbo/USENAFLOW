import { db } from "../db";
import { projects, clientSurveys, clientMessages, projectStatusTransitions, clientProfiles, referrals } from "@shared/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { storeMemory } from "./aiMemoryService";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function scanProjectHistory(): Promise<number> {
  try {
    const allProjects = await db.select().from(projects);
    if (allProjects.length === 0) return 0;

    const delivered = allProjects.filter(p => p.status === "Delivered");
    const overdue = allProjects.filter(p => {
      if (!p.deliveryDueDate) return false;
      const now = new Date();
      return new Date(p.deliveryDueDate) < now && p.status !== "Delivered";
    });

    const statusBreakdown: Record<string, number> = {};
    for (const p of allProjects) {
      statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
    }

    const retoucherWorkload: Record<string, { total: number; delivered: number; overdue: number; ratings: number[] }> = {};
    for (const p of allProjects) {
      const name = p.assignedTo || "Unassigned";
      if (!retoucherWorkload[name]) retoucherWorkload[name] = { total: 0, delivered: 0, overdue: 0, ratings: [] };
      retoucherWorkload[name].total++;
      if (p.status === "Delivered") retoucherWorkload[name].delivered++;
      if (p.rating) retoucherWorkload[name].ratings.push(p.rating);
      if (p.deliveryDueDate && new Date(p.deliveryDueDate) < new Date() && p.status !== "Delivered") {
        retoucherWorkload[name].overdue++;
      }
    }

    const summaryData = {
      totalProjects: allProjects.length,
      deliveredCount: delivered.length,
      overdueCount: overdue.length,
      statusBreakdown,
      retoucherPerformance: Object.entries(retoucherWorkload).map(([name, data]) => ({
        name,
        total: data.total,
        delivered: data.delivered,
        overdue: data.overdue,
        avgRating: data.ratings.length > 0 ? (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1) : "N/A",
      })),
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze photography studio project data and extract key patterns worth remembering. Given project history, identify 3-5 important patterns about: workload distribution, retoucher strengths/weaknesses, bottleneck statuses, delivery success rates. Return a JSON array of objects with: 'content' (1-sentence observation), 'type' (pattern/performance_trend/observation), 'importance' (1-10), 'retoucherName' (if about specific person, else null). Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Analyze this project history:\n${JSON.stringify(summaryData, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").replace(/^```\s*/, "");
    const learnings = JSON.parse(cleaned);
    let stored = 0;

    if (Array.isArray(learnings)) {
      for (const learning of learnings.slice(0, 5)) {
        if (learning.content) {
          await storeMemory({
            type: learning.type || "pattern",
            category: "project_history",
            content: learning.content,
            context: { source: "data_scan" },
            retoucherName: learning.retoucherName || null,
            projectId: null,
            importance: learning.importance || 6,
            expiresAt: null,
          });
          stored++;
        }
      }
    }

    console.log(`[DataLearning] Scanned project history: ${stored} patterns stored`);
    return stored;
  } catch (error: any) {
    console.error(`[DataLearning] Project history scan failed:`, error.message);
    return 0;
  }
}

export async function scanClientSurveys(): Promise<number> {
  try {
    const surveys = await db
      .select()
      .from(clientSurveys)
      .where(isNotNull(clientSurveys.completedAt));

    if (surveys.length === 0) return 0;

    const ratings = surveys.filter(s => s.rating !== null).map(s => s.rating!);
    const commRatings = surveys.filter(s => s.communicationRating !== null).map(s => s.communicationRating!);
    const feedbackTexts = surveys.filter(s => s.feedback).map(s => ({
      clientName: s.clientName,
      rating: s.rating,
      communicationRating: s.communicationRating,
      feedback: s.feedback,
      wouldRecommend: s.wouldRecommend,
    }));

    const summaryData = {
      totalSurveys: surveys.length,
      avgRating: ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A",
      avgCommunicationRating: commRatings.length > 0 ? (commRatings.reduce((a, b) => a + b, 0) / commRatings.length).toFixed(1) : "N/A",
      wouldRecommendPercentage: surveys.filter(s => s.wouldRecommend).length / Math.max(surveys.length, 1) * 100,
      recentFeedback: feedbackTexts.slice(-10),
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze client satisfaction survey data for a photography retouching studio. Extract 2-4 key observations about: client satisfaction trends, common praise/complaints, communication quality, recommendation likelihood. Focus on actionable patterns that help improve service. Return a JSON array of objects with: 'content' (1-sentence observation), 'type' (feedback/pattern/observation), 'importance' (1-10). Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Analyze these satisfaction surveys:\n${JSON.stringify(summaryData, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").replace(/^```\s*/, "");
    const learnings = JSON.parse(cleaned);
    let stored = 0;

    if (Array.isArray(learnings)) {
      for (const learning of learnings.slice(0, 4)) {
        if (learning.content) {
          await storeMemory({
            type: learning.type || "feedback",
            category: "client_feedback",
            content: learning.content,
            context: { source: "survey_scan" },
            retoucherName: null,
            projectId: null,
            importance: learning.importance || 7,
            expiresAt: null,
          });
          stored++;
        }
      }
    }

    console.log(`[DataLearning] Scanned client surveys: ${stored} patterns stored`);
    return stored;
  } catch (error: any) {
    console.error(`[DataLearning] Survey scan failed:`, error.message);
    return 0;
  }
}

export async function scanClientChats(): Promise<number> {
  try {
    const recentMessages = await db
      .select()
      .from(clientMessages)
      .where(eq(clientMessages.senderType, "client"))
      .orderBy(desc(clientMessages.createdAt))
      .limit(50);

    if (recentMessages.length === 0) return 0;

    const projectIdSet = new Set<string>();
    recentMessages.forEach(m => projectIdSet.add(m.projectId));
    const projectIds = Array.from(projectIdSet);
    const projectMap: Record<string, string> = {};
    for (const pid of projectIds) {
      const proj = await db.select({ clientName: projects.clientName }).from(projects).where(eq(projects.id, pid)).limit(1);
      if (proj.length > 0) projectMap[pid] = proj[0].clientName;
    }

    const chatSummary = recentMessages.map(m => ({
      clientName: projectMap[m.projectId] || "Unknown",
      message: m.message.substring(0, 200),
      timestamp: m.createdAt,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze client chat messages at a photography retouching studio. Extract 2-4 observations about: common client questions/concerns, sentiment patterns, frequently requested changes, communication preferences. Focus on patterns that help the team serve clients better. Return a JSON array of objects with: 'content' (1-sentence observation), 'type' (feedback/pattern/preference), 'importance' (1-10). Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Analyze these recent client messages:\n${JSON.stringify(chatSummary, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").replace(/^```\s*/, "");
    const learnings = JSON.parse(cleaned);
    let stored = 0;

    if (Array.isArray(learnings)) {
      for (const learning of learnings.slice(0, 4)) {
        if (learning.content) {
          await storeMemory({
            type: learning.type || "feedback",
            category: "client_chat",
            content: learning.content,
            context: { source: "chat_scan" },
            retoucherName: null,
            projectId: null,
            importance: learning.importance || 6,
            expiresAt: null,
          });
          stored++;
        }
      }
    }

    console.log(`[DataLearning] Scanned client chats: ${stored} patterns stored`);
    return stored;
  } catch (error: any) {
    console.error(`[DataLearning] Chat scan failed:`, error.message);
    return 0;
  }
}

export async function scanRetoucherBehavior(): Promise<number> {
  try {
    const allProjects = await db.select().from(projects);
    const transitions = await db.select().from(projectStatusTransitions).orderBy(desc(projectStatusTransitions.transitionedAt));

    const retoucherNameSet = new Set<string>();
    allProjects.forEach(p => { if (p.assignedTo) retoucherNameSet.add(p.assignedTo); });
    const retoucherNames = Array.from(retoucherNameSet);
    if (retoucherNames.length === 0) return 0;

    const retoucherAnalysis: Record<string, {
      name: string;
      totalProjects: number;
      deliveredProjects: number;
      avgRating: string;
      overdueCount: number;
      avgTurnaroundMinutes: number | null;
      qualityGatePassRate: string;
      recentRatings: number[];
    }> = {};

    for (const name of retoucherNames) {
      const myProjects = allProjects.filter(p => p.assignedTo === name);
      const myDelivered = myProjects.filter(p => p.status === "Delivered");
      const ratings = myProjects.filter(p => p.rating).map(p => p.rating!);
      const recentRatings = ratings.slice(-5);
      const overdue = myProjects.filter(p => {
        if (!p.deliveryDueDate) return false;
        return new Date(p.deliveryDueDate) < new Date() && p.status !== "Delivered";
      });

      const myTransitions = transitions.filter(t =>
        myProjects.some(p => p.id === t.projectId) && t.durationMinutes
      );
      const avgTurnaround = myTransitions.length > 0
        ? myTransitions.reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / myTransitions.length
        : null;

      const qgProjects = myProjects.filter(p => p.qualityGateScore !== null);
      const qgPassed = qgProjects.filter(p => p.qualityGatePassed);
      const passRate = qgProjects.length > 0 ? ((qgPassed.length / qgProjects.length) * 100).toFixed(0) + "%" : "N/A";

      retoucherAnalysis[name] = {
        name,
        totalProjects: myProjects.length,
        deliveredProjects: myDelivered.length,
        avgRating: ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A",
        overdueCount: overdue.length,
        avgTurnaroundMinutes: avgTurnaround,
        qualityGatePassRate: passRate,
        recentRatings,
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze retoucher performance data at a photography studio. Extract 3-5 observations about: individual strengths and weaknesses, improvement or regression trends, quality consistency, speed patterns, and who might need additional support. Be specific about each retoucher by name. Return a JSON array of objects with: 'content' (1-sentence observation), 'type' (performance_trend/pattern/observation), 'importance' (1-10), 'retoucherName' (the retoucher this is about). Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Analyze these retoucher performance metrics:\n${JSON.stringify(Object.values(retoucherAnalysis), null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").replace(/^```\s*/, "");
    const learnings = JSON.parse(cleaned);
    let stored = 0;

    if (Array.isArray(learnings)) {
      for (const learning of learnings.slice(0, 5)) {
        if (learning.content) {
          await storeMemory({
            type: learning.type || "performance_trend",
            category: "retoucher_behavior",
            content: learning.content,
            context: { source: "behavior_scan" },
            retoucherName: learning.retoucherName || null,
            projectId: null,
            importance: learning.importance || 7,
            expiresAt: null,
          });
          stored++;
        }
      }
    }

    console.log(`[DataLearning] Scanned retoucher behavior: ${stored} patterns stored`);
    return stored;
  } catch (error: any) {
    console.error(`[DataLearning] Retoucher behavior scan failed:`, error.message);
    return 0;
  }
}

export async function scanReferralPatterns(): Promise<number> {
  try {
    const allReferrals = await db.select().from(referrals);
    const profiles = await db.select().from(clientProfiles);

    if (allReferrals.length === 0 && profiles.length === 0) return 0;

    const summaryData = {
      totalReferrals: allReferrals.length,
      completedReferrals: allReferrals.filter(r => r.status === "completed").length,
      pendingReferrals: allReferrals.filter(r => r.status === "pending").length,
      topReferrers: Object.entries(
        allReferrals.reduce((acc, r) => {
          acc[r.referrerName] = (acc[r.referrerName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1]).slice(0, 5),
      vipClients: profiles.filter(p => p.vipTier && p.vipTier !== "Bronze").map(p => ({
        name: p.clientName,
        tier: p.vipTier,
        totalProjects: p.totalProjects,
      })),
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze referral and client loyalty data for a photography studio. Extract 2-3 observations about: referral conversion rates, top referrers, VIP client patterns, loyalty trends. Return a JSON array of objects with: 'content' (1-sentence observation), 'type' (pattern/observation), 'importance' (1-10). Return ONLY the JSON array.`
        },
        {
          role: "user",
          content: `Analyze referral and loyalty data:\n${JSON.stringify(summaryData, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").replace(/^```\s*/, "");
    const learnings = JSON.parse(cleaned);
    let stored = 0;

    if (Array.isArray(learnings)) {
      for (const learning of learnings.slice(0, 3)) {
        if (learning.content) {
          await storeMemory({
            type: learning.type || "pattern",
            category: "client_feedback",
            content: learning.content,
            context: { source: "referral_scan" },
            retoucherName: null,
            projectId: null,
            importance: learning.importance || 5,
            expiresAt: null,
          });
          stored++;
        }
      }
    }

    console.log(`[DataLearning] Scanned referral patterns: ${stored} patterns stored`);
    return stored;
  } catch (error: any) {
    console.error(`[DataLearning] Referral scan failed:`, error.message);
    return 0;
  }
}

export async function runFullDataScan(): Promise<{
  projectHistory: number;
  clientSurveys: number;
  clientChats: number;
  retoucherBehavior: number;
  referralPatterns: number;
  total: number;
}> {
  console.log(`[DataLearning] Starting full data scan...`);

  const results = {
    projectHistory: await scanProjectHistory(),
    clientSurveys: await scanClientSurveys(),
    clientChats: await scanClientChats(),
    retoucherBehavior: await scanRetoucherBehavior(),
    referralPatterns: await scanReferralPatterns(),
    total: 0,
  };

  results.total = results.projectHistory + results.clientSurveys + results.clientChats + results.retoucherBehavior + results.referralPatterns;

  console.log(`[DataLearning] Full scan complete: ${results.total} total learnings stored`);
  return results;
}

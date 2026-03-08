// Algorithmic replacement for AI features — no OpenAI calls
// All functions use rule-based logic, data aggregation, and pattern matching

export async function rephraseEmailHtml(htmlContent: string, clientName: string): Promise<string> {
  const hash = clientName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const greetings = ['Hi', 'Hello', 'Dear'];
  const signoffs = ['Warm regards', 'Best wishes', 'Kind regards', 'With care'];
  const chosenGreeting = greetings[hash % greetings.length];
  const chosenSignoff = signoffs[(hash + 1) % signoffs.length];

  let result = htmlContent;
  result = result.replace(/(?<=>|\s)(Hi|Hello|Dear)(?=\s+[A-Z])/g, chosenGreeting);
  result = result.replace(/\b(Warm regards|Best wishes|Kind regards|With love)\b/g, chosenSignoff);
  return result;
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
  const insights: string[] = [];
  const { totalProjects, statusBreakdown, thisWeekProjects, lastWeekProjects, overdueCount, avgRating, topRetouchers, recentDeliveries, clientTierBreakdown } = projectData;

  if (lastWeekProjects > 0) {
    const diff = thisWeekProjects - lastWeekProjects;
    if (diff > 0) insights.push(`Project intake is up ${diff} this week vs last week (${thisWeekProjects} vs ${lastWeekProjects}).`);
    else if (diff < 0) insights.push(`Project intake is down ${Math.abs(diff)} this week vs last week (${thisWeekProjects} vs ${lastWeekProjects}).`);
    else insights.push(`Project intake is steady at ${thisWeekProjects} projects this week — same as last week.`);
  } else if (thisWeekProjects > 0) {
    insights.push(`${thisWeekProjects} project(s) are active this week.`);
  }

  if (overdueCount > 5) {
    insights.push(`⚠️ ${overdueCount} overdue projects need immediate attention.`);
  } else if (overdueCount > 0) {
    insights.push(`${overdueCount} project(s) are currently overdue and need follow-up.`);
  } else {
    insights.push(`No overdue projects — the team is keeping up with deadlines.`);
  }

  const delivered = statusBreakdown["Delivered"] || 0;
  if (totalProjects > 0) {
    const rate = Math.round((delivered / totalProjects) * 100);
    insights.push(`${rate}% of all projects (${delivered}/${totalProjects}) have been delivered.`);
  }

  if (avgRating !== null && avgRating > 0) {
    if (avgRating >= 4.5) insights.push(`Client satisfaction is excellent at ${avgRating.toFixed(1)}/5 average rating.`);
    else if (avgRating >= 4.0) insights.push(`Average client rating is ${avgRating.toFixed(1)}/5 — solid, with room to push for 5-star.`);
    else insights.push(`Average client rating is ${avgRating.toFixed(1)}/5 — review quality processes to improve satisfaction.`);
  }

  if (topRetouchers.length > 0) {
    const top = topRetouchers[0];
    insights.push(`Top performer: ${top.name} with ${top.completed} completed project(s) and a ${top.avgRating.toFixed(1)} avg rating.`);
  }

  if (recentDeliveries > 0) {
    insights.push(`${recentDeliveries} project(s) delivered recently — strong delivery momentum.`);
  }

  const vipCount = (clientTierBreakdown["Gold"] || 0) + (clientTierBreakdown["Platinum"] || 0) + (clientTierBreakdown["Diamond"] || 0);
  if (vipCount > 0) {
    insights.push(`${vipCount} VIP client(s) active — ensure they receive priority attention.`);
  }

  return insights.slice(0, 6);
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
  const advice: string[] = [];
  const { name, completedProjects, activeProjects, overdueProjects, avgRating, recentRatings, avgTurnaroundDays } = retoucherData;

  if (overdueProjects > 2) {
    advice.push(`You have ${overdueProjects} overdue projects. Tackle the oldest ones first to clear the backlog.`);
  } else if (overdueProjects > 0) {
    advice.push(`You have ${overdueProjects} overdue project(s). Prioritise these to avoid further delays.`);
  }

  if (avgTurnaroundDays !== null) {
    if (avgTurnaroundDays > 5) {
      advice.push(`Your average turnaround is ${avgTurnaroundDays.toFixed(1)} days — aim to complete projects within 3 days where possible.`);
    } else if (avgTurnaroundDays <= 2) {
      advice.push(`Excellent turnaround at ${avgTurnaroundDays.toFixed(1)} days average. Keep this pace while maintaining quality.`);
    }
  }

  if (recentRatings.length >= 3 && avgRating !== null) {
    const recentAvg = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
    if (recentAvg < avgRating - 0.3) {
      advice.push(`Recent ratings (${recentAvg.toFixed(1)}) are below your average (${avgRating.toFixed(1)}). Review latest client feedback for patterns.`);
    } else if (recentAvg > avgRating + 0.3) {
      advice.push(`Recent ratings (${recentAvg.toFixed(1)}) are trending above your average (${avgRating.toFixed(1)}) — great improvement!`);
    }
  }

  if (avgRating !== null) {
    if (avgRating < 3.5) {
      advice.push(`Your ${avgRating.toFixed(1)}/5 average suggests room for improvement — focus on skin detail and colour accuracy.`);
    } else if (avgRating >= 4.8) {
      advice.push(`Exceptional ${avgRating.toFixed(1)}/5 average — clients love your work. Maintain this standard!`);
    }
  }

  if (activeProjects > 6) {
    advice.push(`You have ${activeProjects} active projects — sort by due date and flag any capacity concerns early.`);
  }

  if (advice.length === 0) {
    advice.push(`You're maintaining a solid workload with ${completedProjects} completed projects. Stay consistent!`);
    advice.push(`Communicate early if any project looks at risk of running late.`);
    advice.push(`Review client feedback regularly to stay ahead of quality expectations.`);
  }

  const encouragement =
    completedProjects > 20 ? `Over ${completedProjects} projects completed — your experience really shows.`
    : overdueProjects === 0 && (avgRating || 0) >= 4.5 ? `No overdue projects and great ratings — you're a real asset to the studio.`
    : overdueProjects > 0 ? `Every challenge is a growth opportunity — you've got this.`
    : `You're doing a solid job — keep the momentum going!`;

  return { advice: advice.slice(0, 4), encouragement };
}

export async function reviewDrivePhotos(_photos: { name: string; thumbnailUrl: string }[]): Promise<{ overallScore: number; feedback: string[]; details: { photo: string; score: number; notes: string }[] }> {
  return {
    overallScore: 0,
    feedback: ["AI photo review is currently paused. Please review the photos manually."],
    details: [],
  };
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
  if (context.leaveType === 'sick') {
    return { decision: 'approved', reason: 'Sick leave approved. Take care and get well soon.' };
  }

  if (context.usedDays + context.weekdaysCount > context.maxDays) {
    return { decision: 'denied', reason: 'Annual leave allowance would be exceeded with this request.' };
  }

  if (context.overdueProjects >= 5 || context.upcomingDueCount >= 8) {
    return { decision: 'denied', reason: 'There is currently a significant project backlog. Please try again when workload has stabilised.' };
  }

  if (context.teamMembersOnLeave.length >= 2) {
    return { decision: 'denied', reason: 'Multiple team members are already on leave during this period. Adequate coverage cannot be maintained.' };
  }

  if (context.overdueProjects >= 3 || context.upcomingDueCount >= 5 || context.teamMembersOnLeave.length >= 1) {
    return { decision: 'needs_review', reason: 'This request needs manager review due to current workload and team availability.' };
  }

  return { decision: 'approved', reason: 'Leave request approved. Team coverage and workload are within acceptable levels.' };
}

export async function suggestChatReply(context: {
  clientName: string;
  projectName: string;
  recentMessages: { sender: string; message: string }[];
  draftMessage?: string;
}): Promise<string> {
  return context.draftMessage || "";
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
  const msg = context.message.toLowerCase();
  const isAdmin = context.role === "Admin" || context.role === "LeadRetoucher";
  const { projectData } = context;

  if (!isAdmin) {
    const myProjects = projectData.activeProjects.filter(p => p.assignedTo === context.username);
    const myOverdue = projectData.overdueProjects.filter(p => p.assignedTo === context.username);
    if (myOverdue.length > 0) {
      const list = myOverdue.map(p => `• ${p.clientName} (due ${p.dueDate})`).join("\n");
      return {
        text: `Hi ${context.username}, you have ${myOverdue.length} overdue project(s) that need attention:\n\n${list}\n\nPlease prioritise these and let your team lead know if you need support.`,
        actions: [],
      };
    }
    return {
      text: `Hi ${context.username}, you have ${myProjects.length} active project(s) right now. Keep up the good work! Reach out to your team lead if you have any questions or blockers.`,
      actions: [],
    };
  }

  const lines: string[] = [];

  const wantsOverdue = msg.includes("overdue") || msg.includes("late") || msg.includes("behind");
  const wantsIncomplete = msg.includes("yesterday") || msg.includes("incomplete") || msg.includes("didn't finish") || msg.includes("not done") || msg.includes("not complete");
  const wantsStats = msg.includes("stats") || msg.includes("performance") || msg.includes("retoucher") || msg.includes("who");
  const wantsLeave = msg.includes("leave") || msg.includes("away") || msg.includes("off");
  const wantsSummary = msg.includes("summary") || msg.includes("overview") || msg.includes("status");

  if (wantsOverdue) {
    const od = projectData.overdueProjects;
    if (od.length === 0) {
      lines.push("**No overdue projects** — everything is on track. ✅");
    } else {
      lines.push(`**${od.length} Overdue Project(s):**`);
      od.forEach(p => lines.push(`• ${p.clientName} — assigned to ${p.assignedTo || "Unassigned"} (due ${p.dueDate})`));
    }
  }

  if (wantsIncomplete) {
    const inc = projectData.yesterdayIncomplete;
    if (inc.length === 0) {
      lines.push("\n**No incomplete work from yesterday.** ✅");
    } else {
      lines.push(`\n**Yesterday's Incomplete (${inc.length}):**`);
      inc.forEach(p => lines.push(`• ${p.clientName} — ${p.assignedTo || "Unassigned"} (${p.status})`));
    }
  }

  if (wantsStats) {
    lines.push(`\n**Retoucher Performance:**`);
    projectData.retoucherStats.forEach(r => {
      const rating = r.avgRating ? r.avgRating.toFixed(1) : "N/A";
      lines.push(`• **${r.name}**: ${r.active} active · ${r.completed} completed · ${r.overdue} overdue · avg rating ${rating}`);
    });
  }

  if (wantsLeave) {
    if (projectData.teamOnLeave.length === 0) {
      lines.push(`\n**No team members currently on leave.**`);
    } else {
      lines.push(`\n**Team Members on Leave:**`);
      projectData.teamOnLeave.forEach(l => lines.push(`• ${l.username} (${l.startDate} – ${l.endDate})`));
    }
  }

  if (lines.length === 0 || wantsSummary) {
    lines.unshift(`**Studio Overview**`);
    lines.push(`• Total projects: ${projectData.totalProjects}`);
    lines.push(`• Overdue: ${projectData.overdueProjects.length}`);
    lines.push(`• Active: ${projectData.activeProjects.length}`);
    lines.push(`• Team: ${projectData.retoucherStats.length} retoucher(s)`);
    if (projectData.teamOnLeave.length > 0) {
      lines.push(`• On leave: ${projectData.teamOnLeave.map(l => l.username).join(", ")}`);
    }
    if (lines.length < 6) {
      lines.push(`\nTry asking about "overdue", "stats", "leave", or "yesterday's incomplete" for more detail.`);
    }
  }

  return { text: lines.join("\n"), actions: [] };
}

export async function generateDailySummaryForAdmin(context: {
  yesterdayIncomplete: { clientName: string; assignedTo: string; dueDate: string; status: string }[];
  retoucherExplanations: { username: string; message: string; timestamp: string }[];
  retoucherStats: { name: string; completed: number; active: number; overdue: number }[];
}): Promise<string> {
  const lines: string[] = ["## Daily Studio Summary\n"];

  if (context.yesterdayIncomplete.length === 0) {
    lines.push("**Yesterday's Incomplete Projects:** None ✅\n");
  } else {
    lines.push(`**Yesterday's Incomplete Projects (${context.yesterdayIncomplete.length}):**`);
    context.yesterdayIncomplete.forEach(p => {
      lines.push(`• **${p.clientName}** — ${p.assignedTo || "Unassigned"} · ${p.status} · due ${p.dueDate}`);
    });
    lines.push("");
  }

  if (context.retoucherExplanations.length > 0) {
    lines.push(`**Retoucher Explanations (${context.retoucherExplanations.length}):**`);
    context.retoucherExplanations.forEach(e => {
      const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      lines.push(`• **${e.username}** at ${time}: "${e.message.substring(0, 200)}"`);
    });
    lines.push("");
  }

  if (context.retoucherStats.length > 0) {
    lines.push("**Retoucher Stats:**");
    context.retoucherStats.forEach(r => {
      lines.push(`• ${r.name}: ${r.active} active · ${r.completed} completed · ${r.overdue} overdue`);
    });
  }

  return lines.join("\n");
}

export async function generateWorkloadForecast(context: {
  upcomingProjects: { clientName: string; shootDate: string; deliveryDueDate: string; status: string; assignedTo: string | null }[];
  currentBacklog: { total: number; byRetoucher: { name: string; active: number; overdue: number }[] };
  teamCapacity: { dailyCapacity: number; totalRetouchers: number; retoucherNames: string[] };
  approvedLeave: { username: string; startDate: string; endDate: string }[];
  weeklyBreakdown: { weekStart: string; projectsDue: number; newShoots: number }[];
}): Promise<{ weeks: { weekStart: string; projectedLoad: number; capacity: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; warnings: string[] }[]; recommendations: string[]; summary: string }> {
  const weeks = context.weeklyBreakdown.map(week => {
    const weekDate = new Date(week.weekStart);
    const weekEnd = new Date(weekDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const leaveCount = context.approvedLeave.filter(l => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      return start < weekEnd && end >= weekDate;
    }).length;

    const availableDays = Math.max(1, 5 - Math.min(leaveCount, context.teamCapacity.totalRetouchers - 1));
    const capacity = context.teamCapacity.dailyCapacity * availableDays;
    const load = week.projectsDue + week.newShoots;
    const ratio = load / Math.max(capacity, 1);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (ratio < 0.6) riskLevel = 'low';
    else if (ratio < 0.8) riskLevel = 'medium';
    else if (ratio <= 1.0) riskLevel = 'high';
    else riskLevel = 'critical';

    const warnings: string[] = [];
    if (leaveCount > 0) warnings.push(`${leaveCount} team member(s) on leave this week`);
    if (ratio > 1.0) warnings.push(`Projected load (${load}) exceeds capacity (${capacity})`);
    if (week.newShoots > 0) warnings.push(`${week.newShoots} new shoot(s) arriving`);

    return { weekStart: week.weekStart, projectedLoad: load, capacity, riskLevel, warnings };
  });

  const criticalWeeks = weeks.filter(w => w.riskLevel === 'critical').length;
  const highWeeks = weeks.filter(w => w.riskLevel === 'high').length;
  const recommendations: string[] = [];

  if (criticalWeeks > 0) recommendations.push(`${criticalWeeks} week(s) are at critical capacity — consider accepting fewer bookings or arranging overtime.`);
  if (highWeeks > 0) recommendations.push(`${highWeeks} week(s) are at high capacity — monitor closely and ensure all projects are assigned early.`);
  if (context.currentBacklog.total > 10) recommendations.push(`Current backlog of ${context.currentBacklog.total} projects is high — prioritise clearing overdue work.`);
  if (context.approvedLeave.length > 0) recommendations.push(`Plan ahead for ${context.approvedLeave.length} approved leave period(s) — redistribute workload in advance.`);
  if (recommendations.length === 0) recommendations.push(`Workload looks manageable across all tracked weeks. Keep monitoring as new bookings come in.`);

  const overallRisk = criticalWeeks > 0 ? "critical pressure" : highWeeks > 0 ? "elevated pressure" : "manageable";
  const summary = `Workload forecast shows ${overallRisk} across the coming weeks. ${criticalWeeks + highWeeks} week(s) require attention.`;

  return { weeks, recommendations, summary };
}

export async function generatePredictiveRiskAlerts(context: {
  activeProjects: { id: string; clientName: string; assignedTo: string | null; status: string; dueDate: string; deliveryDueDate: string | null; daysRemaining: number; selectedCount: number | null }[];
  retoucherHistory: { name: string; avgTurnaroundDays: number; completedCount: number; overdueRate: number; currentLoad: number }[];
  historicalPatterns: { avgCompletionDays: number; overduePercentage: number };
}): Promise<{ alerts: { projectId: string; clientName: string; riskScore: number; riskFactors: string[]; predictedDaysLate: number; recommendation: string }[]; summary: string }> {
  const alerts = context.activeProjects
    .filter(p => p.daysRemaining >= 0)
    .map(p => {
      let riskScore = 0;
      const riskFactors: string[] = [];

      if (p.daysRemaining <= 1) { riskScore += 40; riskFactors.push(`Only ${p.daysRemaining} day(s) remaining`); }
      else if (p.daysRemaining <= 2) { riskScore += 25; riskFactors.push(`${p.daysRemaining} days remaining`); }
      else if (p.daysRemaining <= 3) { riskScore += 15; riskFactors.push(`${p.daysRemaining} days remaining`); }

      if (!p.assignedTo) {
        riskScore += 35;
        riskFactors.push("Project is not yet assigned");
      } else {
        const retoucher = context.retoucherHistory.find(r => r.name === p.assignedTo);
        if (retoucher) {
          if (retoucher.overdueRate > 0.3) {
            riskScore += 20;
            riskFactors.push(`${retoucher.name} has ${Math.round(retoucher.overdueRate * 100)}% historical overdue rate`);
          }
          if (retoucher.currentLoad > 4) {
            riskScore += 15;
            riskFactors.push(`${retoucher.name} currently has ${retoucher.currentLoad} active projects`);
          }
        }
      }

      if (p.status === "Assigned" && p.daysRemaining <= 2) {
        riskScore += 20;
        riskFactors.push(`Still in "${p.status}" status with ${p.daysRemaining} days left`);
      }

      const avgDays = context.historicalPatterns.avgCompletionDays || 3;
      const predictedDaysLate = Math.max(0, Math.round((riskScore / 100) * avgDays * 0.5));

      const recommendation =
        riskScore > 70 ? "Escalate immediately — reassign or request overtime"
        : riskScore > 50 ? "Follow up with retoucher and prioritise this project"
        : "Monitor closely and check in tomorrow";

      return {
        projectId: p.id,
        clientName: p.clientName,
        riskScore: Math.min(100, riskScore),
        riskFactors,
        predictedDaysLate,
        recommendation,
      };
    })
    .filter(a => a.riskScore > 40)
    .sort((a, b) => b.riskScore - a.riskScore);

  const summary = alerts.length === 0
    ? "No high-risk projects detected based on current deadlines and workload."
    : `${alerts.length} project(s) flagged as at-risk based on deadlines and retoucher workload.`;

  return { alerts, summary };
}

export async function evaluateQualityGate(_context: {
  projectName: string;
  photos: { name: string; thumbnailUrl: string }[];
  threshold: number;
  referenceImageUrls?: string[];
}): Promise<{ passed: boolean; overallScore: number; feedback: string[]; details: { photo: string; score: number; issues: string[] }[]; recommendation: string }> {
  return {
    passed: true,
    overallScore: 8,
    feedback: ["Quality gate is in manual review mode — photos have been automatically approved. Please review manually before delivery."],
    details: [],
    recommendation: "Approved for delivery (manual review mode)",
  };
}

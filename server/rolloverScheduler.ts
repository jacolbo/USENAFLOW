import { storage } from "./storage";
import { broadcastSSE } from "./routes";
import type { Project } from "@shared/schema";

// Calculate milliseconds until next midnight 00:01
function getMillisecondsUntilNextMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now);
  
  // Check if it's past 00:01 today
  if (now.getHours() > 0 || (now.getHours() === 0 && now.getMinutes() >= 1)) {
    // Past 00:01, schedule for next day
    nextMidnight.setDate(now.getDate() + 1);
  }
  
  // Set time to 00:01:00
  nextMidnight.setHours(0, 1, 0, 0);
  
  return nextMidnight.getTime() - now.getTime();
}

// Get Sunday start of current week
function getCurrentWeekStart(): Date {
  const now = new Date();
  const sunday = new Date(now);
  const day = now.getDay(); // 0 = Sunday
  sunday.setDate(now.getDate() - day); // Go back to Sunday
  sunday.setHours(0, 0, 0, 0); // Set to start of day
  return sunday;
}

// Perform the rollover operation
async function performUnassignedRollover(): Promise<void> {
  console.log('🔄 Starting unassigned project rollover at', new Date().toISOString());
  
  try {
    const currentWeekStart = getCurrentWeekStart();
    const projects = await storage.getAllProjects();
    
    // Find unassigned projects from past weeks
    const unassignedFromPastWeeks = projects.filter((project: Project) => {
      const isUnassigned = !project.assignedTo || project.assignedTo === '__UNASSIGN__';
      const projectWeekStart = new Date(project.dueDate);
      projectWeekStart.setDate(projectWeekStart.getDate() - projectWeekStart.getDay());
      projectWeekStart.setHours(0, 0, 0, 0);
      
      return isUnassigned && projectWeekStart < currentWeekStart;
    });
    
    if (unassignedFromPastWeeks.length === 0) {
      console.log('✅ No unassigned projects to roll over');
      return;
    }
    
    console.log(`📦 Rolling over ${unassignedFromPastWeeks.length} unassigned projects to current week`);
    
    // Update each unassigned project's due date to current Sunday
    for (const project of unassignedFromPastWeeks) {
      const updatedProject = await storage.updateProject(project.id, {
        dueDate: currentWeekStart
      });
      
      if (updatedProject) {
        console.log(`✓ Rolled over project: ${project.clientName} (${project.id})`);
      }
    }
    
    // Broadcast update to all connected clients
    broadcastSSE({
      type: 'rollover_complete',
      payload: {
        rolledOverCount: unassignedFromPastWeeks.length,
        message: `${unassignedFromPastWeeks.length} unassigned projects moved to current week`
      }
    });
    
    console.log('🎉 Rollover complete! Clients notified via SSE');
    
  } catch (error) {
    console.error('❌ Error during rollover:', error);
  }
}

// Schedule the rollover
let rolloverTimeout: NodeJS.Timeout | null = null;

function scheduleRollover(): void {
  // Clear existing timeout
  if (rolloverTimeout) {
    clearTimeout(rolloverTimeout);
  }
  
  const msUntilMidnight = getMillisecondsUntilNextMidnight();
  const nextMidnightDate = new Date(Date.now() + msUntilMidnight);
  
  console.log(`⏰ Scheduling unassigned project rollover for: ${nextMidnightDate.toLocaleString()}`);
  console.log(`⌛ Time until rollover: ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
  
  rolloverTimeout = setTimeout(async () => {
    await performUnassignedRollover();
    // Schedule next rollover (next day)
    scheduleRollover();
  }, msUntilMidnight);
}

// Start the scheduler
export function startRolloverScheduler(): void {
  console.log('🚀 Starting unassigned project rollover scheduler');
  scheduleRollover();
}

// Stop the scheduler (for cleanup)
export function stopRolloverScheduler(): void {
  if (rolloverTimeout) {
    clearTimeout(rolloverTimeout);
    rolloverTimeout = null;
    console.log('🛑 Rollover scheduler stopped');
  }
}

// Manual rollover trigger (for testing)
export async function triggerManualRollover(): Promise<void> {
  console.log('🔧 Manual rollover triggered');
  await performUnassignedRollover();
}
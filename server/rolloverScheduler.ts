import { storage } from "./storage";
import { broadcastSSE } from "./routes";
import type { Project } from "@shared/schema";

// Calculate milliseconds until next Sunday 00:01
function getMillisecondsUntilNextSunday(): number {
  const now = new Date();
  const nextSunday = new Date(now);
  
  // Calculate days until Sunday (0 = Sunday)
  const daysUntilSunday = (7 - now.getDay()) % 7;
  
  if (daysUntilSunday === 0) {
    // If today is Sunday, check if it's past 00:01
    if (now.getHours() > 0 || (now.getHours() === 0 && now.getMinutes() >= 1)) {
      // Past 00:01, schedule for next Sunday
      nextSunday.setDate(now.getDate() + 7);
    }
  } else {
    // Not Sunday, schedule for next Sunday
    nextSunday.setDate(now.getDate() + daysUntilSunday);
  }
  
  // Set time to 00:01:00
  nextSunday.setHours(0, 1, 0, 0);
  
  return nextSunday.getTime() - now.getTime();
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
  
  const msUntilSunday = getMillisecondsUntilNextSunday();
  const nextSundayDate = new Date(Date.now() + msUntilSunday);
  
  console.log(`⏰ Scheduling unassigned project rollover for: ${nextSundayDate.toLocaleString()}`);
  console.log(`⌛ Time until rollover: ${Math.round(msUntilSunday / 1000 / 60)} minutes`);
  
  rolloverTimeout = setTimeout(async () => {
    await performUnassignedRollover();
    // Schedule next rollover (7 days later)
    scheduleRollover();
  }, msUntilSunday);
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
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

// Get next Sunday start
function getNextWeekStart(): Date {
  const now = new Date();
  const nextSunday = new Date(now);
  const day = now.getDay(); // 0 = Sunday
  
  // Calculate days until next Sunday
  const daysUntilNextSunday = (7 - day) % 7;
  if (daysUntilNextSunday === 0) {
    // If today is Sunday, next Sunday is 7 days away
    nextSunday.setDate(now.getDate() + 7);
  } else {
    // Move to next Sunday
    nextSunday.setDate(now.getDate() + daysUntilNextSunday);
  }
  
  nextSunday.setHours(0, 0, 0, 0); // Set to start of day
  return nextSunday;
}

// Perform rollover to next week (manual admin action)
export async function performManualRolloverToNextWeek(): Promise<void> {
  console.log('🔧 Manual rollover to next week triggered');
  
  try {
    const currentWeekStart = getCurrentWeekStart();
    const nextWeekStart = getNextWeekStart();
    const projects = await storage.getAllProjects();
    
    // Find all unassigned projects from current week (Sunday)
    const unassignedFromCurrentWeek = projects.filter((project: Project) => {
      const isUnassigned = !project.assignedTo || project.assignedTo === '__UNASSIGN__';
      const projectWeekStart = new Date(project.dueDate);
      projectWeekStart.setDate(projectWeekStart.getDate() - projectWeekStart.getDay());
      projectWeekStart.setHours(0, 0, 0, 0);
      
      // Only move projects from current week's Sunday
      return isUnassigned && projectWeekStart.getTime() === currentWeekStart.getTime();
    });
    
    if (unassignedFromCurrentWeek.length === 0) {
      console.log('✅ No unassigned projects in current week to roll over to next week');
      return;
    }
    
    console.log(`📦 Rolling over ${unassignedFromCurrentWeek.length} unassigned projects to next week`);
    
    // Update each unassigned project's due date to next Sunday
    for (const project of unassignedFromCurrentWeek) {
      const updatedProject = await storage.updateProject(project.id, {
        dueDate: nextWeekStart
      });
      
      if (updatedProject) {
        console.log(`✓ Rolled over project to next week: ${project.clientName} (${project.id})`);
      }
    }
    
    // Broadcast update to all connected clients
    broadcastSSE({
      type: 'rollover_complete',
      payload: {
        rolledOverCount: unassignedFromCurrentWeek.length,
        message: `${unassignedFromCurrentWeek.length} unassigned projects moved to next week`
      }
    });
    
    console.log('🎉 Manual rollover to next week complete! Clients notified via SSE');
    
  } catch (error) {
    console.error('❌ Error during manual rollover to next week:', error);
    throw error;
  }
}

// Perform rollback from next week (manual admin action)
export async function performManualRollbackFromNextWeek(): Promise<void> {
  console.log('🔄 Manual rollback from next week triggered');
  
  try {
    const currentWeekStart = getCurrentWeekStart();
    const nextWeekStart = getNextWeekStart();
    const projects = await storage.getAllProjects();
    
    // Find all unassigned projects from next week (Sunday)
    const unassignedFromNextWeek = projects.filter((project: Project) => {
      const isUnassigned = !project.assignedTo || project.assignedTo === '__UNASSIGN__';
      const projectWeekStart = new Date(project.dueDate);
      projectWeekStart.setDate(projectWeekStart.getDate() - projectWeekStart.getDay());
      projectWeekStart.setHours(0, 0, 0, 0);
      
      // Only move projects from next week's Sunday
      return isUnassigned && projectWeekStart.getTime() === nextWeekStart.getTime();
    });
    
    if (unassignedFromNextWeek.length === 0) {
      console.log('✅ No unassigned projects in next week to roll back to current week');
      return;
    }
    
    console.log(`📦 Rolling back ${unassignedFromNextWeek.length} unassigned projects to current week`);
    
    // Update each unassigned project's due date to current Sunday
    for (const project of unassignedFromNextWeek) {
      const updatedProject = await storage.updateProject(project.id, {
        dueDate: currentWeekStart
      });
      
      if (updatedProject) {
        console.log(`✓ Rolled back project to current week: ${project.clientName} (${project.id})`);
      }
    }
    
    // Broadcast update to all connected clients
    broadcastSSE({
      type: 'rollover_complete',
      payload: {
        rolledOverCount: unassignedFromNextWeek.length,
        message: `${unassignedFromNextWeek.length} unassigned projects moved back to current week`
      }
    });
    
    console.log('🎉 Manual rollback from next week complete! Clients notified via SSE');
    
  } catch (error) {
    console.error('❌ Error during manual rollback from next week:', error);
    throw error;
  }
}

// Manual rollover trigger (for testing - moves to current week)
export async function triggerManualRollover(): Promise<void> {
  console.log('🔧 Manual rollover triggered');
  await performUnassignedRollover();
}
import { syncCalendarToProjects, updateAllRiskLevels } from './services/calendarSync';

let syncInterval: NodeJS.Timeout | null = null;
let riskInterval: NodeJS.Timeout | null = null;

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const RISK_UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startCalendarScheduler(): void {
  console.log('📅 Starting ShootTracker calendar scheduler');
  
  // Initial sync on startup (with delay to let server fully initialize)
  setTimeout(async () => {
    try {
      console.log('📅 Running initial calendar sync...');
      await syncCalendarToProjects();
    } catch (error) {
      console.error('📅 Initial calendar sync failed:', error);
    }
  }, 10000); // 10 second delay
  
  // Set up periodic calendar sync
  syncInterval = setInterval(async () => {
    try {
      console.log('📅 Running scheduled calendar sync...');
      await syncCalendarToProjects();
    } catch (error) {
      console.error('📅 Scheduled calendar sync failed:', error);
    }
  }, SYNC_INTERVAL_MS);
  
  // Set up periodic risk level updates
  riskInterval = setInterval(async () => {
    try {
      console.log('📊 Updating project risk levels...');
      await updateAllRiskLevels();
    } catch (error) {
      console.error('📊 Risk level update failed:', error);
    }
  }, RISK_UPDATE_INTERVAL_MS);
  
  console.log(`📅 Calendar sync scheduled every ${SYNC_INTERVAL_MS / 60000} minutes`);
  console.log(`📊 Risk updates scheduled every ${RISK_UPDATE_INTERVAL_MS / 60000} minutes`);
}

export function stopCalendarScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('📅 Calendar sync scheduler stopped');
  }
  
  if (riskInterval) {
    clearInterval(riskInterval);
    riskInterval = null;
    console.log('📊 Risk update scheduler stopped');
  }
}

export async function triggerManualCalendarSync(calendarId?: string, turnaroundDays?: number): Promise<void> {
  console.log('📅 Manual calendar sync triggered');
  await syncCalendarToProjects(calendarId, turnaroundDays);
}

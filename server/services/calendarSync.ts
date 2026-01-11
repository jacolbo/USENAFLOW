import { storage } from '../storage';
import { fetchCalendarEvents, parseClientNameFromEvent, calculateDeliveryDueDate, CalendarEvent } from './googleCalendar';
import { calculateRiskLevel } from './riskCalculator';
import { ProjectStatus, RiskLevel } from '@shared/schema';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function syncCalendarToProjects(
  calendarId: string = 'primary',
  turnaroundDays: number = 14
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('🔄 Starting calendar sync...');
    
    // Fetch calendar events for the next 90 days
    const events = await fetchCalendarEvents(calendarId);
    console.log(`📅 Found ${events.length} calendar events`);
    
    // Get existing projects to match against
    const existingProjects = await storage.getAllProjects();
    const projectsByEventId = new Map(
      existingProjects
        .filter(p => p.calendarEventId)
        .map(p => [p.calendarEventId, p])
    );
    
    for (const event of events) {
      try {
        // Skip events without proper start date
        if (!event.start || isNaN(event.start.getTime())) {
          result.skipped++;
          continue;
        }
        
        // Check if this event is already linked to a project
        const existingProject = projectsByEventId.get(event.id);
        
        if (existingProject) {
          // Update existing project
          const shootDate = event.start;
          const deliveryDueDate = calculateDeliveryDueDate(shootDate, turnaroundDays);
          const riskLevel = calculateRiskLevel({
            ...existingProject,
            shootDate,
            deliveryDueDate,
          });
          
          await storage.updateProject(existingProject.id, {
            shootDate,
            deliveryDueDate,
            riskLevel,
            lastSyncedAt: new Date(),
          });
          
          result.updated++;
        } else {
          // Parse client name from event
          const clientName = parseClientNameFromEvent(event);
          
          if (!clientName) {
            result.skipped++;
            continue;
          }
          
          // Check if a project with this client name already exists for similar date
          const existingByName = existingProjects.find(p => {
            if (p.clientName.toLowerCase() !== clientName.toLowerCase()) return false;
            if (!p.shootDate) return false;
            
            // Check if shoot dates are within 2 days of each other
            const dayDiff = Math.abs(
              (new Date(p.shootDate).getTime() - event.start.getTime()) / (1000 * 60 * 60 * 24)
            );
            return dayDiff < 2;
          });
          
          if (existingByName) {
            // Link existing project to this calendar event
            const shootDate = event.start;
            const deliveryDueDate = calculateDeliveryDueDate(shootDate, turnaroundDays);
            
            await storage.updateProject(existingByName.id, {
              calendarEventId: event.id,
              shootDate,
              deliveryDueDate,
              lastSyncedAt: new Date(),
            });
            
            result.updated++;
          } else {
            // Create new project from calendar event
            const shootDate = event.start;
            const deliveryDueDate = calculateDeliveryDueDate(shootDate, turnaroundDays);
            
            // Get Sunday of the shoot week for due date
            const sundayOfWeek = new Date(shootDate);
            sundayOfWeek.setDate(sundayOfWeek.getDate() - sundayOfWeek.getDay());
            sundayOfWeek.setHours(0, 0, 0, 0);
            
            // Calculate initial risk level
            const riskLevel = calculateRiskLevel({
              deliveryDueDate,
              status: 'Ready for Retouching',
              assignedTo: null,
              rolloverCount: 0,
            });
            
            // Create project with all required fields including ShootTracker data
            const newProject = await storage.createProject({
              clientName,
              packageCount: 0, // To be filled in later
              selectedCount: 0, // To be filled in later
              dueDate: sundayOfWeek,
              assignedTo: null,
              shootDate,
              deliveryDueDate,
              riskLevel,
              calendarEventId: event.id,
              lastSyncedAt: new Date(),
              createdFrom: "CALENDAR",
            });
            
            result.created++;
          }
        }
      } catch (eventError: any) {
        result.errors.push(`Event ${event.id}: ${eventError.message}`);
      }
    }
    
    console.log(`✅ Calendar sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
    
    // Update risk levels for all projects
    await updateAllRiskLevels();
    
  } catch (error: any) {
    console.error('❌ Calendar sync failed:', error);
    result.errors.push(`Sync failed: ${error.message}`);
  }
  
  return result;
}

export async function updateAllRiskLevels(): Promise<number> {
  console.log('📊 Updating risk levels for all projects...');
  
  const projects = await storage.getAllProjects();
  let updated = 0;
  
  for (const project of projects) {
    // Skip completed projects
    if (project.status === ProjectStatus.DELIVERED || project.status === ProjectStatus.DONE) {
      continue;
    }
    
    const newRiskLevel = calculateRiskLevel(project);
    
    if (project.riskLevel !== newRiskLevel) {
      await storage.updateProject(project.id, {
        riskLevel: newRiskLevel,
      });
      updated++;
    }
  }
  
  console.log(`📊 Updated risk levels for ${updated} projects`);
  return updated;
}

export async function getUpcomingShoots(daysAhead: number = 14): Promise<any[]> {
  const projects = await storage.getAllProjects();
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return projects
    .filter(project => {
      if (!project.shootDate) return false;
      const shootDate = new Date(project.shootDate);
      return shootDate >= now && shootDate <= futureDate;
    })
    .sort((a, b) => {
      return new Date(a.shootDate!).getTime() - new Date(b.shootDate!).getTime();
    })
    .map(project => ({
      ...project,
      riskLevel: calculateRiskLevel(project),
      daysUntilShoot: Math.ceil(
        (new Date(project.shootDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
}

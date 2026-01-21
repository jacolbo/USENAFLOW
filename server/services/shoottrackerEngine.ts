import { CalendarEvent } from './googleCalendar';
import { ShoottrackerSettings, RiskLevel, RiskLevelType, KeywordTurnaroundRule, Holiday } from '@shared/schema';

function isDateInHolidayRange(dateStr: string, holidays: Holiday[]): boolean {
  for (const holiday of holidays) {
    if (dateStr >= holiday.start_date && dateStr <= holiday.end_date) {
      return true;
    }
  }
  return false;
}

export interface TurnaroundResult {
  turnaroundDays: number;
  matchedRule: string | null;
}

export function resolveTurnaroundDays(
  eventTitle: string,
  settings: ShoottrackerSettings
): TurnaroundResult {
  const titleUpper = eventTitle.toUpperCase();
  
  for (const rule of settings.keyword_turnaround_rules || []) {
    for (const keyword of rule.keywords) {
      if (titleUpper.includes(keyword.toUpperCase())) {
        return {
          turnaroundDays: rule.turnaround_days,
          matchedRule: rule.name,
        };
      }
    }
  }
  
  return {
    turnaroundDays: settings.turnaround_days,
    matchedRule: null,
  };
}

export interface NormalizedEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  rawPayload: any;
}

export interface ClassifiedEvent {
  event: NormalizedEvent;
  classification: 'DONE' | 'UPCOMING';
  deliveryDueDate: Date;
}

export function normalizeEvent(event: CalendarEvent): NormalizedEvent {
  return {
    id: event.id,
    title: (event.summary || '').trim(),
    description: (event.description || '').trim(),
    location: (event.location || '').trim(),
    start: new Date(event.start),
    end: new Date(event.end),
    rawPayload: event,
  };
}

// Cutoff date: ignore all shoots before October 1, 2025
const SYNC_CUTOFF_DATE = new Date('2025-10-01T00:00:00');

export function shouldExclude(event: NormalizedEvent, keywords: string[]): boolean {
  // Exclude events before October 1, 2025
  if (event.start < SYNC_CUTOFF_DATE) {
    return true;
  }
  
  const searchText = `${event.title} ${event.description} ${event.location}`.toLowerCase();
  
  for (const keyword of keywords) {
    if (searchText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function classifyEvent(event: NormalizedEvent, now: Date = new Date()): 'DONE' | 'UPCOMING' {
  return event.start <= now ? 'DONE' : 'UPCOMING';
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function addBusinessDays(
  startDate: Date,
  turnaroundDays: number,
  workingDays: string[],
  holidays: Holiday[],
  timezone: string = 'Africa/Johannesburg'
): Date {
  const workingDaySet = new Set(workingDays.map(d => d.toUpperCase()));
  
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < turnaroundDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    const dayName = DAY_NAMES[currentDate.getDay()];
    const dateStr = formatDateYMD(currentDate);
    
    if (workingDaySet.has(dayName) && !isDateInHolidayRange(dateStr, holidays)) {
      daysAdded++;
    }
  }
  
  return currentDate;
}

export function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function countWorkingDaysBetween(
  startDate: Date,
  endDate: Date,
  workingDays: string[],
  holidays: Holiday[]
): number {
  const workingDaySet = new Set(workingDays.map(d => d.toUpperCase()));
  
  let count = 0;
  const current = new Date(startDate);
  current.setDate(current.getDate() + 1);
  
  while (current <= endDate) {
    const dayName = DAY_NAMES[current.getDay()];
    const dateStr = formatDateYMD(current);
    
    if (workingDaySet.has(dayName) && !isDateInHolidayRange(dateStr, holidays)) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

export function calculateShootTrackerRiskLevel(
  deliveryDueDate: Date,
  delivered: boolean,
  workingDays: string[],
  holidays: Holiday[],
  now: Date = new Date()
): RiskLevelType {
  if (delivered) {
    return RiskLevel.SAFE;
  }
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(deliveryDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  if (today > dueDate) {
    return RiskLevel.OVERDUE;
  }
  
  const workingDaysUntilDue = countWorkingDaysBetween(today, dueDate, workingDays, holidays);
  
  if (workingDaysUntilDue <= 2) {
    return RiskLevel.AT_RISK;
  }
  
  return RiskLevel.SAFE;
}

// Extract email from calendar event description or location
export function extractClientEmail(description: string, location: string = ''): string | null {
  const combined = `${description} ${location}`;
  if (!combined.trim()) return null;
  
  // Common email patterns in calendar notes
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = combined.match(emailPattern);
  
  if (matches && matches.length > 0) {
    // Return the first email found (lowercase)
    return matches[0].toLowerCase();
  }
  
  return null;
}

export function parseClientNameFromTitle(title: string): string {
  let cleanName = title.trim();
  
  const patterns = [
    /^(.+?)\s*[-–—]\s*(shoot|session|portrait|wedding|event|photo)/i,
    /^(shoot|session|client|booking)[:]\s*(.+)/i,
    /^(.+?)\s+(shoot|session|portrait|wedding|event|photo)/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleanName.match(pattern);
    if (match) {
      return (match[1] || match[2] || '').trim();
    }
  }
  
  return cleanName || 'Unknown Client';
}

export interface SyncStats {
  fetched: number;
  excluded: number;
  done: number;
  upcoming: number;
  created: number;
  updated: number;
  errors: string[];
}

export function createEmptySyncStats(): SyncStats {
  return {
    fetched: 0,
    excluded: 0,
    done: 0,
    upcoming: 0,
    created: 0,
    updated: 0,
    errors: [],
  };
}

export interface ForecastResult {
  targetDate: string;
  projects_due_before_target: number;
  available_capacity_before_target: number;
  feasible: boolean;
  at_risk_projects: Array<{
    id: string;
    client_name: string;
    delivery_due_date: string;
    risk_level: RiskLevelType;
  }>;
}
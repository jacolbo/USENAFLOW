import { CalendarEvent } from './googleCalendar';
import { ShoottrackerSettings, RiskLevel, RiskLevelType } from '@shared/schema';

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

export function shouldExclude(event: NormalizedEvent, keywords: string[]): boolean {
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
  holidays: string[],
  timezone: string = 'Africa/Johannesburg'
): Date {
  const workingDaySet = new Set(workingDays.map(d => d.toUpperCase()));
  const holidaySet = new Set(holidays);
  
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < turnaroundDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    const dayName = DAY_NAMES[currentDate.getDay()];
    const dateStr = formatDateYMD(currentDate);
    
    if (workingDaySet.has(dayName) && !holidaySet.has(dateStr)) {
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
  holidays: string[]
): number {
  const workingDaySet = new Set(workingDays.map(d => d.toUpperCase()));
  const holidaySet = new Set(holidays);
  
  let count = 0;
  const current = new Date(startDate);
  current.setDate(current.getDate() + 1);
  
  while (current <= endDate) {
    const dayName = DAY_NAMES[current.getDay()];
    const dateStr = formatDateYMD(current);
    
    if (workingDaySet.has(dayName) && !holidaySet.has(dateStr)) {
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
  holidays: string[],
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
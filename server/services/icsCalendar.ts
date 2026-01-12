import ICAL from "ical.js";

export interface ICSEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  uid: string;
}

export async function fetchICSCalendar(icsUrl: string): Promise<ICSEvent[]> {
  if (!icsUrl || icsUrl.trim() === "") {
    return [];
  }

  try {
    const response = await fetch(icsUrl, {
      headers: {
        "User-Agent": "USENA-FLOW-ShootTracker/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    const icsData = await response.text();
    return parseICSData(icsData);
  } catch (error: any) {
    console.error("Error fetching ICS calendar:", error);
    throw new Error(`Calendar fetch failed: ${error.message}`);
  }
}

export function parseICSData(icsData: string): ICSEvent[] {
  const events: ICSEvent[] = [];

  try {
    const jcalData = ICAL.parse(icsData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);
        
        const startDate = event.startDate?.toJSDate();
        const endDate = event.endDate?.toJSDate();
        
        if (!startDate) {
          continue;
        }

        const icsEvent: ICSEvent = {
          id: event.uid || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uid: event.uid || "",
          summary: event.summary || "Untitled Event",
          description: event.description || undefined,
          start: startDate,
          end: endDate || startDate,
          location: event.location || undefined,
        };

        events.push(icsEvent);
      } catch (eventError) {
        console.warn("Failed to parse individual event:", eventError);
      }
    }

    console.log(`📅 ICS Parser: Successfully parsed ${events.length} events`);
    return events;
  } catch (error: any) {
    console.error("Error parsing ICS data:", error);
    throw new Error(`Calendar parsing failed: ${error.message}`);
  }
}

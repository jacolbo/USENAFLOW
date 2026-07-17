import { EventEmitter } from "events";
import type { Project } from "@shared/schema";

/**
 * Typed event bus for the Noël Set 2026 Campaign Pipeline.
 *
 * Seven canonical events (do not rename without updating all consumers):
 *
 *  project.created      — ShootTracker promoted a Noël-tagged calendar event to a project
 *  project.shootDone    — Shoot physically completed; reserved for future shoot-status trigger
 *  project.countEntered — DataWrangler saved the selected-photo count for a campaign project
 *  project.dateChanged  — Admin/Lead changed the promised delivery date for a campaign project
 *  project.moved        — Alias fired alongside dateChanged; consumers may listen to either
 *  project.driveComplete— Drive monitor auto-detected full delivery for a campaign project
 *  project.delivered    — The delivery chain completed (status flipped to Delivered)
 */
export interface CampaignEvents {
  "project.created":      { project: Project; campaignId: string };
  "project.shootDone":    { project: Project; campaignId: string };
  "project.countEntered": { projectId: string; campaignId: string; photoCount: number };
  "project.dateChanged":  { projectId: string; campaignId: string; newDate: Date; oldDate: Date; slipDays: number };
  "project.moved":        { projectId: string; campaignId: string; newDate: Date; oldDate: Date; slipDays: number };
  "project.driveComplete":{ projectId: string; campaignId: string };
  "project.delivered":    { projectId: string; campaignId: string };
  "pacing.warning":       { campaignId: string; message: string };
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof CampaignEvents>(event: K, payload: CampaignEvents[K]): boolean {
    return super.emit(event as string, payload);
  }
  on<K extends keyof CampaignEvents>(event: K, listener: (payload: CampaignEvents[K]) => void): this {
    return super.on(event as string, listener);
  }
  once<K extends keyof CampaignEvents>(event: K, listener: (payload: CampaignEvents[K]) => void): this {
    return super.once(event as string, listener);
  }
  off<K extends keyof CampaignEvents>(event: K, listener: (payload: CampaignEvents[K]) => void): this {
    return super.removeListener(event as string, listener);
  }
}

export const campaignBus = new TypedEventEmitter();
campaignBus.setMaxListeners(40);

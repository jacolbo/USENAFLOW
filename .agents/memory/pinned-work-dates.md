---
name: Pinned work dates (Noël campaign)
description: Manual calendar-grid moves pin the work day so the auto-scheduler can't overwrite them
---
- Manual work-day moves (calendar chip click or drag-drop → PATCH `/api/campaign/projects/:id/move`) set `workDatePinned=true`.
- The auto-scheduler (`scheduleCampaignWorkDates`) skips pinned projects but counts their photo load against that day's capacity.
- **Why:** the scheduler re-plans all pending projects on every `project.moved` event; without the pin it silently snapped manually moved chips back.
- **How to apply:** any new code path that changes `plannedWorkDate` on behalf of the *user* should set the pin; automated rescheduling must respect it. Delivery-date reschedules (`/reschedule`) are a separate, client-facing flow.
- Calendar grid chips are placed by `plannedWorkDate`; the "Move Delivery Date" dialog changes `promisedDeliveryDate` — don't wire chip clicks to it (that was the original "chips don't move" bug).

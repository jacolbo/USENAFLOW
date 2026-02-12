# USENA FLOW by Jepson Myles Studio

## Overview

USENA FLOW is a full-stack photography workflow management application designed for Jepson Myles Studio. It streamlines project management from client submission to delivery, offering role-based access control, comprehensive project status tracking, and an intuitive dashboard. The application aims to enhance efficiency, reduce manual overhead, and provide a clear overview of project statuses across various user roles, including Sales/Admin, Lead Retoucher, Data Wrangler, and individual retouchers. The business vision is to improve operational efficiency and provide clear oversight of project lifecycles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Design
The application uses React 18 with TypeScript and Vite, employing `shadcn/ui` (built on Radix UI) and Tailwind CSS for a responsive, mobile-first design. It supports light/dark mode theming and features color-coded visual indicators, sortable data tables, week-based project organization, and integrated charts for analytics.

### Technical Implementation
The backend is built with Node.js and Express.js (TypeScript), utilizing a RESTful API with structured error handling. PostgreSQL with Drizzle ORM (via Neon Database) serves as the database, and Zod schemas are used for data validation. Authentication is role-based, supporting seven distinct user roles with cross-device login and admin-controlled team management. The frontend manages state with TanStack Query and uses Wouter for routing and React Hook Form with Zod for form management.

Key features include:
- **Project Workflow**: Five-stage status tracking (Awaiting Payment → Ready → Assigned → Review → Delivered), project assignment, quality rating, and automated due date calculation.
- **Real-time Communication**: WebSocket integration for live updates and smart notifications.
- **Notes System**: Supports text and image notes with role-based access.
- **Automated Calculations**: Calculates "extras" based on photo count.
- **ShootTracker Engine**: Integrates Google Calendar for automated project creation, delivery due date calculation, risk assessment, and idempotent sync. It includes configurable settings for turnaround times, working days, and daily capacity, with automatic sync capabilities.
- **Client-Editor Communication**: A WhatsApp-style messaging interface allows direct communication between editors and clients, featuring threading, unread message counters, email notifications, and token-based client authentication. Includes automated comfort features: after-hours auto-reply (outside Mon-Fri 9AM-4PM), 30-minute delayed acknowledgment for unanswered messages, seen/read indicators, project status auto-messages in chat, and estimated response time display.
- **Customizable Dashboard**: A widget system allows users to configure and reorder dashboard elements with persistent preferences stored per user.
- **Persistent User Management**: User accounts and roles are stored in the database, including admin-controlled user creation and management.
- **Gallery Link Delivery**: Facilitates retouchers adding gallery links and Sales approving delivery, triggering branded client emails and updating project status.
- **Sneak Peek Feature**: Allows retouchers to send preview photos to clients before full delivery via branded emails.
- **Satisfaction Survey System**: Triggers post-delivery surveys, prompting clients with high ratings for Google reviews.
- **Referral Rewards System**: Clients receive referral codes for bonus photos. Referred clients enter name and email on the landing page. Auto-matching uses email as primary key (falling back to name), with 5 bonus photos credited on match.
- **VIP Client Tiers**: Automated loyalty program based on project count, offering bonus photos and priority services, with an admin override.
- **Independent Rewards System**: Standalone rewards engine that pulls historical booking data directly from Google Calendar (up to 2 years back), combines it with referral match counts, and calculates reward scores/tiers per client (Bronze/Silver/Gold/Platinum/Diamond). Completely independent from ShootTracker -- has its own calendar sync, dashboard, and API routes. Scoring: 1 point per booking + 2 points per matched referral.
- **Editable Email Templates**: Admin can customize all 11 email templates (subject and body) via a built-in editor with live preview and variable placeholders. Templates are stored in the database with fallback to defaults.
- **Automated Notifications**: Includes client scheduling notifications upon project due date updates and a Data Wrangler delay alert system for unassigned projects.
- **Interactive Calendar**: Supports drag-and-drop project movement, quick assignment via double-click, real-time search, and color-coded project display based on status and rollover history.
- **Google Drive Integration**: Automated photo delivery system that creates organized client folders `ClientName(photoCount)` with "Black and White" subfolders, monitors uploads every 5 minutes, auto-detects delivery completion when photo counts match selectedCount, generates shareable gallery links, and sends branded delivery emails. Includes B&W preview detection and email, storage tracking per project, and client access monitoring. Drive folders are auto-created on project creation (manual and ShootTracker promotion). All Drive API routes are admin-protected. Services: `googleDriveService.ts` (core Drive operations), `driveMonitorService.ts` (periodic scanning and auto-delivery), `drive-manager.tsx` (dashboard UI).
- **Chat Archiving**: Team can archive client chats when projects are done. Active/Archived toggle tabs in chat sidebar, archive/unarchive buttons per chat. Archived chats move to a separate section and can be restored.
- **Project Speed Tracking**: Background system recording timestamps at each project status transition (`project_status_transitions` table). Calculates turnaround times per project and per retoucher. API at `/api/speed-stats` for admin. Data used by AI for performance analysis.
- **Leave Management System**: 15 weekday annual leave per year, no rollover. Leave request form with date range, reason, and type (annual/sick/personal). AI-powered approval: sick leave always approved; non-sick leave denied during heavy backlog or when too many team members already on leave. Admin can override AI decisions. Remaining leave days intentionally hidden from UI. Page at `/leave`.
- **AI Team Chat System**: Two-way AI chat (`/ai-chat`) where admin can ask AI about incomplete work, team performance, and who hasn't finished their projects. Retouchers can talk to AI to explain delays — AI acknowledges and forwards explanations to admin. AI uses project data, speed stats, team availability, and the studio's retouching guidelines in all conversations. Admin has a "Daily Summary" button for consolidated reports. Messages stored in `ai_team_messages` table.
- **Retouching Guidelines Policy**: Studio retouching guidelines stored in `app_settings` table, referenced by AI in team communications to ensure quality standards are maintained.
- **AI-Powered Features** (via OpenAI/Replit AI Integrations, `server/services/aiService.ts`):
  - **Email Text Variation**: Each outgoing client email is rephrased by AI (gpt-4o-mini) before sending so every client receives uniquely worded messages while preserving meaning, links, variables, and proper nouns. Applied to 10 email types. Falls back to original on error.
  - **Smart Insights Widget** (`ai_insights`): Dashboard widget for Admin, Lead Retoucher, Data Wrangler, Sales. Aggregates project data and generates 4-6 AI-powered trend observations via `/api/ai/insights`. 5-minute cache, manual refresh.
  - **AI Retoucher Coach** (`retoucher_coach`): Dashboard widget for Retoucher1/2/3 roles. Analyzes individual performance (completed projects, ratings, turnaround times, overdue count) and generates personalized tips and encouragement via `/api/ai/retoucher-advice/:name`. 10-minute cache.
  - **AI Photo Review**: In Drive Manager, admins can trigger AI vision analysis (gpt-4o) on project photos. Samples up to 6 thumbnails from the Drive folder and evaluates skin retouching, hair detail, color correction, exposure, and composition. Returns per-photo scores and feedback via `/api/ai/review-photos`.
  - **Chat Reply Assistant**: In the editor chat interface, a magic wand button lets users get AI-suggested replies or polish their draft messages before sending. Uses conversation context (last 5 messages) via `/api/ai/suggest-reply`.
  - **Workload Forecast** (`workload_forecast`): Dashboard widget for Admin/Lead Retoucher. AI analyzes upcoming projects, team capacity, current backlog, and approved leave to generate a 4-6 week capacity forecast. Shows weekly load bars with risk levels (low/medium/high/critical), warnings for capacity crunches, and actionable recommendations. API at `/api/ai/workload-forecast`. 5-minute cache.
  - **Predictive Risk Alerts** (`predictive_risk`): Dashboard widget for Admin/Lead Retoucher. AI analyzes active projects against retoucher performance history (speed stats, overdue rates, current workload) to predict which projects are likely to go overdue BEFORE they miss their deadlines. Shows risk scores (%), predicted days late, risk factors, and recommendations. API at `/api/ai/predictive-risk`. 5-minute cache.
  - **Quality Gate**: Mandatory AI photo review before delivery. When a project is in Review status with a Drive folder, Admin/Lead Retoucher can trigger an AI quality check (gpt-4o vision, threshold score 7/10). If photos fail, delivery is blocked until quality improves or Admin overrides. Quality gate status (passed/failed/override) shown on project cards with score badges. Schema fields: `qualityGateScore`, `qualityGatePassed`, `qualityGateOverride` on projects table. APIs at `/api/ai/quality-gate` and `/api/ai/quality-gate/override`. Configurable via `quality_gate_settings` app setting.
- **Client Chat PWA**: The client chat page (`/client-chat/:token`) is a Progressive Web App with:
  - **Install Prompt**: Optional, dismissible "Add to Home Screen" banner. Clients can install the chat as a standalone app on their phone or ignore it.
  - **Push Notifications**: When a retoucher sends a message, the client receives a phone notification (if they granted permission). Uses Web Push API with VAPID keys. Subscriptions stored in `push_subscriptions` table. Expired subscriptions auto-cleaned.
  - **Service Worker**: `client/public/sw.js` handles push events and notification clicks, opening the chat directly.
  - **Manifest**: `client/public/manifest.json` with Jepson Myles branding, standalone display mode.

## External Dependencies

- **@tanstack/react-query**: Server state management.
- **wouter**: Client-side routing.
- **react-hook-form**: Form management.
- **drizzle-orm**: ORM for PostgreSQL.
- **@neondatabase/serverless**: Serverless PostgreSQL client.
- **zod**: Schema validation.
- **vite**: Build tool.
- **typescript**: Programming language.
- **date-fns**: Date utility library.
- **connect-pg-simple**: PostgreSQL session store.
- **@radix-ui/***: UI component primitives.
- **lucide-react**: Icon library.
- **tailwind-merge**: Utility for merging Tailwind CSS classes.
- **clsx**: Utility for conditionally joining class names.
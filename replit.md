# USENA FLOW by Jepson Myles Studio

## Overview

USENA FLOW is a full-stack photography workflow management application designed for Jepson Myles Studio. Its primary purpose is to streamline project management from client submission to delivery, offering features like role-based access control, comprehensive project status tracking, and an intuitive dashboard interface. The application supports various user roles, including Sales/Admin, Lead Retoucher, Data Wrangler, and individual retouchers, each with specific permissions tailored to their workflow responsibilities. The business vision is to enhance efficiency in photography project management, reduce manual overhead, and provide a clear overview of project statuses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Design
- **Framework**: React 18 with TypeScript.
- **Build Tool**: Vite.
- **UI Library**: shadcn/ui (built on Radix UI primitives).
- **Styling**: Tailwind CSS with a custom design system and CSS variables.
- **Responsive Design**: Mobile-first approach.
- **Theming**: CSS custom properties with light/dark mode support.
- **Visual Indicators**: Color-coded badges for project status.
- **Interactive Tables**: Sortable and filterable data tables.
- **Project Views**: Week-based organization (current, previous, next week) and an archive system for older projects.
- **Analytics Visualization**: Integrated charts (e.g., line chart for photos delivered) for key performance indicators.

### Technical Implementation
- **Backend**: Node.js with Express.js (TypeScript, ES modules).
- **API Design**: RESTful API with structured error handling.
- **Database**: PostgreSQL with Drizzle ORM (using Neon Database serverless PostgreSQL).
- **Data Validation**: Zod schemas for runtime type checking and API validation.
- **Authentication**: Role-based access control with seven distinct user roles, cross-device login, and admin-controlled team management.
- **State Management**: TanStack Query for server state management in the frontend.
- **Routing**: Wouter for client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **Data Persistence**: All user data persists across deployments.
- **Real-time Communication**: WebSocket integration for live project updates and smart notifications (including browser notifications and custom sounds).
- **Project Workflow**: Five-stage status tracking (Awaiting Payment → Ready → Assigned → Review → Delivered), project assignment, quality rating, and automatic due date calculation.
- **Notes System**: Support for text and image notes with role-based access.
- **Automated Calculations**: Automatic calculation of "extras" based on selected photo count.
- **Project Duplication**: One-click project duplication.
- **Team Analytics**: Integrated team performance analytics on the dashboard.
- **Daily Inspiration**: Deterministic daily quotes displayed on the dashboard.
- **Admin Capabilities**: Admin users can function as both administrators and retouchers.
- **Calendar Logic**: Sunday-start weeks for consistent scheduling.
- **Unassigned Project Handling**: Unassigned projects automatically roll over to the next week and are prioritized.
- **Drag & Drop**: Projects can be moved between days within a week by clicking and dragging project badges.
- **Quick Assignment**: Double-click any project badge to open assignment options without leaving the calendar view.
- **Client Search**: Real-time search functionality for each week to filter projects by client name or assigned retoucher.
- **Assignment Ratio Display**: Week headers show assigned vs total project counts (e.g., "5/48 projects") with green for assigned and red for total.
- **Color-Coded Calendar**: Projects display with color rules - EC (black), ASA (purple), LM (blue), AP (pink) override rollover colors; rollover projects show green (rolled over once) or red (rolled over twice+); new projects show green.

### ShootTracker Engine Module
The ShootTracker Engine integrates Google Calendar to automatically create and manage projects:
- **Google Calendar Sync**: Fetches events from selected calendars using Replit's Google Calendar connector
- **Event Filtering**: Excludes non-shoot events based on configurable keywords (FULL DAY, BLOCK, HOLD, CANCEL, NO SHOW)
- **Event Classification**: Categorizes events as DONE (past) or UPCOMING (future)
- **Business Day Calculations**: Computes delivery due dates using configurable turnaround days, working days, and holidays
- **Risk Level System**: Three-level risk assessment (SAFE/AT_RISK/OVERDUE) based on delivery due date proximity
- **Idempotent Sync**: Calendar events linked to projects via unique calendar_event_id to prevent duplicates
- **Project Metadata**: shoottracker_meta table stores link_sent, delivered status, and sync metadata
- **Role-Based Access**: Admin routes protected via `verifyAdminRequest` middleware requiring X-Usena-Role and X-Usena-User-Id headers

**ShootTracker API Endpoints:**
- `GET /api/admin/shoottracker/settings` - Retrieve settings (Admin/Lead Retoucher, requires auth headers)
- `PUT /api/admin/shoottracker/settings` - Update settings (Admin/Lead Retoucher, requires auth headers)
- `POST /api/admin/shoottracker/sync` - Trigger calendar sync (Admin/Lead Retoucher, requires auth headers)
- `GET /api/shoottracker/forecast?targetDate=YYYY-MM-DD` - Get capacity forecast
- `PATCH /api/shoottracker/project/:id/link-sent` - Toggle link sent status
- `PATCH /api/shoottracker/project/:id/delivered` - Toggle delivered status
- `GET /api/shoottracker/project/:id/meta` - Get project metadata

**Admin Authentication:**
Frontend must include headers for admin routes:
- `X-Usena-Role`: User's role (must be Admin or LeadRetoucher)
- `X-Usena-User-Id`: User's ID
Use `getAdminHeaders(role, userId)` from `client/src/lib/adminAuth.ts`

**Default Settings:**
- turnaround_days: 5
- working_days: MON-FRI
- timezone: Africa/Johannesburg
- daily_capacity_projects: 3

**Automatic Sync Feature:**
- Configurable auto-sync with enable/disable toggle in ShootTracker Settings
- Sync interval options: 5, 10, 15, 30, or 60 minutes
- Scheduler checks every minute if sync is needed based on settings
- Last sync timestamp displayed in UI with real-time status
- Settings stored in database: `auto_sync_enabled`, `auto_sync_interval_minutes`, `last_auto_sync_at`
- API endpoint: `GET /api/admin/shoottracker/autosync-status` - Get current auto-sync status

### Client-Editor Communication System
WhatsApp-style messaging interface enabling direct communication between editors and clients:
- **Editor Chat Dashboard**: `/editor-chat` route with WhatsApp Web-style layout (project list + conversation view)
- **Role-Based Access**: Admin, Lead Retoucher, Retoucher1-3, and Evans roles can access chat; retouchers only see assigned projects
- **Message Threading**: Conversations organized by project with unread message counters and real-time search
- **Email Notifications**: Automatic email sent to clients when editors send messages, including secure chat link
- **Token Authentication**: Clients access chat via secure tokens (30-day expiry) embedded in email links
- **Security**: All chat endpoints enforce project-level authorization - clients can only access their own projects
- **Database**: `client_messages` table stores messages, `client_chat_tokens` manages authentication tokens

**Chat API Endpoints:**
- `GET /api/admin/chat/projects` - Get all projects with unread counts (role-based filtering)
- `GET /api/admin/chat/project/:projectId/messages` - Get messages for a project
- `POST /api/admin/chat/project/:projectId/messages` - Send message as editor (triggers client email)
- `GET /api/client/chat/project/:projectId/messages` - Get messages (client auth via token)
- `POST /api/client/chat/project/:projectId/messages` - Send message as client

**Chat Authentication:**
- Editor auth: `verifyChatRequest` middleware using X-Usena-Role and X-Usena-User-Id headers
- Client auth: Token-based via `?token=` query parameter, validated against `client_chat_tokens` table

## External Dependencies

- **@tanstack/react-query**: Server state management.
- **wouter**: React router.
- **react-hook-form**: Form management.
- **@hookform/resolvers**: Form validation resolvers.
- **@radix-ui/***
- **lucide-react**: Icon library.
- **class-variance-authority**: CSS class variants.
- **tailwind-merge**: Tailwind CSS utility.
- **drizzle-orm**: ORM for PostgreSQL.
- **@neondatabase/serverless**: Serverless PostgreSQL client.
- **drizzle-zod**: Drizzle and Zod integration.
- **connect-pg-simple**: PostgreSQL session store.
- **vite**: Build tool.
- **typescript**: Language.
- **date-fns**: Date utility.
- **clsx**: Conditional className utility.
- **zod**: Schema validation.
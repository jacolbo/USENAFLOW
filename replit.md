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

### ShootTracker Integration (Google Calendar Sync)
- **Google Calendar Sync**: Import photoshoot bookings from Google Calendar using Replit connector.
- **Calendar Selection**: Choose which calendars to sync from in Settings > Calendar Sync tab.
- **Turnaround Days**: Configure business days from shoot date to delivery due date (default: 5 days).
- **Exclusion Keywords**: Skip events containing specific keywords (e.g., "FULL DAY", "BLOCK", "HOLD").
- **Cancellation Keywords**: Mark events as cancelled based on keywords (e.g., "CANCEL", "DID NOT COME").
- **Link Sent Tracking**: Mark when gallery links have been sent to clients with "Mark Link Sent" button.
- **Project Fields**: Each project tracks shootDate, calendarEventId, isLinkSent, and linkSentAt.
- **API Endpoints**: Calendar settings, calendar list, events fetch, and batch import endpoints.

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
- **googleapis**: Google Calendar API integration.
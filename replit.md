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
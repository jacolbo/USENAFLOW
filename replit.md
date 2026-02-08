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
- **Client-Editor Communication**: A WhatsApp-style messaging interface allows direct communication between editors and clients, featuring threading, unread message counters, email notifications, and token-based client authentication.
- **Customizable Dashboard**: A widget system allows users to configure and reorder dashboard elements with persistent preferences stored per user.
- **Persistent User Management**: User accounts and roles are stored in the database, including admin-controlled user creation and management.
- **Gallery Link Delivery**: Facilitates retouchers adding gallery links and Sales approving delivery, triggering branded client emails and updating project status.
- **Sneak Peek Feature**: Allows retouchers to send preview photos to clients before full delivery via branded emails.
- **Satisfaction Survey System**: Triggers post-delivery surveys, prompting clients with high ratings for Google reviews.
- **Referral Rewards System**: Clients receive referral codes for bonus photos, with automated tracking, matching of referred clients, and application of rewards.
- **VIP Client Tiers**: Automated loyalty program based on project count, offering bonus photos and priority services, with an admin override.
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
# USENA FLOW by Jepson Myles Studio

## Overview

USENA FLOW is a full-stack photography workflow management application designed for Jepson Myles Studio. It streamlines project management from client submission to delivery, offering role-based access control, comprehensive project status tracking, and an intuitive dashboard. The application aims to enhance efficiency, reduce manual overhead, and provide a clear overview of project statuses across various user roles. The business vision is to improve operational efficiency and provide clear oversight of project lifecycles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Design
The application uses React 18 with TypeScript and Vite, employing `shadcn/ui` (built on Radix UI) and Tailwind CSS for a responsive, mobile-first design. It supports light/dark mode theming and features color-coded visual indicators, sortable data tables, week-based project organization, and integrated charts for analytics.

### Technical Implementation
The backend is built with Node.js and Express.js (TypeScript), utilizing a RESTful API. PostgreSQL with Drizzle ORM (via Neon Database) serves as the database, and Zod schemas are used for data validation. Authentication is role-based, supporting seven distinct user roles. The frontend manages state with TanStack Query and uses Wouter for routing and React Hook Form with Zod for form management.

Key features include:
- **Project Workflow**: Five-stage status tracking, project assignment, quality rating, and automated due date calculation.
- **Real-time Communication**: WebSocket integration for live updates and smart notifications.
- **ShootTracker Engine**: Integrates Google Calendar for automated project creation, delivery due date calculation, and risk assessment.
- **Client-Editor Communication**: A WhatsApp-style messaging interface with threading, unread counters, email notifications, and token-based client authentication, including automated comfort features like auto-replies and status messages.
- **Customizable Dashboard**: A widget system allows users to configure and reorder dashboard elements with persistent preferences.
- **Persistent User Management**: User accounts and roles are stored in the database with admin-controlled management.
- **Gallery Link Delivery**: Facilitates retouchers adding gallery links and Sales approving delivery, triggering client emails.
- **Sneak Peek Feature**: Allows retouchers to send preview photos to clients via branded emails.
- **Satisfaction Survey System**: Triggers post-delivery surveys, prompting clients for Google reviews.
- **Referral Rewards System**: Clients receive referral codes for bonus photos.
- **VIP Client Tiers**: Automated loyalty program based on project count, offering bonus photos and priority services.
- **Independent Rewards System**: Standalone engine calculating reward scores/tiers per client based on booking data and referrals.
- **Editable Email Templates**: Admin can customize all email templates via a built-in editor with live preview and variable placeholders.
- **Automated Notifications**: Includes client scheduling notifications and a Data Wrangler delay alert system.
- **Interactive Calendar**: Supports drag-and-drop project movement, quick assignment, and color-coded project display.
- **Google Drive Integration**: Automated photo delivery system that creates organized client folders, monitors uploads, auto-detects delivery completion, generates shareable gallery links, and sends branded delivery emails.
- **Chat Archiving**: Team can archive client chats with active/archived toggle tabs.
- **Project Speed Tracking**: Background system recording timestamps for project status transitions to calculate turnaround times.
- **Leave Management System**: Allows users to request leave, with AI-powered approval based on studio workload and team availability.
- **AI Team Chat System**: Two-way AI chat for admin to inquire about work and for retouchers to explain delays, leveraging project data and retouching guidelines.
- **Retouching Guidelines Policy**: Studio retouching guidelines are stored and referenced by AI in team communications.
- **AI-Powered Features**:
    - **Email Text Variation**: AI rephrases outgoing client emails for uniqueness.
    - **Smart Insights Widget**: Aggregates project data and generates AI-powered trend observations for management roles.
    - **AI Retoucher Coach**: Analyzes individual performance and generates personalized tips and encouragement.
    - **AI Photo Review**: AI vision analysis of project photos for quality evaluation and feedback.
    - **Chat Reply Assistant**: AI-suggested replies or message polishing in the editor chat interface.
    - **Workload Forecast**: AI analyzes upcoming projects, team capacity, and leave to generate capacity forecasts with recommendations.
    - **Predictive Risk Alerts**: AI predicts projects likely to go overdue before deadlines based on performance history.
    - **Quality Gate**: Non-blocking AI photo review providing feedback to retouchers upon upload, using reference images for benchmarking.
    - **AI Learning Layer**: Persistent memory system enabling AI to learn from past interactions and provide context-aware advice.
    - **Admin AI Directives**: Admin can give specific instructions to the AI on team management, injected into all AI prompts.
    - **Comprehensive Data Learning**: On-demand AI scan of all data sources to extract observations and update memories.
- **Client Chat PWA**: The client chat page is a Progressive Web App with install prompt, push notifications, and a service worker.
- **Automation Hub**: Admin page showing all system automations with visual details, enable/disable toggles, and activity logs.
- **Gallery Module (Pixieset replacement)**: Client photo selection galleries with admin management at `/galleries` and `/galleries/:id`, and a public client-facing gallery at `/g/:slug`. Features include password-protected gallery access, photo set management with upload flow, client favourites with email sign-in, "Send to Photographer" selection submission, download PIN gate, CSV export of selections, and real-time SSE notifications for gallery submissions. Styled with Jepson Myles brand (Cream/Gold/Charcoal palette, serif headings). **Note**: Gallery routes use custom `x-usena-role` / `x-usena-user-id` headers for auth (same as ShootTracker). If gallery endpoints return 403 after a code merge, ensure the server has been restarted to pick up the new route registrations.

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
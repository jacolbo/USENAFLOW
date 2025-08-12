# USENA FLOW by Jepson Myles Studio

## Overview

USENA FLOW is a full-stack photography workflow management application built with React, Express.js, and PostgreSQL. The system helps Jepson Myles Studio manage projects from initial client submission through retouching and delivery. It features role-based access control, project status tracking, and a comprehensive dashboard interface.

The application supports multiple user roles including Sales/Admin, Lead Retoucher, Data Wrangler, and individual retouchers, each with specific permissions and workflow responsibilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration for client-server separation
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation integration

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured error handling
- **Request Logging**: Custom middleware for API request/response logging
- **Development**: Hot reload with Vite middleware integration

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM (Persistent Storage)
- **Schema Management**: Drizzle Kit for migrations and schema generation
- **Database Provider**: Neon Database serverless PostgreSQL
- **Validation**: Zod schemas for runtime type checking and API validation
- **Storage Pattern**: DatabaseStorage implementation with automatic data seeding
- **Data Persistence**: All user data persists across deployments and restarts

### Authentication & Authorization
- **Role-Based Access**: Seven distinct user roles with different permissions (Admin, Sales, LeadRetoucher, DataWrangler, Retoucher)
- **Cross-Device Login**: Static credentials that work on any computer/device
- **Password Management**: Admin can view and reset all team passwords through Settings panel
- **Team Credentials**: Built-in accounts for all team roles with standardized login credentials
- **Dynamic Team Management**: Admin-controlled user creation and editing with persistent state

### Project Management Features
- **Status Tracking**: Five-stage workflow (Awaiting Payment → Ready → Assigned → Review → Delivered)
- **Assignment System**: Projects can be assigned to specific retouchers
- **Rating System**: Completed projects can be rated for quality tracking
- **Due Date Calculation**: Automatic due date calculation based on turnaround time
- **Extras Tracking**: Additional work beyond the original package scope

### UI/UX Design System
- **Component Library**: Comprehensive set of reusable UI components
- **Theme System**: CSS custom properties with light/dark mode support
- **Responsive Design**: Mobile-first approach with responsive breakpoints
- **Status Visualization**: Color-coded badges and indicators for project status
- **Data Tables**: Sortable, filterable tables for project management
- **Team Management Interface**: Admin-only panel for user creation, editing, and deletion

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing for React applications
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Form validation resolvers including Zod

### UI Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **lucide-react**: Icon library for consistent iconography
- **class-variance-authority**: Type-safe CSS class variants
- **tailwind-merge**: Utility for merging Tailwind CSS classes

### Database & Backend
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **drizzle-zod**: Integration between Drizzle and Zod for schema validation
- **connect-pg-simple**: PostgreSQL session store for Express

### Development Tools
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling for Replit environment

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **clsx**: Conditional className utility
- **zod**: Schema validation and type inference

## Recent Changes (January 2025)

### Cross-Device Authentication & Sales Role Implementation
- **Sales Role Created**: New Sales role with same permissions as Admin except team management (no Settings panel access)
- **Complete Team Credentials**: Added built-in login accounts for all team members with consistent username/password format
- **Cross-Device Login**: Static credentials work on any computer - team members can login from different devices
- **Password Visibility**: Admin users can view all team passwords through Settings > Password Management tab
- **Login Reference**: Added credentials reference panel on login screen for easy team access
- **Comprehensive Access**: All roles now have proper login credentials for cross-device functionality

### Notes System Implementation
- **Project Notes Feature**: Complete notes system supporting both text and image notes for projects
- **Role-Based Access**: Admin, Sales, and Data Wrangler can create, edit, and delete notes; Retouchers can view notes only when they exist
- **Object Storage Integration**: Set up cloud storage for image note attachments with automatic file upload handling
- **Database Integration**: Added project_notes table with proper schema and API endpoints for full CRUD operations
- **UI Integration**: Notes column in project table with conditional visibility based on user role and note existence
- **Automatic Extras Calculation**: When editing selected photo count, extras are automatically calculated (selected - package count, minimum 0)

### Team Credentials Reference
- **Admin**: admin / admin123 (full access including team management + retoucher capabilities as "Evans Abreation E.M")
- **Sales**: sales / sales123 (project management, no team settings)
- **Workflow Manager**: workflow / workflow123 (lead retoucher permissions)
- **Data Wrangler**: data / data123 (data management permissions)
- **Earl**: earl / earl123 (retoucher access)
- **Dr Asa**: asa / asa123 (retoucher access)
- **Lucky**: lucky / lm123 (retoucher access)

### Team Management System Implementation
- **Global User State**: Replaced static role mappings with dynamic user array including default team members (Earl/EC, Dr Asa/ASA, Lucky/LM)
- **Admin Team Panel**: Created comprehensive team management interface visible only to Admin users
- **CRUD Operations**: Full create, edit, delete functionality for team members with real-time UI updates
- **System Integration**: Dynamic user lists populate role selector, assignment dropdowns, and calendar legends
- **Custom Abbreviations**: Support for personalized team member abbreviations in calendar views
- **Color Coding**: Indigo theme for custom users, preserving original color scheme for default team members

### Data Wrangler Enhanced Permissions (January 2025)
- **Full Project Editing**: Data Wranglers can now edit package count, selected photos count, and extras for any project
- **Automatic Calculations**: System automatically recalculates extras when package or selected count changes
- **Project Duplication**: Data Wranglers can duplicate projects with one click, copying all details except status/assignments
- **Notes Management**: Data Wranglers have full access to create, edit, and manage project notes with text and image support
- **Role Permissions**: Admin, Sales, Data Wrangler, and Lead Retoucher all have comprehensive project management capabilities

### Database Persistence Implementation (January 2025)
- **Persistent Storage**: Replaced in-memory storage with PostgreSQL database backend
- **Data Security**: All user data (projects, notes, assignments) now persists across deployments
- **Automatic Seeding**: Database initializes with sample data on first run, prevents data loss
- **Production Ready**: Full CRUD operations with database transactions and error handling
- **Zero Data Loss**: All projects, notes, and user activity preserved during updates and deployments

### Project Management Features Enhancement
- **Data Wrangler Permissions**: Full project editing including package count, selected photos, and extras
- **Automatic Calculations**: System recalculates extras when package or selected count changes
- **Project Duplication**: One-click project duplication available to Admin, Sales, and Data Wranglers
- **Notes Management**: Admin/Sales/Data Wrangler can create, edit, delete notes; retouchers view-only access

### Notes System Implementation
- **Text and Image Notes**: Support for both text notes and image uploads using object storage
- **Role-Based Access**: Admin/Sales/Data Wrangler can create and edit notes; retouchers can view existing notes only
- **Real-Time Updates**: Notes system integrates with main project table showing notes status and count
- **Image Upload**: Secure image upload functionality using Replit's object storage service
- **Session Management**: Extended session timeout from 10 minutes to 2 hours for improved workflow efficiency

### Team Progress Analytics Implementation (January 2025)
- **Integrated Analytics**: Added comprehensive team analytics directly to the main dashboard page bottom
- **Role-Based Access**: Available only to Admin, Sales, and Lead Retoucher roles; hidden for retouchers
- **Advanced Charts**: Implemented line chart showing photos delivered over time using Recharts library
- **KPI Summary**: Displays total photos delivered, time periods, and average photos per period
- **Flexible Filtering**: Date range selector with default last 30 days and granularity options (daily/weekly/monthly)
- **Delivered Projects Tracking**: Only counts photos from projects marked as "Delivered" with automatic deliveredAt timestamp
- **Seamless Integration**: Analytics appear below project table for easy access without separate page navigation
- **Data Accuracy**: Photo count calculation uses selectedCount or packageCount + extras (non-negative)

### Daily Quotes System Implementation (January 2025)
- **Deterministic Quotes**: Each user gets the same inspirational quote all day, different quote each day
- **Integration**: Daily quote component added to dashboard with blue gradient card design
- **Quote Library**: 350+ professional and motivational quotes focused on work excellence and productivity
- **User-Specific**: Quote selection based on user ID and current date for consistent daily experience
- **Visual Design**: Elegant quote card with quote icon and "Daily Inspiration" label

### Admin as Retoucher Implementation (January 2025)
- **Dual Role**: Admin user can now function as both administrator and retoucher
- **Retoucher Identity**: Admin operates as retoucher under the name "Evans Abreation E.M" with alias "E.M"
- **Assignment System**: Admin appears in project assignment dropdowns alongside other retouchers
- **Calendar Integration**: Evans Abreation E.M shows in mini-calendar with orange color coding (E.M badge)
- **Analytics Integration**: Tracked separately in team analytics with orange line graph
- **Input Optimization**: Fixed smooth editing for Pkg/Sel/Extra fields with 500ms debouncing and stable project positioning

### Archive System Implementation (January 2025)
- **Current vs Archive Views**: Toggle between current projects (last 7 days) and archive projects (older than 1 week)
- **Smart Interface**: Add Project form and Team Analytics only show in current view for focus on active work
- **Visual Indicators**: Archive button shows current view state with project count indicators
- **Date-Based Filtering**: Automatic separation based on project creation/due dates
- **Clean Organization**: Maintains all project accessibility while reducing dashboard clutter

### Live Sync & Notification System Implementation (January 2025)
- **WebSocket Integration**: Real-time bidirectional communication between client and server
- **Live Project Updates**: Automatic project table refresh when any team member makes changes
- **Smart Notifications**: Targeted notifications for project assignments, completions, and status changes
- **Browser Notifications**: Native OS notifications for important updates (with user permission)
- **Connection Status**: Visual indicators showing live sync connection status in notification center
- **Notification Types**: Project assigned, project completed, project created, and status changes
- **User-Targeted Alerts**: Assignments send notifications specifically to assigned retouchers
- **Notification Management**: Mark as read, clear all, and unread count badges
- **Auto-Reconnection**: Automatic WebSocket reconnection on connection loss
- **Real-Time Collaboration**: Instant visibility of team member actions across all connected devices
- **Custom Notification Sound**: Boxing bell sound effect plays for important notifications (30% volume)
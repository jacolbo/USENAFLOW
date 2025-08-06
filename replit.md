# Photography Workflow Management System

## Overview

This is a full-stack photography workflow management application built with React, Express.js, and PostgreSQL. The system helps photography studios manage projects from initial client submission through retouching and delivery. It features role-based access control, project status tracking, and a comprehensive dashboard interface.

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
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations and schema generation
- **Database Provider**: Neon Database serverless PostgreSQL
- **Validation**: Zod schemas for runtime type checking and API validation
- **Storage Pattern**: Repository pattern with in-memory fallback for development

### Authentication & Authorization
- **Role-Based Access**: Six distinct user roles with different permissions
- **Session Management**: Express sessions with PostgreSQL session store
- **Frontend State**: Simple role selection without persistent authentication (demo mode)

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
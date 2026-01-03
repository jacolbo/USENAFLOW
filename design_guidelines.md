# USENA FLOW Design Guidelines

## Design Approach
**System Selected**: shadcn/ui (as specified) + Tailwind with dark-first professional aesthetic
**Justification**: Data-heavy workflow management requires consistent, accessible component patterns with excellent dark theme support. The purple/blue accent system provides visual hierarchy without compromising readability in extended use.

---

## Core Design Elements

### A. Typography
- **Primary Font**: Inter via Google Fonts (clean, professional, excellent at small sizes)
- **Heading Hierarchy**: 
  - H1: text-3xl font-bold (Dashboard titles)
  - H2: text-2xl font-semibold (Section headers)
  - H3: text-lg font-medium (Card titles, Table headers)
  - Body: text-sm (Default interface text)
  - Caption: text-xs (Metadata, timestamps)

### B. Layout System
**Spacing Primitives**: Tailwind units 2, 4, 6, 8, 12 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Card spacing: p-4 internally, gap-4 between cards
- Page margins: p-6 to p-8

**Grid System**:
- Dashboard: 12-column grid (grid-cols-12)
- KPI cards: 4-column responsive (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Project cards: 3-column (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Sidebar: Fixed 16rem width, collapsible to icons-only on mobile

### C. Component Library

**Navigation**:
- Left sidebar with icon + label navigation items
- Active state: purple/blue highlight bar + background glow
- Top bar: breadcrumbs, global search, user profile, notifications

**Dashboard KPI Cards**:
- Metric value (large, bold)
- Label (caption text)
- Trend indicator (up/down arrow + percentage)
- Mini sparkline chart in corner
- Subtle gradient border on hover

**Data Tables** (shadcn/ui Table):
- Sticky header row
- Alternating row subtle background
- Status badges (pill-shaped, colored: purple for active, gray for pending, green for complete)
- Action column (right-aligned icons)
- Pagination footer

**Calendar Component**:
- Full month view with project due dates
- Color-coded dots for project status
- Today highlight with purple accent
- Sidebar mini-calendar for navigation
- Import button with Google Calendar icon

**Project Cards**:
- Thumbnail preview (16:9 aspect)
- Project title + client name
- Status badge + due date
- Progress bar
- Quick action buttons (view, edit, track)

**Link Tracking Display**:
- Icon + timestamp for sent links
- Status indicator (viewed/not viewed)
- Recipient name + email
- Action menu (resend, copy)

**Role-Based Access Indicators**:
- Permission badges on user cards
- Access level dropdowns with clear labels
- Lock icons for restricted features

### D. Animations
Use sparingly:
- Sidebar collapse/expand (300ms ease-in-out)
- Card hover lift (subtle transform scale 1.01)
- Data loading skeleton states
- Status badge transitions

---

## Images

**No traditional hero image** - This is a dashboard application. Instead:

**Login/Onboarding Screens**:
- Full-bleed photography showcase (abstract, high-quality studio shots in dark tones)
- Overlay with blurred background for login form
- Images rotate on each visit showing different photography styles

**Empty States**:
- Illustration-style graphics for "No projects yet" states
- Photography-themed iconography
- Muted purple/blue color palette

**Project Thumbnails**:
- User-uploaded project preview images throughout cards and tables
- Aspect ratio: 16:9 for consistency
- Fallback: gradient placeholder with project initials

**User Avatars**:
- Circular profile images in navigation and user management
- Fallback: colored circles with initials

---

## Dark Theme Specifications

**Background Hierarchy**:
- Primary BG: #0a0a0b (near-black)
- Secondary BG: #18181b (cards, modals)
- Tertiary BG: #27272a (hover states)

**Purple/Blue Accent System**:
- Primary accent: #8b5cf6 (vibrant purple)
- Secondary accent: #3b82f6 (bright blue)
- Use purple for primary actions, blue for informational elements
- Gradient overlays: purple-to-blue for special highlights

**Text Colors**:
- Primary: #fafafa (high contrast)
- Secondary: #a1a1aa (metadata)
- Tertiary: #71717a (disabled)

**Borders & Dividers**:
- Default: #27272a (subtle)
- Interactive: #3f3f46 (hover)
- Accent: purple/blue gradient (focus states)

---

## Page-Specific Layouts

**Main Dashboard**:
- Top: KPI cards row (4 metrics)
- Middle: 2-column split (Calendar left, Recent Projects right)
- Bottom: Data table (All Active Projects)

**ShootTracker View**:
- Calendar occupies left 2/3 of screen
- Right sidebar: Link tracking list + import button
- Filter bar above calendar (status, client, date range)

**Project Detail**:
- Header: Project name, client, status, actions
- 3-column grid: Files, Timeline, Team
- Progress tracker timeline component

This design creates a sophisticated, data-rich interface that prioritizes efficiency while maintaining visual polish through strategic use of the purple/blue accent system against the professional dark foundation.
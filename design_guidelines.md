# Photography Studio Workflow Management App - Design Guidelines

## Design Approach

**Selected Approach**: Design System - Linear/Notion-inspired productivity aesthetic with photography-forward visual treatment

**Justification**: Professional workflow tool requiring data density, clarity, and dark/light mode excellence. Linear's crisp interface patterns meet these needs while maintaining visual sophistication appropriate for creative professionals.

**Key Principles**:
- Information hierarchy through typography weight and spacing, not decoration
- Clean data presentation with breathing room
- Purposeful use of photography to establish creative context
- Consistent dark/light mode implementation across all components

---

## Core Design Elements

### A. Typography

**Font System**: Inter (via Google Fonts CDN)

**Hierarchy**:
- Page Headers: font-bold text-3xl tracking-tight
- Section Headers: font-semibold text-xl
- Widget Titles: font-semibold text-base
- Body Text: font-normal text-sm
- Table Headers: font-medium text-xs uppercase tracking-wide
- Metadata/Labels: font-medium text-xs
- Status Badges: font-medium text-xs uppercase tracking-wider

### B. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24 (e.g., p-4, gap-6, mb-8, py-12)

**Grid Structure**:
- Main dashboard: 12-column grid (grid-cols-12)
- Primary content: 8 columns (col-span-8)
- Sidebar widgets: 4 columns (col-span-4)
- Calendar: Full-width with week columns (grid-cols-7)
- Responsive: Stack to single column on mobile (md:grid-cols-12)

**Container Widths**:
- Max container: max-w-7xl mx-auto px-6
- Card max-width: full within grid constraints
- Data tables: w-full with horizontal scroll if needed

### C. Component Library

**Navigation**:
- Top bar: Full-width sticky header with app logo, search bar, theme toggle, user profile
- Height: h-16 with px-6 padding
- Left sidebar: w-64 fixed navigation with project categories, filters, settings
- Mobile: Hamburger menu collapsing sidebar

**ShootTracker Dashboard Widget**:
- Card container with subtle border and rounded-lg corners
- Header: Widget title with "View All" link aligned right
- Content sections (stacked vertically):
  1. Upcoming Shoots section (first 3-5 shoots)
     - Each shoot: Row with date badge (w-16 text-center), client name (font-semibold), shoot type, time
     - Spacing: gap-3 between rows
  2. At-Risk Projects section
     - Each project: Row with risk indicator dot (w-2 h-2 rounded-full), project name, days overdue, action button
     - Risk dots: Implement as inline-flex items-center gap-2
     - Spacing: gap-3 between rows

**Week-Based Calendar**:
- Grid: 7 columns for days, rows for time slots or projects
- Day headers: Sticky top position with date and day name
- Time slots: hourly blocks with min-h-16
- Project blocks: Rounded cards spanning relevant time periods, showing client name, shoot type, status badge
- Overflow: Scroll within calendar container

**Data Tables**:
- Table structure: w-full with border-collapse
- Header row: Sticky top with sort indicators (Heroicons chevron-up/chevron-down)
- Cell padding: px-4 py-3 for data, px-4 py-4 for headers
- Zebra striping: Alternate row treatment for readability
- Filter controls: Positioned above table with gap-4 between filter chips
- Responsive: Horizontal scroll on mobile, card view transformation for narrow viewports

**Status Badges**:
- Pill shape: Inline-flex items-center px-3 py-1 rounded-full
- Typography: font-medium text-xs uppercase tracking-wider
- Common statuses: Confirmed, In Progress, Editing, Completed, Cancelled, At Risk
- Placement: Inline within table cells or project cards

**Forms & Inputs**:
- Input fields: h-10 px-4 rounded-lg with border
- Focus states: Outline ring treatment (ring-2)
- Labels: Block mb-2 font-medium text-sm
- Button groups: Flex with gap-2

**Cards**:
- Standard padding: p-6
- Border radius: rounded-lg
- Shadow: Subtle elevation on hover for interactive cards
- Spacing between cards: gap-6 in grid layouts

**Buttons**:
- Primary: px-4 py-2 rounded-lg font-medium
- Secondary: px-4 py-2 rounded-lg font-medium with border
- Icon buttons: w-10 h-10 rounded-lg flex items-center justify-center
- Buttons on images: Backdrop blur treatment (backdrop-blur-sm) with semi-transparent background

**Icons**: Heroicons via CDN (outline style for navigation, solid for inline indicators)

### D. Animations

**Minimal Motion**:
- Theme toggle: Smooth 200ms transition
- Dropdown menus: 150ms opacity fade
- No scroll animations, parallax, or decorative motion

---

## Images

**Hero Section**: YES - Large hero image

**Image Specifications**:

1. **Hero Image** (Top of dashboard):
   - Full-width banner (w-full h-64)
   - Professional photography studio scene (photographer with camera, lighting setup, or creative workspace)
   - Placement: Above main dashboard content, below navigation
   - Treatment: Gradient overlay from bottom (dark to transparent) for text legibility
   - Content overlay: Welcome message, quick stats (Total Projects, Active Shoots, Completed This Week) positioned bottom-left with backdrop-blur buttons for "New Project" and "Schedule Shoot"

2. **Empty State Illustrations**:
   - Calendar empty state: Camera equipment sketch when no shoots scheduled
   - Table empty state: Photography grid icon when no projects exist
   - Size: max-w-xs mx-auto

3. **Profile/Client Avatars**:
   - Circular: w-10 h-10 rounded-full in table rows and project cards
   - Placeholder: Initials on colored background when no image
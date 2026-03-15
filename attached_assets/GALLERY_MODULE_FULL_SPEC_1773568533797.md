# USENA Flow — Gallery Module Build Specification
## Complete Pixieset Replacement for Jepson Myles Studio

---

## OVERVIEW

Build a complete client photo selection gallery module that integrates into the existing USENA Flow app. This replaces Pixieset for client photo proofing and selection. The module adds both admin-facing gallery management pages and public client-facing gallery pages.

**CRITICAL: This integrates into the EXISTING codebase. Do NOT create a separate app. Follow ALL existing patterns exactly.**

---

## EXISTING TECH STACK (do not change)

- Frontend: React 18 + TypeScript + Vite + Wouter routing + shadcn/ui + Tailwind CSS + TanStack Query v5
- Backend: Node.js + Express.js (TypeScript)
- Database: PostgreSQL (Neon serverless) via Drizzle ORM
- Validation: Zod schemas (shared between front and back)
- Real-time: Server-Sent Events (SSE)
- Auth: Role-based session auth (staff) + token-based auth (clients)
- File Storage: Replit Object Storage (Google Cloud Storage SDK) via `server/objectStorage.ts`
- Email: Resend via `server/services/emailService.ts`

---

## STEP 1: DATABASE SCHEMA

Add these tables to `shared/schema.ts`. Place them BEFORE the `AVAILABLE_WIDGETS` array. Use the exact same patterns as existing tables (pgTable, varchar UUIDs, createInsertSchema, type exports).

### New Tables

```typescript
// Client photo selection galleries (replaces Pixieset)
export const galleries = pgTable("galleries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  password: text("password"),
  downloadPin: text("download_pin"),
  coverImageKey: text("cover_image_key"),
  status: text("status").notNull().default("draft"),
  settings: jsonb("settings").notNull().default(sql`'{"downloadEnabled":true,"downloadSizes":["original","web"],"favoritesEnabled":true,"favoriteNotesEnabled":true,"slideshowEnabled":true,"socialSharingEnabled":false,"filenameDisplay":true,"watermarkEnabled":true,"emailRegistration":false,"galleryAssist":false,"language":"en","gridStyle":"vertical","thumbnailSize":"regular","colorTheme":"light","fontTheme":"sans"}'::jsonb`),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  publishedAt: timestamp("published_at"),
});

export const gallerySets = pgTable("gallery_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDownloadable: boolean("is_downloadable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryPhotos = pgTable("gallery_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  setId: varchar("set_id").notNull().references(() => gallerySets.id, { onDelete: "cascade" }),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryFavLists = pgTable("gallery_fav_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  name: text("name").notNull().default("My Favorites"),
  selectionLimit: integer("selection_limit"),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  submittedAt: timestamp("submitted_at"),
  submittedMessage: text("submitted_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const gallerySelections = pgTable("gallery_selections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  favListId: varchar("fav_list_id").notNull().references(() => galleryFavLists.id, { onDelete: "cascade" }),
  photoId: varchar("photo_id").notNull().references(() => galleryPhotos.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryDownloads = pgTable("gallery_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  downloadType: text("download_type").notNull(),
  photoIds: jsonb("photo_ids"),
  downloadSize: text("download_size").notNull().default("original"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryAuthTokens = pgTable("gallery_auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
```

### Zod schemas and types (add after the tables)

```typescript
export const insertGallerySchema = createInsertSchema(galleries).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const updateGallerySchema = createInsertSchema(galleries).partial().omit({ id: true, createdAt: true });
export const insertGallerySetSchema = createInsertSchema(gallerySets).omit({ id: true, createdAt: true });
export const insertGalleryPhotoSchema = createInsertSchema(galleryPhotos).omit({ id: true, createdAt: true });
export const insertGalleryFavListSchema = createInsertSchema(galleryFavLists).omit({ id: true, createdAt: true, updatedAt: true, isSubmitted: true, submittedAt: true, submittedMessage: true });
export const insertGallerySelectionSchema = createInsertSchema(gallerySelections).omit({ id: true, createdAt: true });
export const insertGalleryDownloadSchema = createInsertSchema(galleryDownloads).omit({ id: true, createdAt: true });
export const insertGalleryAuthTokenSchema = createInsertSchema(galleryAuthTokens).omit({ id: true, createdAt: true });

export type Gallery = typeof galleries.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type UpdateGallery = z.infer<typeof updateGallerySchema>;
export type GallerySet = typeof gallerySets.$inferSelect;
export type InsertGallerySet = z.infer<typeof insertGallerySetSchema>;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type InsertGalleryPhoto = z.infer<typeof insertGalleryPhotoSchema>;
export type GalleryFavList = typeof galleryFavLists.$inferSelect;
export type InsertGalleryFavList = z.infer<typeof insertGalleryFavListSchema>;
export type GallerySelection = typeof gallerySelections.$inferSelect;
export type InsertGallerySelection = z.infer<typeof insertGallerySelectionSchema>;
export type GalleryDownload = typeof galleryDownloads.$inferSelect;
export type InsertGalleryDownload = z.infer<typeof insertGalleryDownloadSchema>;
export type GalleryAuthToken = typeof galleryAuthTokens.$inferSelect;
export type InsertGalleryAuthToken = z.infer<typeof insertGalleryAuthTokenSchema>;

export const GalleryStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  HIDDEN: "hidden",
  EXPIRED: "expired",
} as const;

export const GalleryPermissions = {
  FULL: ["Admin", "Evans", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler"],
  MANAGE: ["LeadRetoucher"],
  READ_ONLY: ["Finance"],
} as const;
```

After adding schema, run: `npx drizzle-kit push` and select "No" for all truncation prompts.

---

## STEP 2: BACKEND API ROUTES

Create a new file `server/galleryRoutes.ts` and register it in `server/routes.ts`.

### Registration in routes.ts

Add import at top:
```typescript
import { registerGalleryRoutes } from "./galleryRoutes";
```

Add registration near line 3075 (next to registerShoottrackerRoutes):
```typescript
registerGalleryRoutes(app);
```

### Route Architecture

The gallery routes file (`server/galleryRoutes.ts`) must implement these endpoints. Use the same patterns as existing routes: `req.headers["x-usena-user-id"]` for staff auth, `ObjectStorageService` for file operations, `broadcastSSE` for real-time notifications.

**IMPORTANT:** Import `broadcastSSE` from `"./routes"` — it's already exported there.

#### Permission System

Three tiers:
- FULL access (create, edit, delete, all features): Admin, Evans, Retoucher1, Retoucher2, Retoucher3, DataWrangler
- MANAGE access (create, edit, no delete): LeadRetoucher
- READ_ONLY (view on project tab, download activity): Finance

Check role via `req.headers["x-usena-user-role"]`.

#### Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/galleries | List all galleries with photo counts and fav activity counts |
| POST | /api/galleries | Create gallery (auto-generates slug from name, password, download PIN, and a default "Highlights" set) |
| GET | /api/galleries/:id | Get gallery with sets and photo counts |
| PATCH | /api/galleries/:id | Update gallery settings |
| PATCH | /api/galleries/:id/publish | Publish/unpublish (toggle status between "published" and "hidden") |
| DELETE | /api/galleries/:id | Delete gallery (FULL permission only) |
| GET | /api/galleries/:id/share | Get share info: gallery URL (/g/slug), password, download PIN |
| POST | /api/galleries/:id/sets | Create a new set within gallery |
| PATCH | /api/galleries/:id/sets/:setId | Update set (name, sort order, downloadable toggle) |
| DELETE | /api/galleries/:id/sets/:setId | Delete set |
| POST | /api/galleries/:id/photos/upload-url | Get presigned upload URL(s) from ObjectStorageService |
| POST | /api/galleries/:id/photos | Register a single uploaded photo (after client-side upload completes) |
| POST | /api/galleries/:id/photos/batch | Register multiple uploaded photos at once |
| GET | /api/galleries/:id/photos | Get all photos in gallery |
| DELETE | /api/galleries/:id/photos/:photoId | Delete a photo |
| GET | /api/galleries/:id/activity/favorites | List all favourite lists (client email, count, dates, submitted status) |
| GET | /api/galleries/:id/activity/favorites/:listId | Get specific list with photo filenames, timestamps, set names, notes |
| GET | /api/galleries/:id/activity/favorites/:listId/export | Export CSV of filenames for Capture One matching |
| GET | /api/galleries/:id/activity/downloads | Download activity log |

#### Client API Endpoints (public, token-gated)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/g/:slug | Get gallery info by slug (minimal: name, hasPassword, coverImage, settings) |
| POST | /api/g/:slug/auth | Verify gallery password, return auth token (stored in galleryAuthTokens) |
| GET | /api/g/:slug/photos | Get all sets + photos (requires x-gallery-token header) |
| POST | /api/g/:slug/favorites/signin | Email sign-in for favourites (creates galleryFavList if not exists) |
| GET | /api/g/:slug/favorites | Get client's favourite lists with selected photo IDs |
| POST | /api/g/:slug/favorites/:listId/toggle | Toggle photo favourite (add/remove from list, respects selection limit) |
| POST | /api/g/:slug/favorites/:listId/note | Add/update note on a favourited photo |
| POST | /api/g/:slug/favorites/:listId/submit | "Send to Photographer" — marks list as submitted, broadcasts SSE notification to team |
| POST | /api/g/:slug/download/verify-pin | Verify 4-digit download PIN |
| GET | /api/g/:slug/image/:photoId | Serve image from object storage (proxied, with caching headers) |

**Client auth flow:** Password → token stored in galleryAuthTokens → client sends token as `x-gallery-token` header on all subsequent requests.

**Favourite flow:** Client clicks heart → modal asks for email → email creates/loads galleryFavList → heart toggles add/remove gallerySelections → "Send to Photographer" marks isSubmitted=true and broadcasts SSE.

**Download flow:** Client clicks download → if downloadPin is set, show PIN input → verify PIN via API → serve files.

When a gallery is created linked to a project, update the project's `galleryLink`, `galleryLinkAddedAt`, and `galleryLinkAddedBy` fields.

When client submits selections, call `broadcastSSE({ type: "gallery_selection_submitted", payload: { galleryId, galleryName, clientEmail, selectionCount, message, submittedAt } })`.

---

## STEP 3: FRONTEND — Admin Pages

### Route additions in client/src/App.tsx

Add these routes inside the Switch:
```tsx
<Route path="/galleries" component={GalleriesPage} />
<Route path="/galleries/:id" component={GalleryDetailPage} />
<Route path="/g/:slug" component={ClientGalleryPage} />
```

Import the new page components.

### Sidebar Navigation

Add a "Galleries" link to the sidebar navigation (wherever the existing sidebar is defined in the dashboard). Icon: `Image` from lucide-react. Place it after the existing navigation items. Show for all roles except Finance.

### Page: /galleries — Gallery List

**Layout:** Same layout pattern as the dashboard. Sidebar on left, content on right.

**Content:**
- Header with title "Galleries" and a "New Collection" button (uses shadcn Button)
- Search input to filter galleries by name
- Grid of gallery cards showing:
  - Cover image thumbnail (or placeholder)
  - Gallery name (bold)
  - Photo count (e.g. "91 items")
  - Status badge (Draft = gray, Published = green, Hidden = yellow, Expired = red)
  - Favourite activity indicator (e.g. "2 selections")
  - Click navigates to /galleries/:id

**New Collection dialog (shadcn Dialog):**
- Name input (required)
- Optional: Link to project (dropdown of existing projects)
- Creates gallery via POST /api/galleries
- On success, navigates to /galleries/:id

### Page: /galleries/:id — Gallery Detail (Admin)

**Layout:** Sidebar tabs on left, content area on right. Like the existing project detail pattern.

**Tabs:**

**Photos tab (default):**
- Shows all sets with photo counts
- "Add Set" button
- "Add Media" button that triggers file upload
- Photo grid showing thumbnails in the selected set
- Drag-to-reorder photos (nice to have)
- Upload flow: Click "Add Media" → file picker (accept image/*) → for each file, get presigned URL via /api/galleries/:id/photos/upload-url → upload directly to object storage → register via /api/galleries/:id/photos with { setId, filename (original file name from the File object), storageKey }
- Delete photo button per image

**Settings tab:**
- Gallery name (editable)
- Gallery URL slug (editable, show full URL)
- Gallery password (show/hide toggle, "Generate" button)
- Download settings section:
  - Download enabled toggle
  - Download PIN (show/hide, "Reset PIN" button)
  - Download sizes checkboxes (Original, 3600px, 2048px, Web 1024px, Web 640px)
- Favourites settings section:
  - Favourites enabled toggle
  - Favourite notes enabled toggle
  - Selection limit input (optional number)
- Display settings:
  - Filename display toggle
  - Slideshow enabled toggle
  - Grid style (vertical/horizontal)
  - Color theme select
- Expiry date picker
- Save button calls PATCH /api/galleries/:id

**Activity tab:**
- Sub-tabs: Favourites | Downloads
- Favourites sub-tab:
  - Table showing: Client email, List name, Selection count, Created date, Updated date, Submitted status
  - Click a row to expand and show:
    - Each selected photo filename
    - Timestamp of selection
    - Set name
    - Client note (if any)
    - "Export CSV" button → calls /api/galleries/:id/activity/favorites/:listId/export
    - "Download All" button
- Downloads sub-tab:
  - Table showing: Client email, Download type, Photo count, Size, Date

**Share section (shown in header or as a tab):**
- Gallery URL with copy button (e.g. team.jepsonmyles.co.za/g/saphirabirthday)
- Gallery password with copy button
- Download PIN with copy button
- Publish/Unpublish toggle button
- Status indicator (Draft/Published/Hidden)

### Project Page Integration

In the existing project detail page, add a "Gallery" tab. This tab shows:
- If no gallery linked: "Create Gallery" button
- If gallery linked: embedded view of gallery status, photo count, recent favourite activity, link to full gallery page

---

## STEP 4: FRONTEND — Client-Facing Gallery Pages

### Page: /g/:slug — Client Gallery

This is the public-facing page your clients use. It must look luxurious and professional — this represents Jepson Myles Studio brand.

**Brand colors:** Cream (#F5F0EB), Gold (#C9A96E), Charcoal (#2D2D2D), White (#FFFFFF)

**Flow:**

1. **Password Gate** (if gallery has password):
   - Centered card with studio logo/name at top
   - "Enter password to view gallery" text
   - Password input field
   - "View Gallery" button
   - Clean, minimal design on cream background
   - On success, stores token in localStorage, redirects to gallery view

2. **Cover Page:**
   - Full-screen hero image (cover photo from gallery)
   - Gallery name in elegant serif font, centered
   - "JEPSON MYLES STUDIO" branding below
   - "VIEW GALLERY" button
   - Click scrolls to or navigates to photo grid

3. **Gallery Grid:**
   - Header: Gallery name (left), Studio name (below), heart/download/share/slideshow icons (right)
   - Responsive masonry grid of photos (3-5 columns depending on screen width)
   - Images load as thumbnails, watermarked in preview
   - On hover: show heart, download, share icons at bottom of each image
   - Heart icon on favourited images shows as teal/green filled
   - Small heart badge in top-left corner of favourited images
   - If filenameDisplay is enabled, show filename below each image in lightbox
   - "Load more" or infinite scroll for large galleries

4. **Lightbox:**
   - Click any image to open full-screen lightbox
   - Dark overlay background
   - Large image centered
   - Navigation: left/right arrows, keyboard arrow keys
   - Top-left: back arrow to return to grid
   - Top-right: heart icon, download icon, share icon, slideshow icon
   - Bottom: filename displayed (e.g. "_MG_3442.jpg") if filenameDisplay is on
   - Heart click behavior:
     - If not signed in to favourites: show email sign-in modal
     - If signed in: toggle favourite immediately, heart fills/unfills

5. **Favourites Email Sign-In Modal:**
   - Title: "FAVORITES"
   - Text: "Save your favorite photos and revisit them at anytime using your email address. You can share this list with your photographer, family and friends."
   - Email input field
   - "SIGN IN" button
   - Calls POST /api/g/:slug/favorites/signin
   - After sign-in, redirects to favourites dashboard

6. **Favourites Dashboard (/g/:slug/favorites internally):**
   - Header: "JEPSON MYLES STUDIO" branding
   - Back arrow to return to gallery
   - "FAVORITES" title
   - "Curated by [email]" subtitle
   - Card for each favourite list showing:
     - List name ("MY FAVORITES")
     - Photo count
     - Cover thumbnail from first selected photo
   - "+ CREATE NEW LIST" button
   - Click a list to see selected photos grid

7. **Favourite List Detail:**
   - Header: back arrow, share icon (paper plane), download icon, three-dot menu
   - "MY FAVORITES" title
   - "3 photos | Curated by test@email.com"
   - Grid of selected photos (same masonry style)
   - Share menu (click share icon):
     - EMAIL FAVORITES
     - SEND TO PHOTOGRAPHER (key action)
     - GET LINK
   - Three-dot menu:
     - EDIT LIST (rename)
     - SLIDESHOW
     - SIGN OUT
   - "Send to Photographer" modal:
     - Title: "SEND TO PHOTOGRAPHER"
     - Text: "Share this favorite list with the photographer and notify them of your selections."
     - "To: Jepson Myles Studio"
     - Textarea with default: "I am done picking my favorites!"
     - CANCEL and SEND buttons
     - SEND calls POST /api/g/:slug/favorites/:listId/submit

8. **Download PIN Gate:**
   - Title: "DOWNLOAD FAVORITES"
   - Text: "Your email will be used to notify you when the files are ready for download. Please enter the download PIN provided by Jepson Myles Studio to download your favorites."
   - Email input (pre-filled from favourite sign-in)
   - PIN input (4-digit)
   - "NEXT" button
   - Calls POST /api/g/:slug/download/verify-pin

9. **Footer:**
   - "Terms of Service" link
   - "Powered by USENA FLOW" (or leave blank / "Jepson Myles Studio")

**Mobile responsiveness is CRITICAL** — most clients view on phones. Grid should go to 2 columns on mobile, lightbox must support touch swipe navigation.

---

## STEP 5: IMAGE HANDLING

### Upload Flow (Admin)

1. Admin selects files in browser
2. Frontend requests presigned upload URLs from POST /api/galleries/:id/photos/upload-url with { count: N }
3. Backend calls `objectStorage.getObjectEntityUploadURL()` for each file, returns array of { uploadUrl, storageKey }
4. Frontend uploads each file directly to object storage via PUT to the signed URL
5. After each upload completes, frontend calls POST /api/galleries/:id/photos with { setId, filename: file.name, storageKey, width, height, fileSize }
6. The original filename (e.g. "_MG_3442.jpg") is stored in the database — this is critical for matching selections back to Capture One

### Image Serving (Client)

- Serve via GET /api/g/:slug/image/:photoId
- Backend loads photo record, gets storageKey, calls `objectStorage.getObjectEntityFile(storageKey)` then `objectStorage.downloadObject(file, res, 86400)`
- This serves the image through the server with a 24-hour cache header
- For thumbnails: if thumbnailKey exists serve that, otherwise serve full image (browser handles resizing via CSS)

---

## STEP 6: REAL-TIME NOTIFICATIONS

When client submits selections (POST /api/g/:slug/favorites/:listId/submit), broadcast via existing SSE system:

```typescript
broadcastSSE({
  type: "gallery_selection_submitted",
  payload: {
    galleryId: gallery.id,
    galleryName: gallery.name,
    clientEmail: favList.clientEmail,
    listName: favList.name,
    selectionCount: count,
    message: favList.submittedMessage,
    submittedAt: favList.submittedAt,
  },
});
```

On the frontend dashboard, listen for this event type and show a toast notification: "Client [email] submitted [count] selections for [gallery name]".

---

## STEP 7: ADD TO AVAILABLE_WIDGETS

In `shared/schema.ts`, add a gallery widget to the AVAILABLE_WIDGETS array:

```typescript
{ id: "gallery_activity", name: "Gallery Activity", description: "Recent client gallery selections and submissions", icon: "Image", defaultEnabled: true, roles: ["Admin", "Evans", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler"] },
```

---

## DESIGN SPECIFICATIONS

### Admin Pages
- Follow existing shadcn/ui + Tailwind patterns exactly
- Same sidebar layout as the existing dashboard
- Same card, table, button, dialog styles
- Same toast notification patterns
- Use existing TanStack Query patterns for data fetching

### Client-Facing Gallery Pages
- Clean, minimal, luxurious feel
- Brand palette: Cream (#F5F0EB), Gold (#C9A96E), Charcoal (#2D2D2D), White
- Typography: Use a serif font for gallery titles (like Cormorant Garamond), sans-serif for body text
- Icons: Use thin line icons (like Font Awesome Light style or Lucide thin)
- Masonry grid with no gaps or 4px gaps
- Lightbox should feel native and fast
- Mobile-first responsive design
- No unnecessary animations — keep it professional and fast
- Password input should be centered, full-page, minimal

---

## FILE STRUCTURE SUMMARY

### New Files
- `server/galleryRoutes.ts` — All gallery API routes
- `client/src/pages/galleries.tsx` — Admin gallery list page
- `client/src/pages/gallery-detail.tsx` — Admin gallery detail page (photos, settings, activity)
- `client/src/pages/client-gallery.tsx` — Public client-facing gallery (cover, grid, lightbox, favourites, download)

### Modified Files
- `shared/schema.ts` — Add 7 gallery tables + schemas + types + GalleryStatus + GalleryPermissions
- `server/routes.ts` — Import and register galleryRoutes
- `client/src/App.tsx` — Add 3 new routes (/galleries, /galleries/:id, /g/:slug)
- Dashboard sidebar — Add "Galleries" navigation item

### Database Migration
After schema changes, run:
```
npx drizzle-kit push
```
Select "No" for all truncation prompts.

---

## TESTING CHECKLIST

After building, verify:

1. [ ] /galleries page loads and shows "New Collection" button
2. [ ] Create a gallery — auto-generates slug, password, PIN, and "Highlights" set
3. [ ] Upload photos to gallery — files go to object storage, original filenames stored
4. [ ] Publish gallery — status changes to "published"
5. [ ] Share info shows correct URL (/g/slug), password, and PIN
6. [ ] Client can access /g/:slug — sees password gate
7. [ ] Client enters correct password — sees cover page then gallery grid
8. [ ] Client clicks image — lightbox opens with filename shown
9. [ ] Client clicks heart — email sign-in modal appears
10. [ ] After email sign-in — favourites dashboard loads
11. [ ] Client can toggle hearts on/off — photos add/remove from list
12. [ ] Client clicks "Send to Photographer" — admin gets SSE notification
13. [ ] Admin sees favourite activity — client email, filenames, timestamps, set names
14. [ ] Admin can export CSV of selected filenames
15. [ ] Download PIN gate works correctly
16. [ ] Mobile responsive — grid shows 2 columns, lightbox supports swipe
17. [ ] Gallery tab appears on project detail page when linked

---

## CRITICAL REMINDERS

1. Original filenames (like _MG_3442.jpg) must be preserved throughout — this is how the photographer matches selections in Capture One
2. Use EXISTING ObjectStorageService for all file operations — do NOT add Cloudflare R2 or any new storage
3. Follow EXISTING auth patterns — x-usena-user-id header for staff, token-based for clients
4. Follow EXISTING code style — same TypeScript patterns, same Drizzle ORM patterns, same shadcn/ui components
5. The client gallery page (/g/:slug) must work WITHOUT staff login — it uses its own auth (gallery password + token)
6. broadcastSSE is exported from server/routes.ts — import it, don't recreate it
7. The database tables may already exist (they were pushed via drizzle-kit push). The schema code must still be in schema.ts for Drizzle ORM to work, even if the tables already exist in the database.

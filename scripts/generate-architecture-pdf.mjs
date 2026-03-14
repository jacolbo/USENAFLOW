import PDFDocument from "pdfkit";
import fs from "fs";

const doc = new PDFDocument({ size: "A4", margin: 50 });
const outputPath = "USENA_Flow_Architecture.pdf";
doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  title: "#1a1a2e",
  heading: "#16213e",
  subheading: "#0f3460",
  text: "#333333",
  tableHeader: "#1a1a2e",
  tableHeaderText: "#ffffff",
  tableRow: "#f8f9fa",
  tableBorder: "#dee2e6",
  accent: "#e94560",
};

function addTitle(text) {
  doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.title).text(text, { align: "center" });
  doc.moveDown(0.3);
}

function addSubtitle(text) {
  doc.fontSize(12).font("Helvetica").fillColor(colors.text).text(text, { align: "center" });
  doc.moveDown(1.5);
}

function addHeading(text) {
  checkPageSpace(40);
  doc.moveDown(0.8);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(colors.heading).text(text);
  doc.moveDown(0.3);
  const y = doc.y;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(colors.accent).lineWidth(2).stroke();
  doc.moveDown(0.5);
}

function addSubHeading(text) {
  checkPageSpace(30);
  doc.moveDown(0.4);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(colors.subheading).text(text);
  doc.moveDown(0.3);
}

function addParagraph(text) {
  checkPageSpace(20);
  doc.fontSize(10).font("Helvetica").fillColor(colors.text).text(text, { lineGap: 3 });
  doc.moveDown(0.4);
}

function addBullet(text) {
  checkPageSpace(16);
  doc.fontSize(10).font("Helvetica").fillColor(colors.text);
  doc.text(`  \u2022  ${text}`, { indent: 10, lineGap: 2 });
  doc.moveDown(0.15);
}

function checkPageSpace(needed) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

function addTable(headers, rows, colWidths) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = 50;
  const cellPadding = 6;
  const fontSize = 9;

  checkPageSpace(30 + rows.length * 22);

  let y = doc.y;
  doc.rect(startX, y, tableWidth, 22).fill(colors.tableHeader);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fontSize(fontSize).font("Helvetica-Bold").fillColor(colors.tableHeaderText)
      .text(h, x + cellPadding, y + 5, { width: colWidths[i] - cellPadding * 2 });
    x += colWidths[i];
  });
  y += 22;

  rows.forEach((row, rowIdx) => {
    const rowTexts = row.map((cell, i) => {
      const h = doc.heightOfString(cell, { width: colWidths[i] - cellPadding * 2, fontSize });
      return h;
    });
    const rowHeight = Math.max(...rowTexts, 16) + 10;

    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
      doc.rect(startX, y, tableWidth, 22).fill(colors.tableHeader);
      let hx = startX;
      headers.forEach((h, i) => {
        doc.fontSize(fontSize).font("Helvetica-Bold").fillColor(colors.tableHeaderText)
          .text(h, hx + cellPadding, y + 5, { width: colWidths[i] - cellPadding * 2 });
        hx += colWidths[i];
      });
      y += 22;
    }

    if (rowIdx % 2 === 0) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(colors.tableRow);
    }

    x = startX;
    row.forEach((cell, i) => {
      doc.fontSize(fontSize).font("Helvetica").fillColor(colors.text)
        .text(cell, x + cellPadding, y + 5, { width: colWidths[i] - cellPadding * 2 });
      x += colWidths[i];
    });

    doc.moveTo(startX, y + rowHeight).lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor(colors.tableBorder).lineWidth(0.5).stroke();
    y += rowHeight;
  });

  doc.y = y + 8;
}

addTitle("USENA FLOW");
addSubtitle("Full System Architecture \u2014 Jepson Myles Studio");
doc.moveDown(0.5);
doc.fontSize(10).font("Helvetica").fillColor("#888").text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
doc.moveDown(1);

addHeading("Overview");
addParagraph("USENA Flow is a full-stack photography studio workflow management platform built for Jepson Myles Studio. It manages the complete lifecycle of a photo project \u2014 from client booking to final delivery \u2014 across an entire team with multiple roles. The system integrates Google Calendar, Google Drive, Gmail, AI-powered features, and automated email workflows to streamline operations.");

addHeading("Tech Stack");
addTable(
  ["Layer", "Technology"],
  [
    ["Frontend", "React 18 + TypeScript + Vite"],
    ["UI Components", "shadcn/ui (Radix UI) + Tailwind CSS"],
    ["Routing", "Wouter"],
    ["Server State", "TanStack Query v5"],
    ["Forms", "React Hook Form + Zod"],
    ["Backend", "Node.js + Express.js (TypeScript)"],
    ["Database", "PostgreSQL (Neon serverless) via Drizzle ORM"],
    ["Validation", "Zod schemas (shared between front and back)"],
    ["Real-time", "Server-Sent Events (SSE)"],
    ["Auth", "Role-based session auth + token-based client auth"],
  ],
  [140, 355]
);

addHeading("User Roles");
addTable(
  ["Role", "Description"],
  [
    ["Admin", "Full access \u2014 manages users, settings, templates, automations"],
    ["Sales", "Manages client communication, approves gallery deliveries"],
    ["Lead Retoucher", "Team lead, project assignment, quality oversight"],
    ["Retoucher", "Core editing workforce, rollover tracking, photo uploads"],
    ["Data Wrangler", "Handles shoot data, selects, project creation"],
    ["Finance", "Invoice and commission tracking"],
    ["Client", "Token-based access to their own chat only (no login)"],
  ],
  [120, 375]
);

addHeading("Database Tables");
addTable(
  ["Table", "Purpose"],
  [
    ["users", "Staff accounts with roles and credentials"],
    ["projects", "Core project records with 95+ fields covering every lifecycle stage"],
    ["shoottracker_meta", "1:1 with projects \u2014 calendar sync config, turnaround, holidays"],
    ["project_notes", "Text and image notes attached to projects"],
    ["project_events", "Audit trail of rollovers, completions, assignments"],
    ["trade_offers", "Retouchers swapping projects with each other"],
    ["wrangler_commissions", "1.5% commission tracking per wrangler on extras"],
    ["complaints", "Retoucher issue reports with image attachments"],
    ["client_messages", "WhatsApp-style chat messages per project"],
    ["client_auth_tokens", "Time-limited tokens for client chat access"],
    ["chat_encryption_keys", "End-to-end encryption keys per project chat"],
    ["email_logs", "Full log of every email sent through the system"],
    ["calendar_events_staging", "Google Calendar events pending promotion to projects"],
    ["app_settings", "Key-value config store (schedules, toggles, templates)"],
    ["ai_memories", "Persistent AI learning memories across interactions"],
    ["ai_directives", "Admin instructions injected into AI prompts"],
    ["leave_requests", "Staff leave requests with AI-powered approval"],
    ["rewards / referrals", "Client loyalty tiers and referral tracking"],
    ["speed_records", "Timestamps at each status transition for turnaround analytics"],
  ],
  [160, 335]
);

addHeading("Backend Services");
addTable(
  ["Service", "Purpose"],
  [
    ["emailService", "All branded emails via Resend \u2014 delivery, extras, surveys, referrals, delay notices, chat links"],
    ["aiService", "OpenAI integration \u2014 chat replies, coaching, risk prediction, workload forecast, quality reviews"],
    ["aiMemoryService", "Stores and retrieves AI learning memories, scored by importance"],
    ["dataLearningService", "Scans all data sources and extracts AI observations on demand"],
    ["automationRegistry", "Central registry of all automations \u2014 enable/disable toggles, activity logs"],
    ["shoottrackerEngine", "Calendar event parsing, project creation, due date calculation"],
    ["calendarSync", "Google Calendar polling and event staging"],
    ["googleCalendar", "Google Calendar API wrapper"],
    ["googleDriveService", "Creates client folders, monitors uploads, generates gallery links"],
    ["driveMonitorService", "Background watcher \u2014 detects when photos land in Drive, triggers delivery"],
    ["gmailService", "Gmail API wrapper for sending and reading email threads"],
    ["gmailReplyMonitor", "Monitors Gmail for client replies and routes them into chat"],
    ["emailQueue", "Queued email processing to prevent rate limit issues"],
    ["chatAutoResponder", "Sends automated comfort messages when team is offline"],
    ["rewardsEngine", "Calculates VIP tiers, bonus photos, referral rewards per client"],
    ["riskCalculator", "Scores each project as SAFE / AT_RISK / OVERDUE"],
    ["delayNotificationScheduler", "Sends scheduled delay alert emails to clients"],
    ["morningCheckScheduler", "Daily scan \u2014 risk updates, upcoming deadline alerts"],
    ["defaultEmailTemplates", "All base email templates with variable placeholders"],
    ["icsCalendar", "Generates ICS calendar files for shoot date confirmations"],
  ],
  [155, 340]
);

addHeading("Background Schedulers");
addTable(
  ["Scheduler", "Trigger"],
  [
    ["autoSyncScheduler", "Polls Google Calendar on a configurable interval"],
    ["rolloverScheduler", "Handles daily project rollover (currently manual-only mode)"],
    ["morningCheckScheduler", "Runs once daily at start of business"],
    ["delayNotificationScheduler", "Runs on a set cadence to send delay warnings"],
    ["driveMonitorService", "Continuously polls Drive folders for new uploads"],
    ["gmailReplyMonitor", "Polls Gmail for client email replies"],
  ],
  [180, 315]
);

addHeading("Frontend Pages");
addTable(
  ["Route", "Purpose"],
  [
    ["/", "Main dashboard \u2014 project cards, calendar, analytics, widgets"],
    ["/editor-chat", "Internal team-facing chat view per project"],
    ["/client-chat", "Token-authenticated client chat (PWA)"],
    ["/ai-team-chat", "AI-powered team Q&A chat (admin + retouchers)"],
    ["/ai-brain", "Admin panel for AI directives and memories"],
    ["/automations", "Visual hub for all system automations with logs"],
    ["/shoottracker-settings", "Google Calendar sync, turnaround config, holiday setup"],
    ["/leave-management", "Staff leave requests with AI workload-based approval"],
    ["/approve-extras", "Token-gated page for clients to approve extra charges"],
    ["/survey", "Post-delivery satisfaction survey"],
    ["/referral", "Client referral reward landing page"],
  ],
  [150, 345]
);

addHeading("Key System Flows");

addSubHeading("Project Lifecycle");
addParagraph("New booking \u2192 ShootTracker syncs from Google Calendar \u2192 staged as event \u2192 promoted to project \u2192 assigned to retoucher \u2192 photos uploaded to Drive \u2192 Drive monitor detects completion \u2192 Sales approves gallery \u2192 branded delivery email sent to client \u2192 satisfaction survey triggered \u2192 rewards calculated.");

addSubHeading("Client Communication");
addParagraph("Project created \u2192 chat link generated \u2192 client gets email with secure token link \u2192 client and editor exchange messages in real-time (SSE) \u2192 end-to-end encrypted \u2192 if team offline, auto-responder sends comfort message \u2192 Gmail replies also routed into chat.");

addSubHeading("AI Layer");
addParagraph("Every AI action reads active directives (admin rules) + relevant memories (past learnings) before generating a response. After each interaction, new observations are extracted and saved back to memory, scoring importance 1\u201310. Low-importance memories are pruned automatically.");

addSubHeading("Rewards Engine");
addParagraph("Client project count \u2192 VIP tier (Bronze/Silver/Gold/Platinum) \u2192 bonus photos unlocked \u2192 referral codes issued \u2192 referral bookings tracked \u2192 commission credited to wrangler.");

addHeading("External Integrations");
addTable(
  ["Integration", "Purpose"],
  [
    ["Google Calendar", "Shoot booking sync \u2192 project auto-creation"],
    ["Google Drive", "Photo delivery folder creation and monitoring"],
    ["Gmail", "Branded email sending + reply monitoring"],
    ["Resend", "Transactional email delivery"],
    ["OpenAI", "All AI features (GPT-4 vision + text)"],
    ["Object Storage", "Chat attachments, sneak peek photos, note images"],
  ],
  [140, 355]
);

doc.moveDown(2);
doc.fontSize(8).font("Helvetica").fillColor("#aaa")
  .text("USENA Flow Architecture Document \u2014 Jepson Myles Studio \u2014 Confidential", { align: "center" });

doc.end();
console.log(`PDF generated: ${outputPath}`);

export type AutomationType = 'background' | 'drive_monitor' | 'ai_powered' | 'communication' | 'data_triggered' | 'user_action' | 'ui_action';

export type AutomationCategory = 
  | 'Scheduled Processes'
  | 'Drive Monitor'
  | 'AI Features'
  | 'Communication'
  | 'Data & Calculation'
  | 'Project Management'
  | 'Delivery & Gallery'
  | 'Team Management'
  | 'Dashboard & Settings'
  | 'Client-Facing'
  | 'Chat & Messaging'
  | 'Rewards & Referrals';

export interface AutomationEntry {
  id: string;
  name: string;
  description: string;
  type: AutomationType;
  category: AutomationCategory;
  trigger: string;
  actions: string[];
  connectsTo: string[];
  enabled: boolean;
  lastFired?: Date;
  fireCount: number;
  apiRoute?: string;
  roles?: string[];
}

const automations: Map<string, AutomationEntry> = new Map();
const activityLog: Array<{ automationId: string; timestamp: Date; details: string }> = [];
const MAX_LOG_ENTRIES = 500;

function register(entry: Omit<AutomationEntry, 'fireCount' | 'enabled'> & { enabled?: boolean }) {
  automations.set(entry.id, { ...entry, fireCount: 0, enabled: entry.enabled !== false });
}

export function getAutomation(id: string): AutomationEntry | undefined {
  return automations.get(id);
}

export function getAllAutomations(): AutomationEntry[] {
  return Array.from(automations.values());
}

export function isEnabled(id: string): boolean {
  const a = automations.get(id);
  return a ? a.enabled : true;
}

export function setEnabled(id: string, enabled: boolean): boolean {
  const a = automations.get(id);
  if (!a) return false;
  a.enabled = enabled;
  logActivity(id, enabled ? 'Enabled' : 'Disabled');
  return true;
}

export function recordFired(id: string, details?: string) {
  const a = automations.get(id);
  if (a) {
    a.lastFired = new Date();
    a.fireCount++;
    logActivity(id, details || 'Fired');
  }
}

function logActivity(automationId: string, details: string) {
  activityLog.unshift({ automationId, timestamp: new Date(), details });
  if (activityLog.length > MAX_LOG_ENTRIES) {
    activityLog.length = MAX_LOG_ENTRIES;
  }
}

export function getActivityLog(automationId?: string, limit = 50): typeof activityLog {
  const filtered = automationId 
    ? activityLog.filter(l => l.automationId === automationId)
    : activityLog;
  return filtered.slice(0, limit);
}

export function getStats() {
  const all = getAllAutomations();
  return {
    total: all.length,
    enabled: all.filter(a => a.enabled).length,
    disabled: all.filter(a => !a.enabled).length,
    byType: {
      background: all.filter(a => a.type === 'background').length,
      drive_monitor: all.filter(a => a.type === 'drive_monitor').length,
      ai_powered: all.filter(a => a.type === 'ai_powered').length,
      communication: all.filter(a => a.type === 'communication').length,
      data_triggered: all.filter(a => a.type === 'data_triggered').length,
      user_action: all.filter(a => a.type === 'user_action').length,
      ui_action: all.filter(a => a.type === 'ui_action').length,
    },
    byCategory: Object.fromEntries(
      Array.from(new Set(all.map(a => a.category))).map(cat => [cat, all.filter(a => a.category === cat).length])
    ),
    recentActivity: activityLog.slice(0, 10),
  };
}

// ========================================
// REGISTER ALL AUTOMATIONS
// ========================================

// --- SCHEDULED BACKGROUND PROCESSES ---
register({
  id: 'bg_drive_monitor',
  name: 'Drive Monitor Scanner',
  description: 'Scans Google Drive folders every 2 minutes to detect photo uploads, count matches, and public folder status',
  type: 'background',
  category: 'Scheduled Processes',
  trigger: 'Every 2 minutes (interval)',
  actions: ['Scan project Drive folders', 'Count uploaded photos', 'Check B&W subfolder', 'Detect public folder status'],
  connectsTo: ['dm_detect_upload', 'dm_detect_public', 'dm_bw_detect', 'dm_gallery_link'],
});

register({
  id: 'bg_shoottracker_sync',
  name: 'ShootTracker Calendar Sync',
  description: 'Checks Google Calendar every 60 seconds for new bookings and creates projects automatically',
  type: 'background',
  category: 'Scheduled Processes',
  trigger: 'Every 60 seconds (interval)',
  actions: ['Fetch Google Calendar events', 'Create projects from bookings', 'Calculate delivery dates', 'Assess risk levels'],
  connectsTo: ['data_due_date_calc', 'data_risk_assessment', 'dm_folder_create'],
});

register({
  id: 'bg_thursday_delay',
  name: 'Thursday Morning Delay Alerts',
  description: 'Checks every minute and fires on Thursday mornings (8-9 AM) to notify about unassigned projects',
  type: 'background',
  category: 'Scheduled Processes',
  trigger: 'Thursday mornings 8-9 AM',
  actions: ['Check for unassigned projects', 'Send delay notifications to Data Wrangler'],
  connectsTo: ['comm_delay_notice'],
});

register({
  id: 'bg_morning_check',
  name: 'Weekday Morning AI Check',
  description: 'Runs on weekday mornings (9:00-9:59 AM) for daily operational health checks',
  type: 'background',
  category: 'Scheduled Processes',
  trigger: 'Weekday mornings 9:00-9:59 AM',
  actions: ['Run AI operational analysis', 'Check project backlogs', 'Identify at-risk items'],
  connectsTo: ['ai_insights'],
});

// --- DRIVE MONITOR TRIGGERED ---
register({
  id: 'dm_detect_upload',
  name: 'Upload Completion Detection',
  description: 'Detects when photo count matches selectedCount in Drive folder',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Drive Monitor detects photoCount === selectedCount',
  actions: ['Mark photos ready', 'Update drive photo count', 'Trigger preview email', 'Trigger AI quality gate'],
  connectsTo: ['dm_preview_email', 'ai_quality_gate'],
});

register({
  id: 'dm_preview_email',
  name: 'Preview Email (Photos Ready)',
  description: 'Sends branded email to client saying photos are ready (folder still private, no access yet)',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Upload complete detected + no preview email sent yet',
  actions: ['Send branded preview email to client', 'Record drivePreviewEmailSent'],
  connectsTo: ['ai_email_variation'],
});

register({
  id: 'dm_detect_public',
  name: 'Public Folder Detection',
  description: 'Detects when admin has manually made the Google Drive folder public — triggers full delivery',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Drive Monitor detects folder is public + preview email was sent',
  actions: ['Send delivery email with access', 'Create referral code', 'Send satisfaction survey', 'Mark project Delivered', 'Record status transition'],
  connectsTo: ['dm_delivery_email', 'reward_referral_create', 'dm_survey_send', 'data_status_transition'],
});

register({
  id: 'dm_delivery_email',
  name: 'Delivery Email (With Access)',
  description: 'Sends delivery email with gallery link after folder is detected as public',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Public folder detected',
  actions: ['Send branded delivery email with gallery link and referral code'],
  connectsTo: ['ai_email_variation'],
});

register({
  id: 'dm_survey_send',
  name: 'Satisfaction Survey Auto-Send',
  description: 'Automatically sends satisfaction survey email after delivery',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Project delivered via auto-detection',
  actions: ['Create survey token', 'Send survey email to client'],
  connectsTo: ['ai_email_variation'],
});

register({
  id: 'dm_gallery_link',
  name: 'Gallery Link Generation',
  description: 'Generates shareable gallery link from Google Drive folder',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Drive Monitor scan finds folder without gallery link',
  actions: ['Generate share link from Drive', 'Store gallery link on project'],
  connectsTo: ['dm_preview_email', 'dm_delivery_email'],
});

register({
  id: 'dm_bw_detect',
  name: 'B&W Photo Detection',
  description: 'Detects black & white photos in the B&W subfolder',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Drive Monitor scan finds files in B&W subfolder',
  actions: ['Count B&W photos', 'Update project B&W count'],
  connectsTo: [],
});

register({
  id: 'dm_folder_create',
  name: 'Drive Folder Auto-Creation',
  description: 'Creates organized client folders with B&W subfolder when projects are created',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Project created (manual or ShootTracker)',
  actions: ['Create ClientName(photoCount) folder', 'Create Black and White subfolder', 'Store folder ID on project'],
  connectsTo: ['bg_drive_monitor'],
});

register({
  id: 'dm_storage_tracking',
  name: 'Storage Tracking',
  description: 'Tracks Drive storage usage per project',
  type: 'drive_monitor',
  category: 'Drive Monitor',
  trigger: 'Drive Monitor scan',
  actions: ['Calculate folder size', 'Update storage metrics'],
  connectsTo: [],
});

// --- AI-POWERED AUTOMATIONS ---
register({
  id: 'ai_quality_gate',
  name: 'AI Quality Gate',
  description: 'Non-blocking AI photo review when upload is complete. Sends feedback to retoucher if quality fails. Does NOT block delivery.',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Upload complete detected by Drive Monitor',
  actions: ['Sample up to 6 thumbnails', 'AI vision analysis (gpt-4o)', 'Score quality (threshold 7/10)', 'Send feedback to retoucher via AI chat if failed'],
  connectsTo: ['ai_quality_feedback', 'ai_quality_reset'],
  apiRoute: '/api/ai/quality-gate',
});

register({
  id: 'ai_quality_feedback',
  name: 'AI Quality Feedback to Retoucher',
  description: 'When quality gate fails, AI sends personalized feedback to the assigned retoucher via AI team chat',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Quality gate score below threshold',
  actions: ['Generate personalized feedback message', 'Send message via AI team chat'],
  connectsTo: [],
});

register({
  id: 'ai_quality_reset',
  name: 'Quality Gate Auto-Reset',
  description: 'When retoucher re-uploads (photo count changes after quality failure), quality gate resets for re-check',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Photo count changes after quality gate ran',
  actions: ['Reset quality gate fields', 'Allow re-evaluation on next scan'],
  connectsTo: ['ai_quality_gate'],
});

register({
  id: 'ai_email_variation',
  name: 'AI Email Text Variation',
  description: 'Every outgoing client email is rephrased by AI so no two clients receive identical wording',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Any client email is about to be sent',
  actions: ['Rephrase email with gpt-4o-mini', 'Preserve links, variables, proper nouns', 'Fall back to original on error'],
  connectsTo: [],
});

register({
  id: 'ai_insights',
  name: 'Smart Insights Widget',
  description: 'Dashboard widget generating 4-6 AI-powered trend observations from project data',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Dashboard load or manual refresh',
  actions: ['Aggregate project data', 'Generate AI trend observations'],
  connectsTo: [],
  apiRoute: '/api/ai/insights',
  roles: ['Admin', 'LeadRetoucher', 'DataWrangler', 'Sales'],
});

register({
  id: 'ai_retoucher_coach',
  name: 'AI Retoucher Coach',
  description: 'Personalized performance tips and encouragement for retouchers based on their stats',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Dashboard load or manual refresh',
  actions: ['Analyze retoucher performance', 'Generate personalized tips'],
  connectsTo: [],
  apiRoute: '/api/ai/retoucher-advice/:retoucherName',
  roles: ['Retoucher1', 'Retoucher2', 'Retoucher3'],
});

register({
  id: 'ai_photo_review',
  name: 'AI Photo Review',
  description: 'Admin-triggered AI vision analysis on project photos evaluating retouching quality',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Admin clicks review button in Drive Manager',
  actions: ['Sample thumbnails from Drive', 'Evaluate skin, hair, color, exposure, composition', 'Return per-photo scores'],
  connectsTo: [],
  apiRoute: '/api/ai/review-photos',
  roles: ['Admin'],
});

register({
  id: 'ai_reply_assistant',
  name: 'Chat Reply Assistant',
  description: 'AI-suggested replies or message polishing in editor chat',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'User clicks magic wand button in chat',
  actions: ['Analyze conversation context (last 5 messages)', 'Generate suggested reply or polish draft'],
  connectsTo: [],
  apiRoute: '/api/ai/suggest-reply',
});

register({
  id: 'ai_workload_forecast',
  name: 'Workload Forecast',
  description: 'AI capacity forecast for upcoming 4-6 weeks based on projects, team, backlog, and leave',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Dashboard load or manual refresh',
  actions: ['Analyze upcoming projects', 'Check team capacity and leave', 'Generate weekly load forecast with risk levels'],
  connectsTo: [],
  apiRoute: '/api/ai/workload-forecast',
  roles: ['Admin', 'LeadRetoucher'],
});

register({
  id: 'ai_predictive_risk',
  name: 'Predictive Risk Alerts',
  description: 'AI predicts which projects are likely to go overdue before deadlines based on retoucher performance history',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Dashboard load or manual refresh',
  actions: ['Analyze active projects vs retoucher speed stats', 'Predict overdue risk scores', 'Show risk factors and recommendations'],
  connectsTo: [],
  apiRoute: '/api/ai/predictive-risk',
  roles: ['Admin', 'LeadRetoucher'],
});

register({
  id: 'ai_leave_evaluation',
  name: 'AI Leave Request Evaluation',
  description: 'AI evaluates leave requests — sick leave always approved, others checked against backlog and team availability',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Leave request submitted',
  actions: ['Check leave type', 'Analyze team backlog', 'Check concurrent leave', 'Approve or deny with reason'],
  connectsTo: [],
});

register({
  id: 'ai_team_chat',
  name: 'AI Team Chat',
  description: 'Two-way AI chat where admin asks about work/performance and retouchers explain delays',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'User sends message in AI chat',
  actions: ['Process query using project data', 'Reference retouching guidelines', 'Forward retoucher explanations to admin'],
  connectsTo: [],
  apiRoute: '/api/ai-chat',
});

register({
  id: 'ai_daily_summary',
  name: 'AI Daily Summary',
  description: 'Consolidated daily report for admin summarizing team work, delays, and project status',
  type: 'ai_powered',
  category: 'AI Features',
  trigger: 'Admin clicks Daily Summary button',
  actions: ['Aggregate all project and team data', 'Generate consolidated report'],
  connectsTo: [],
});

// --- COMMUNICATION AUTOMATIONS ---
register({
  id: 'comm_after_hours_reply',
  name: 'After-Hours Auto-Reply',
  description: 'Automatic response in client chat outside Mon-Fri 9AM-4PM business hours',
  type: 'communication',
  category: 'Communication',
  trigger: 'Client sends message outside business hours',
  actions: ['Send automatic acknowledgment with business hours info'],
  connectsTo: [],
});

register({
  id: 'comm_delayed_ack',
  name: '30-Minute Delayed Acknowledgment',
  description: 'If a client message goes unanswered for 30 minutes, an automatic acknowledgment is sent',
  type: 'communication',
  category: 'Communication',
  trigger: '30 minutes after unanswered client message',
  actions: ['Send automatic acknowledgment message', 'Show estimated response time'],
  connectsTo: [],
});

register({
  id: 'comm_push_notification',
  name: 'Push Notifications',
  description: 'Send push notification to client phone when retoucher sends a chat message',
  type: 'communication',
  category: 'Communication',
  trigger: 'Retoucher sends message in editor chat',
  actions: ['Send Web Push notification to client device', 'Auto-clean expired subscriptions'],
  connectsTo: [],
});

register({
  id: 'comm_seen_indicators',
  name: 'Seen/Read Indicators',
  description: 'Track and display when messages are seen/read by recipients',
  type: 'communication',
  category: 'Communication',
  trigger: 'Recipient opens/reads a message',
  actions: ['Mark message as seen', 'Update read timestamp', 'Show indicator to sender'],
  connectsTo: [],
});

register({
  id: 'comm_status_auto_msg',
  name: 'Project Status Auto-Messages',
  description: 'Automatic chat messages when project status changes',
  type: 'communication',
  category: 'Communication',
  trigger: 'Project status changes',
  actions: ['Send status update message in client chat thread'],
  connectsTo: [],
});

register({
  id: 'comm_delay_notice',
  name: 'Delay Notice Email',
  description: 'Send client scheduling notification when project due date is updated',
  type: 'communication',
  category: 'Communication',
  trigger: 'Project due date updated or delay detected',
  actions: ['Send branded delay notification email to client'],
  connectsTo: ['ai_email_variation'],
  apiRoute: '/api/projects/:id/send-delay-notice',
});

// --- DATA & CALCULATION AUTOMATIONS ---
register({
  id: 'data_due_date_calc',
  name: 'Due Date Auto-Calculation',
  description: 'Automatically calculates delivery due dates based on turnaround settings and working days',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'Project created or shoot date set',
  actions: ['Calculate due date from turnaround settings', 'Account for working days and holidays'],
  connectsTo: ['data_risk_assessment'],
});

register({
  id: 'data_extras_calc',
  name: 'Extras Calculation',
  description: 'Automatically calculates extra photo charges based on photo count vs package',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'Photo count exceeds package count',
  actions: ['Calculate extras count', 'Calculate extra charges'],
  connectsTo: [],
});

register({
  id: 'data_vip_tiers',
  name: 'VIP Tier Calculation',
  description: 'Automated loyalty tiers based on project count with bonus photos and priority services',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'Project completed or client data changes',
  actions: ['Count client projects', 'Calculate tier level', 'Apply bonus photos'],
  connectsTo: [],
});

register({
  id: 'data_referral_match',
  name: 'Referral Auto-Matching',
  description: 'Matches referred clients by email (fallback to name) and credits 5 bonus photos',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'New referral submission via landing page',
  actions: ['Match by email (primary key)', 'Fallback to name match', 'Credit 5 bonus photos on match'],
  connectsTo: [],
});

register({
  id: 'data_risk_assessment',
  name: 'Risk Level Assessment',
  description: 'Assesses project risk levels (SAFE, AT_RISK, OVERDUE) based on dates and progress',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'ShootTracker sync or project update',
  actions: ['Compare due date vs current date', 'Check assignment status', 'Set risk level'],
  connectsTo: [],
});

register({
  id: 'data_status_transition',
  name: 'Status Transition Recording',
  description: 'Records timestamps at each project status change for speed tracking',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'Project status changes',
  actions: ['Record transition timestamp', 'Calculate turnaround time', 'Update speed stats'],
  connectsTo: [],
  apiRoute: '/api/speed-stats',
});

register({
  id: 'data_push_cleanup',
  name: 'Push Subscription Auto-Cleanup',
  description: 'Automatically cleans expired push notification subscriptions',
  type: 'data_triggered',
  category: 'Data & Calculation',
  trigger: 'Push notification fails to send',
  actions: ['Detect expired subscription', 'Remove from database'],
  connectsTo: [],
});

register({
  id: 'reward_referral_create',
  name: 'Referral Code Creation',
  description: 'Automatically creates referral code when project is delivered',
  type: 'data_triggered',
  category: 'Rewards & Referrals',
  trigger: 'Project delivery completed',
  actions: ['Generate unique referral code', 'Create referral record', 'Include code in delivery email'],
  connectsTo: ['data_referral_match'],
});

register({
  id: 'reward_scoring',
  name: 'Rewards Score Calculation',
  description: 'Calculates reward scores/tiers per client from calendar history and referral matches',
  type: 'data_triggered',
  category: 'Rewards & Referrals',
  trigger: 'Rewards sync triggered',
  actions: ['Pull calendar history (up to 2 years)', 'Count bookings (1 pt each)', 'Count matched referrals (2 pts each)', 'Calculate tier'],
  connectsTo: [],
  apiRoute: '/api/rewards/sync',
});

// --- USER ACTIONS (Project Management) ---
register({
  id: 'ua_create_project',
  name: 'Create Project',
  description: 'Create a new project with client details, package, and dates',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User submits new project form',
  actions: ['Create project record', 'Calculate extras', 'Create Drive folder'],
  connectsTo: ['data_extras_calc', 'dm_folder_create', 'data_due_date_calc'],
  apiRoute: '/api/projects',
  roles: ['Admin', 'Sales', 'DataWrangler'],
});

register({
  id: 'ua_edit_project',
  name: 'Edit Project',
  description: 'Update project details like client name, counts, dates',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User edits project details',
  actions: ['Update project record', 'Recalculate extras if needed'],
  connectsTo: ['data_extras_calc'],
  apiRoute: '/api/projects/:id',
});

register({
  id: 'ua_change_status',
  name: 'Change Project Status',
  description: 'Move project through status workflow (Awaiting Payment → Ready → Assigned → Review → Delivered)',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User changes project status',
  actions: ['Update status', 'Record status transition', 'Send status chat message'],
  connectsTo: ['data_status_transition', 'comm_status_auto_msg'],
  apiRoute: '/api/projects/:id',
});

register({
  id: 'ua_assign_retoucher',
  name: 'Assign Retoucher',
  description: 'Assign a retoucher to a project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User assigns retoucher (button or double-click on calendar)',
  actions: ['Update assignedTo field', 'Record status transition'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/assign',
});

register({
  id: 'ua_mark_paid',
  name: 'Mark Invoice Paid',
  description: 'Mark project invoice as paid to move from Awaiting Payment to Ready',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks mark paid button',
  actions: ['Set invoicePaid to true', 'Update status to Ready'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/mark-paid',
});

register({
  id: 'ua_mark_done',
  name: 'Mark Project Done',
  description: 'Mark project as completed',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks done button',
  actions: ['Update status', 'Record completion timestamp'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/mark-done',
});

register({
  id: 'ua_rollback_status',
  name: 'Rollback Project Status',
  description: 'Roll back project to previous status',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks rollback button',
  actions: ['Revert to previous status', 'Record transition'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/rollback',
});

register({
  id: 'ua_rollover',
  name: 'Rollover Project',
  description: 'Roll over incomplete project to next week with shadow tracking',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks rollover button',
  actions: ['Create shadow project', 'Track remaining photos', 'Update rollover count'],
  connectsTo: [],
  apiRoute: '/api/projects/:id/rollover',
});

register({
  id: 'ua_request_revision',
  name: 'Request Revision',
  description: 'Request revision on a project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks request revision',
  actions: ['Update project status', 'Notify retoucher'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/request-revision',
});

register({
  id: 'ua_request_corrections',
  name: 'Request Corrections',
  description: 'Request corrections on project photos',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks request corrections',
  actions: ['Update project status', 'Notify retoucher'],
  connectsTo: ['data_status_transition'],
  apiRoute: '/api/projects/:id/request-corrections',
});

register({
  id: 'ua_set_rating',
  name: 'Set Quality Rating',
  description: 'Rate project quality after completion',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User sets rating on project',
  actions: ['Update project rating'],
  connectsTo: [],
  apiRoute: '/api/projects/:id/rating',
});

register({
  id: 'ua_duplicate_project',
  name: 'Duplicate Project',
  description: 'Create a copy of an existing project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks duplicate button',
  actions: ['Copy project data', 'Create new project'],
  connectsTo: ['ua_create_project'],
  apiRoute: '/api/projects/:id/duplicate',
});

register({
  id: 'ua_delete_project',
  name: 'Delete Project',
  description: 'Remove a project from the system',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks delete button',
  actions: ['Delete project record', 'Clean up related data'],
  connectsTo: [],
  apiRoute: '/api/projects/:id',
});

register({
  id: 'ua_update_photos_completed',
  name: 'Update Photos Completed',
  description: 'Track how many photos have been completed by the retoucher',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User updates photos completed count',
  actions: ['Update photosCompleted field'],
  connectsTo: [],
  apiRoute: '/api/projects/:id/photos-completed',
});

// --- DELIVERY & GALLERY ---
register({
  id: 'ua_add_gallery_link',
  name: 'Add Gallery Link',
  description: 'Manually add or update gallery link for a project',
  type: 'user_action',
  category: 'Delivery & Gallery',
  trigger: 'User enters gallery link',
  actions: ['Update gallery link on project'],
  connectsTo: [],
  apiRoute: '/api/projects/:id/gallery-link',
});

register({
  id: 'ua_approve_delivery',
  name: 'Approve Delivery',
  description: 'Sales approves project delivery, triggering client email and status update',
  type: 'user_action',
  category: 'Delivery & Gallery',
  trigger: 'Sales clicks approve delivery',
  actions: ['Send delivery email', 'Create referral code', 'Send survey', 'Update status to Delivered'],
  connectsTo: ['dm_delivery_email', 'reward_referral_create', 'dm_survey_send', 'data_status_transition'],
  apiRoute: '/api/projects/:id/approve-delivery',
  roles: ['Sales', 'Admin'],
});

register({
  id: 'ua_send_sneak_peek',
  name: 'Send Sneak Peek',
  description: 'Retoucher sends preview photos to clients before full delivery',
  type: 'user_action',
  category: 'Delivery & Gallery',
  trigger: 'Retoucher clicks send sneak peek',
  actions: ['Upload preview images', 'Send branded sneak peek email'],
  connectsTo: ['ai_email_variation'],
  apiRoute: '/api/projects/:id/sneak-peeks/:peekId/send',
});

register({
  id: 'ua_quality_override',
  name: 'Quality Gate Override',
  description: 'Admin overrides AI quality gate decision',
  type: 'user_action',
  category: 'Delivery & Gallery',
  trigger: 'Admin clicks override button',
  actions: ['Override quality gate decision', 'Record override'],
  connectsTo: [],
  apiRoute: '/api/ai/quality-gate/override',
  roles: ['Admin'],
});

register({
  id: 'ua_upload_reference',
  name: 'Upload Reference Images',
  description: 'Upload Instagram/portfolio URLs as quality benchmarks for AI',
  type: 'user_action',
  category: 'Delivery & Gallery',
  trigger: 'Admin adds reference image URL',
  actions: ['Store reference image URL', 'Use as AI quality benchmark'],
  connectsTo: ['ai_quality_gate'],
  apiRoute: '/api/quality-reference-images/add',
  roles: ['Admin'],
});

// --- TEAM MANAGEMENT ---
register({
  id: 'ua_create_user',
  name: 'Create User Account',
  description: 'Admin creates new user accounts with role assignment',
  type: 'user_action',
  category: 'Team Management',
  trigger: 'Admin submits user creation form',
  actions: ['Create user record', 'Assign role'],
  connectsTo: [],
  apiRoute: '/api/users',
  roles: ['Admin'],
});

register({
  id: 'ua_edit_user',
  name: 'Edit User Account',
  description: 'Update user details or role',
  type: 'user_action',
  category: 'Team Management',
  trigger: 'Admin edits user',
  actions: ['Update user record'],
  connectsTo: [],
  apiRoute: '/api/users/:id',
  roles: ['Admin'],
});

register({
  id: 'ua_delete_user',
  name: 'Delete User Account',
  description: 'Remove a user account from the system',
  type: 'user_action',
  category: 'Team Management',
  trigger: 'Admin clicks delete user',
  actions: ['Delete user record'],
  connectsTo: [],
  apiRoute: '/api/users/:id',
  roles: ['Admin'],
});

register({
  id: 'ua_submit_leave',
  name: 'Submit Leave Request',
  description: 'Team member submits leave request for AI evaluation',
  type: 'user_action',
  category: 'Team Management',
  trigger: 'User submits leave request form',
  actions: ['Create leave request', 'Trigger AI evaluation'],
  connectsTo: ['ai_leave_evaluation'],
});

register({
  id: 'ua_override_leave',
  name: 'Override Leave Decision',
  description: 'Admin overrides AI leave approval/denial',
  type: 'user_action',
  category: 'Team Management',
  trigger: 'Admin clicks approve/deny override',
  actions: ['Override AI decision', 'Update leave status'],
  connectsTo: [],
  roles: ['Admin'],
});

// --- DASHBOARD & SETTINGS ---
register({
  id: 'ua_reorder_widgets',
  name: 'Reorder Dashboard Widgets',
  description: 'Drag and drop dashboard widgets to customize layout',
  type: 'ui_action',
  category: 'Dashboard & Settings',
  trigger: 'User drags widget to new position',
  actions: ['Update widget order', 'Save preferences'],
  connectsTo: [],
  apiRoute: '/api/dashboard/preferences/:userId',
});

register({
  id: 'ua_toggle_theme',
  name: 'Toggle Light/Dark Mode',
  description: 'Switch between light and dark theme',
  type: 'ui_action',
  category: 'Dashboard & Settings',
  trigger: 'User clicks theme toggle',
  actions: ['Switch theme', 'Save preference'],
  connectsTo: [],
});

register({
  id: 'ua_edit_email_template',
  name: 'Edit Email Templates',
  description: 'Customize email templates with live preview and variable placeholders',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin edits template in editor',
  actions: ['Update template in database', 'Preview with variables'],
  connectsTo: [],
  apiRoute: '/api/admin/email-templates/:key',
  roles: ['Admin'],
});

register({
  id: 'ua_update_shoottracker',
  name: 'Update ShootTracker Settings',
  description: 'Configure turnaround times, working days, and daily capacity',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin updates settings form',
  actions: ['Update turnaround times', 'Update working days config', 'Update daily capacity'],
  connectsTo: ['bg_shoottracker_sync'],
  roles: ['Admin'],
});

register({
  id: 'ua_update_guidelines',
  name: 'Update Retouching Guidelines',
  description: 'Update studio retouching guidelines used by AI in team communications',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin updates guidelines text',
  actions: ['Store guidelines in app_settings', 'AI references in future communications'],
  connectsTo: ['ai_team_chat', 'ai_quality_gate'],
  roles: ['Admin'],
});

register({
  id: 'ua_quality_settings',
  name: 'Configure Quality Gate Settings',
  description: 'Configure quality gate threshold and settings',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin updates quality settings',
  actions: ['Update quality gate threshold', 'Store in app_settings'],
  connectsTo: ['ai_quality_gate'],
  roles: ['Admin'],
});

register({
  id: 'ua_manual_sync',
  name: 'Manual Calendar Sync',
  description: 'Manually trigger ShootTracker calendar sync',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin clicks sync button',
  actions: ['Fetch calendar events', 'Create/update projects'],
  connectsTo: ['bg_shoottracker_sync'],
  apiRoute: '/api/admin/sync-calendar',
  roles: ['Admin'],
});

register({
  id: 'ua_upload_logo',
  name: 'Upload Logo',
  description: 'Upload custom logo for branded emails',
  type: 'user_action',
  category: 'Dashboard & Settings',
  trigger: 'Admin uploads logo file',
  actions: ['Store logo in object storage', 'Use in email templates'],
  connectsTo: [],
  apiRoute: '/api/admin/upload-logo',
  roles: ['Admin'],
});

// --- CLIENT-FACING ---
register({
  id: 'ua_client_send_msg',
  name: 'Client Sends Chat Message',
  description: 'Client sends a message in the chat interface',
  type: 'user_action',
  category: 'Client-Facing',
  trigger: 'Client types and sends message',
  actions: ['Store message', 'Notify retoucher', 'Check business hours for auto-reply'],
  connectsTo: ['comm_after_hours_reply', 'comm_delayed_ack'],
});

register({
  id: 'ua_client_survey',
  name: 'Client Submits Survey',
  description: 'Client fills and submits satisfaction survey',
  type: 'user_action',
  category: 'Client-Facing',
  trigger: 'Client submits survey form',
  actions: ['Store survey response', 'Prompt for Google review if high rating'],
  connectsTo: [],
  apiRoute: '/api/survey/:token',
});

register({
  id: 'ua_client_referral',
  name: 'Client Enters Referral',
  description: 'Referred client enters their name and email on landing page',
  type: 'user_action',
  category: 'Client-Facing',
  trigger: 'Client submits referral form',
  actions: ['Submit referral info', 'Trigger auto-matching'],
  connectsTo: ['data_referral_match'],
  apiRoute: '/api/referral/:code/submit',
});

register({
  id: 'ua_client_pwa_install',
  name: 'Client Installs PWA',
  description: 'Client adds chat app to home screen',
  type: 'ui_action',
  category: 'Client-Facing',
  trigger: 'Client clicks install prompt',
  actions: ['Install PWA on device'],
  connectsTo: [],
});

register({
  id: 'ua_client_push_permission',
  name: 'Client Grants Push Permission',
  description: 'Client grants push notification permission',
  type: 'ui_action',
  category: 'Client-Facing',
  trigger: 'Client accepts notification prompt',
  actions: ['Register push subscription', 'Store subscription in database'],
  connectsTo: ['comm_push_notification'],
});

// --- CHAT & MESSAGING ---
register({
  id: 'ua_send_chat_msg',
  name: 'Retoucher Sends Chat Message',
  description: 'Retoucher/editor sends message to client',
  type: 'user_action',
  category: 'Chat & Messaging',
  trigger: 'Retoucher types and sends message',
  actions: ['Store message', 'Send push notification to client'],
  connectsTo: ['comm_push_notification'],
});

register({
  id: 'ua_archive_chat',
  name: 'Archive Chat',
  description: 'Archive completed project chat',
  type: 'user_action',
  category: 'Chat & Messaging',
  trigger: 'User clicks archive button',
  actions: ['Move chat to archived section'],
  connectsTo: [],
});

register({
  id: 'ua_unarchive_chat',
  name: 'Unarchive Chat',
  description: 'Restore archived chat to active section',
  type: 'user_action',
  category: 'Chat & Messaging',
  trigger: 'User clicks unarchive button',
  actions: ['Move chat back to active section'],
  connectsTo: [],
});

// --- NOTES ---
register({
  id: 'ua_add_note',
  name: 'Add Project Note',
  description: 'Add text or image note to a project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User submits note form',
  actions: ['Create note record', 'Upload image if attached'],
  connectsTo: [],
  apiRoute: '/api/projects/:projectId/notes',
});

register({
  id: 'ua_edit_note',
  name: 'Edit Project Note',
  description: 'Update an existing project note',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User edits note',
  actions: ['Update note record'],
  connectsTo: [],
  apiRoute: '/api/projects/:projectId/notes/:id',
});

register({
  id: 'ua_delete_note',
  name: 'Delete Project Note',
  description: 'Remove a note from a project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks delete note',
  actions: ['Delete note record'],
  connectsTo: [],
  apiRoute: '/api/projects/:projectId/notes/:id',
});

// --- TRADE OFFERS ---
register({
  id: 'ua_create_trade',
  name: 'Create Trade Offer',
  description: 'Propose a project trade with another retoucher',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User submits trade offer',
  actions: ['Create trade offer record', 'Notify target retoucher'],
  connectsTo: [],
  apiRoute: '/api/trade-offers',
});

register({
  id: 'ua_accept_trade',
  name: 'Accept Trade Offer',
  description: 'Accept a project trade from another retoucher',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks accept trade',
  actions: ['Swap project assignments', 'Update trade status'],
  connectsTo: ['ua_assign_retoucher'],
  apiRoute: '/api/trade-offers/:id/accept',
});

register({
  id: 'ua_decline_trade',
  name: 'Decline Trade Offer',
  description: 'Decline a project trade from another retoucher',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User clicks decline trade',
  actions: ['Update trade status to declined'],
  connectsTo: [],
  apiRoute: '/api/trade-offers/:id/decline',
});

// --- COMPLAINTS ---
register({
  id: 'ua_create_complaint',
  name: 'Create Complaint',
  description: 'Submit a complaint about a project',
  type: 'user_action',
  category: 'Project Management',
  trigger: 'User submits complaint form',
  actions: ['Create complaint record'],
  connectsTo: [],
  apiRoute: '/api/complaints',
});

// --- LOGIN ---
register({
  id: 'ua_login',
  name: 'Login',
  description: 'User logs into the system',
  type: 'ui_action',
  category: 'Dashboard & Settings',
  trigger: 'User submits login form',
  actions: ['Authenticate credentials', 'Create session'],
  connectsTo: [],
  apiRoute: '/api/auth/login',
});

// --- DRIVE MANAGER ACTIONS ---
register({
  id: 'ua_drive_scan',
  name: 'Manual Drive Scan',
  description: 'Manually trigger Drive scan for a project or all projects',
  type: 'user_action',
  category: 'Drive Monitor',
  trigger: 'Admin clicks scan button in Drive Manager',
  actions: ['Scan Drive folder(s)', 'Update photo counts', 'Check delivery status'],
  connectsTo: ['bg_drive_monitor'],
  apiRoute: '/api/drive/scan',
  roles: ['Admin'],
});

register({
  id: 'ua_drive_create_folder',
  name: 'Manual Drive Folder Creation',
  description: 'Manually create Drive folder for a project',
  type: 'user_action',
  category: 'Drive Monitor',
  trigger: 'Admin clicks create folder button',
  actions: ['Create folder in Google Drive', 'Create B&W subfolder', 'Store folder ID'],
  connectsTo: ['dm_folder_create'],
  apiRoute: '/api/drive/create-folder/:projectId',
  roles: ['Admin'],
});

register({
  id: 'ua_drive_monitor_toggle',
  name: 'Start/Stop Drive Monitor',
  description: 'Toggle the Drive Monitor background process on or off',
  type: 'user_action',
  category: 'Drive Monitor',
  trigger: 'Admin clicks start/stop monitor button',
  actions: ['Start or stop Drive Monitor interval'],
  connectsTo: ['bg_drive_monitor'],
  apiRoute: '/api/drive/monitor/start',
  roles: ['Admin'],
});

// --- REWARDS ---
register({
  id: 'ua_rewards_sync',
  name: 'Sync Rewards',
  description: 'Sync rewards from Google Calendar history',
  type: 'user_action',
  category: 'Rewards & Referrals',
  trigger: 'Admin clicks sync rewards button',
  actions: ['Pull calendar history', 'Calculate scores', 'Update tiers'],
  connectsTo: ['reward_scoring'],
  apiRoute: '/api/rewards/sync',
  roles: ['Admin'],
});

register({
  id: 'ua_send_reward_email',
  name: 'Send Reward Email',
  description: 'Send reward notification email to client',
  type: 'user_action',
  category: 'Rewards & Referrals',
  trigger: 'Admin clicks send reward email',
  actions: ['Send branded reward email'],
  connectsTo: ['ai_email_variation'],
  apiRoute: '/api/rewards/send-email',
  roles: ['Admin'],
});

// --- SSE Events ---
register({
  id: 'comm_sse_events',
  name: 'Real-time SSE Events',
  description: 'Server-Sent Events for live updates across all connected clients',
  type: 'communication',
  category: 'Communication',
  trigger: 'Any data change (project update, chat message, etc.)',
  actions: ['Broadcast update event to all connected clients', 'Update UI in real-time'],
  connectsTo: [],
  apiRoute: '/api/events',
});

console.log(`✅ Automation Registry: ${automations.size} automations registered`);

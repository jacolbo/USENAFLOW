import { Request, Response, NextFunction } from "express";
import { UserRoles } from "@shared/schema";

const SHOOTTRACKER_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.DATA_WRANGLER];

// Admin-only operations on Shoot Tracker. Data Wrangler is intentionally
// excluded — DW is restricted to wrangler notes + package/selected counts only
// (see verifyAdminRequest for the read/notes/package PATCH surface).
const ADMIN_ONLY_SHOOTTRACKER_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER];

// All roles that can participate in client chat (editors/retouchers)
const CHAT_ROLES = [
  UserRoles.ADMIN, 
  UserRoles.LEAD_RETOUCHER, 
  UserRoles.RETOUCHER_1, 
  UserRoles.RETOUCHER_2, 
  UserRoles.RETOUCHER_3, 
  UserRoles.EVANS
];

export function verifyAdminRequest(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;

  if (!role || !userId) {
    return res.status(401).json({ error: "Unauthorized: Missing user identification" });
  }

  if (!SHOOTTRACKER_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Forbidden: Admin, Lead Retoucher, or Data Wrangler access required" });
  }

  next();
}

// Stricter middleware that excludes Data Wrangler. Use for promote/ignore/
// restore/sync/settings PUT/send-email endpoints so DW can only touch counts
// and wrangler notes.
export function verifyAdminOrLeadRequest(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;

  if (!role || !userId) {
    return res.status(401).json({ error: "Unauthorized: Missing user identification" });
  }

  if (!ADMIN_ONLY_SHOOTTRACKER_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Forbidden: Admin or Lead Retoucher access required" });
  }

  next();
}

// Middleware for chat endpoints - allows all editor roles
export function verifyChatRequest(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;

  if (!role || !userId) {
    return res.status(401).json({ error: "Unauthorized: Missing user identification" });
  }

  if (!CHAT_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Forbidden: Editor access required" });
  }

  next();
}

import { Request, Response, NextFunction } from "express";
import { UserRoles } from "@shared/schema";

const ADMIN_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER];
const SHOOTTRACKER_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.DATA_WRANGLER];

export function verifyAdminRequest(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;

  if (!role || !userId) {
    return res.status(401).json({ error: "Unauthorized: Missing user identification" });
  }

  if (!ADMIN_ROLES.includes(role as any)) {
    return res.status(403).json({ error: "Forbidden: Admin or Lead Retoucher access required" });
  }

  next();
}

export function verifyShootTrackerAccess(req: Request, res: Response, next: NextFunction) {
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

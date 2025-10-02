import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export function signGrant(payload: any, expSeconds = 900) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expSeconds });
}

export function verifyGrant(token: string): any {
  return jwt.verify(token, env.JWT_SECRET);
}

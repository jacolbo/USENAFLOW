// User Access Logging System
import fs from 'fs/promises';
import path from 'path';

interface AccessLog {
  timestamp: string;
  username: string;
  action: string;
  ip?: string;
  userAgent?: string;
  projectId?: string;
  details?: string;
}

class UserAccessLogger {
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.join(process.cwd(), 'user-access.log');
  }

  async logAccess(log: AccessLog) {
    const logEntry = `${log.timestamp} | ${log.username} | ${log.action} | ${log.details || ''}\n`;
    
    try {
      await fs.appendFile(this.logFilePath, logEntry);
      console.log(`📝 Access logged: ${log.username} - ${log.action}`);
    } catch (error) {
      console.error('Failed to write access log:', error);
    }
  }

  async logLogin(username: string, success: boolean, ip?: string) {
    await this.logAccess({
      timestamp: new Date().toISOString(),
      username,
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      ip,
      details: success ? 'User successfully logged in' : 'Login attempt failed'
    });
  }

  async logLogout(username: string) {
    await this.logAccess({
      timestamp: new Date().toISOString(),
      username,
      action: 'LOGOUT',
      details: 'User logged out'
    });
  }

  async logProjectAction(username: string, action: string, projectId: string, clientName?: string) {
    await this.logAccess({
      timestamp: new Date().toISOString(),
      username,
      action: `PROJECT_${action}`,
      projectId,
      details: `Project: ${clientName || projectId} - ${action}`
    });
  }

  async logCorrectionsRequest(username: string, projectId: string, clientName: string, note?: string) {
    await this.logAccess({
      timestamp: new Date().toISOString(),
      username,
      action: 'CORRECTIONS_REQUESTED',
      projectId,
      details: `Corrections requested for ${clientName}${note ? ` - Note: ${note}` : ''}`
    });
  }

  async getRecentLogs(limit: number = 50): Promise<string[]> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines.slice(-limit);
    } catch (error) {
      console.error('Failed to read access logs:', error);
      return [];
    }
  }
}

export const accessLogger = new UserAccessLogger();

// Sales Account Credentials Log
export const SALES_ACCOUNT_INFO = {
  username: "Sales",
  password: "Sales2025!",
  role: "Sales",
  created: new Date().toISOString(),
  notes: "Primary Sales account with full corrections workflow access"
};

// Log the Sales account creation
accessLogger.logAccess({
  timestamp: new Date().toISOString(),
  username: "system",
  action: "SALES_ACCOUNT_CREATED",
  details: `Sales account created with username: ${SALES_ACCOUNT_INFO.username}`
});

console.log("🔑 Sales Account Information:");
console.log("============================");
console.log(`Username: ${SALES_ACCOUNT_INFO.username}`);
console.log(`Password: ${SALES_ACCOUNT_INFO.password}`);
console.log(`Role: ${SALES_ACCOUNT_INFO.role}`);
console.log(`Created: ${SALES_ACCOUNT_INFO.created}`);
console.log("============================");
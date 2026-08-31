import { Page } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Session Manager for Student IDR Tests
 * 
 * Enforces maximum 3 concurrent active sessions to prevent security resets.
 * Tracks login/logout events and provides recovery mechanisms.
 */

const MAX_CONCURRENT_SESSIONS = 3;
const SESSION_LOG_PATH = path.resolve(process.cwd(), 'test-results/.session-tracker.json');

interface SessionRecord {
  sessionId: string;
  email: string;
  status: 'active' | 'inactive' | 'error';
  startTime: number;
  endTime?: number;
  error?: string;
  pageUrl?: string;
}

class SessionManager {
  private sessions: Map<string, SessionRecord> = new Map();
  private loadCount = 0;

  constructor() {
    this.loadSessions();
  }

  /**
   * Load sessions from disk
   */
  private loadSessions(): void {
    if (!existsSync(SESSION_LOG_PATH)) return;
    try {
      const data = JSON.parse(readFileSync(SESSION_LOG_PATH, 'utf8'));
      const now = Date.now();
      
      // Reload only recent sessions (within last hour)
      for (const [id, session] of Object.entries(data) as [string, any][]) {
        if (now - session.startTime < 3600000) {
          if (session.status === 'active') {
            session.status = 'inactive'; // Sessions from previous runs are inactive
          }
          this.sessions.set(id, session);
        }
      }
    } catch (e) {
      console.warn('Failed to load session tracker:', e);
    }
  }

  /**
   * Save sessions to disk
   */
  private saveSessions(): void {
    try {
      const data = Object.fromEntries(this.sessions);
      writeFileSync(SESSION_LOG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('Failed to save session tracker:', e);
    }
  }

  /**
   * Get count of currently active sessions
   */
  getActiveSessions(): number {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
  }

  /**
   * Check if we can start a new session
   */
  canStartNewSession(): boolean {
    return this.getActiveSessions() < MAX_CONCURRENT_SESSIONS;
  }

  /**
   * Register a new login session
   */
  registerLogin(sessionId: string, email: string, pageUrl?: string): void {
    if (!this.canStartNewSession()) {
      const activeCount = this.getActiveSessions();
      throw new Error(
        `Cannot start new session: ${activeCount}/${MAX_CONCURRENT_SESSIONS} active sessions. ` +
        `Please wait for another test to complete or manually log out.`
      );
    }

    this.sessions.set(sessionId, {
      sessionId,
      email,
      status: 'active',
      startTime: Date.now(),
      pageUrl
    });

    this.saveSessions();
    console.log(`✓ Session registered: ${email} (${this.getActiveSessions()}/${MAX_CONCURRENT_SESSIONS} active)`);
  }

  /**
   * Mark session as logout
   */
  registerLogout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'inactive';
      session.endTime = Date.now();
      this.saveSessions();
      console.log(`✓ Session closed: ${session.email}`);
    }
  }

  /**
   * Mark session as errored (security reset, etc.)
   */
  registerError(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = error;
      session.endTime = Date.now();
      this.saveSessions();
      console.log(`✗ Session error: ${session.email} - ${error}`);
    }
  }

  /**
   * Get all active session emails
   */
  getActiveSessionEmails(): string[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active')
      .map(s => s.email);
  }

  /**
   * Check if email is already in an active session
   */
  isEmailInUse(email: string): boolean {
    return Array.from(this.sessions.values()).some(
      s => s.email === email && s.status === 'active'
    );
  }

  /**
   * Reset all sessions (call after tests complete)
   */
  resetAllSessions(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (session.status === 'active') {
        session.status = 'inactive';
        session.endTime = Date.now();
      }
    }
    this.saveSessions();
    console.log('✓ All sessions reset');
  }

  /**
   * Wait for an active session slot to become available
   * @param timeoutMs Maximum time to wait (default 5 minutes)
   */
  async waitForAvailableSlot(timeoutMs: number = 5 * 60 * 1000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.canStartNewSession()) {
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > timeoutMs) {
        throw new Error(
          `Timeout waiting for available session slot after ${timeoutMs}ms. ` +
          `Active sessions: ${this.getActiveSessionEmails().join(', ')}`
        );
      }

      console.log(`⏳ Waiting for session slot... (${this.getActiveSessions()}/${MAX_CONCURRENT_SESSIONS} active)`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      this.loadSessions(); // Reload to check if other tests finished
    }
  }

  /**
   * Get session summary for reporting
   */
  getSummary(): object {
    const active = Array.from(this.sessions.values()).filter(s => s.status === 'active');
    const inactive = Array.from(this.sessions.values()).filter(s => s.status === 'inactive');
    const errors = Array.from(this.sessions.values()).filter(s => s.status === 'error');

    return {
      totalSessions: this.sessions.size,
      activeSessions: active.length,
      inactiveSessions: inactive.length,
      errorSessions: errors.length,
      maxConcurrent: MAX_CONCURRENT_SESSIONS,
      activeEmails: active.map(s => s.email),
      errorDetails: errors.map(s => ({ email: s.email, error: s.error }))
    };
  }
}

// Global instance
let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

export function resetSessionManager(): void {
  if (sessionManager) {
    sessionManager.resetAllSessions();
    sessionManager = null;
  }
}

/**
 * Decorator/wrapper to enforce session limit on async functions
 */
export async function withSessionLimit<T>(
  sessionId: string,
  email: string,
  fn: () => Promise<T>,
  onError?: (error: string) => void
): Promise<T> {
  const manager = getSessionManager();
  
  // Check if email is already in use
  if (manager.isEmailInUse(email)) {
    throw new Error(`Email already in use in another active session: ${email}`);
  }

  // Wait for available slot if needed
  try {
    await manager.waitForAvailableSlot();
  } catch (e) {
    console.error('Failed to acquire session slot:', e);
    throw e;
  }

  // Register the login
  manager.registerLogin(sessionId, email);

  try {
    const result = await fn();
    manager.registerLogout(sessionId);
    return result;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    manager.registerError(sessionId, errorMsg);
    onError?.(errorMsg);
    throw e;
  }
}

/**
 * Check for security reset patterns in page content
 */
export async function detectSecurityReset(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    const text = await page.locator('body').innerText().catch(() => '');

    const securityPatterns = [
      /security.*reset/i,
      /unusual.*activity/i,
      /verify.*identity/i,
      /account.*locked/i,
      /too many.*attempt/i,
      /please.*log in again/i,
      /session.*expired/i
    ];

    return securityPatterns.some(pattern => pattern.test(text) || pattern.test(content));
  } catch {
    return false;
  }
}

/**
 * Handle security reset - log out and clean up
 */
export async function handleSecurityReset(page: Page, sessionId: string, email: string): Promise<void> {
  console.error(`🚨 SECURITY RESET DETECTED for ${email}`);
  
  const manager = getSessionManager();
  manager.registerError(sessionId, 'Security reset detected - too many concurrent sessions');

  // Try to navigate back to login
  try {
    await page.goto('https://student-loans.qa.fsp.rate.com/forgiveness/welcome', { 
      waitUntil: 'domcontentloaded' 
    }).catch(() => null);
  } catch {
    console.error('Failed to navigate to login page during security reset');
  }

  // Print summary for debugging
  console.log('\n📊 Session Summary:');
  console.log(JSON.stringify(manager.getSummary(), null, 2));
}

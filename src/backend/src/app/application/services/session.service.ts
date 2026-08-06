// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface UserSession {
  sessionId: string;
  username: string;
  spotfirePassword?: string;
  createdAt: Date;
  lastAccessAt: Date;
}

export class SessionService {
  private readonly sessions = new Map<string, UserSession>();
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly storageFile: string;

  public constructor(baseDir?: string) {
    const baseDataDir = baseDir ?? resolve(process.cwd(), '../data');
    this.storageFile = resolve(baseDataDir, 'sessions.json');
    this.loadSessions();
  }

  private loadSessions(): void {
    if (!existsSync(this.storageFile)) return;
    try {
      const data = readFileSync(this.storageFile, 'utf8');
      const parsed = JSON.parse(data) as Record<string, any>;
      for (const [id, s] of Object.entries(parsed)) {
        this.sessions.set(id, {
          ...s,
          createdAt: new Date(s.createdAt),
          lastAccessAt: new Date(s.lastAccessAt)
        });
      }
    } catch (e) {
      console.error('Failed to load sessions from disk', e);
    }
  }

  private saveSessions(): void {
    try {
      const dir = dirname(this.storageFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.sessions);
      writeFileSync(this.storageFile, JSON.stringify(data), 'utf8');
    } catch (e) {
      console.error('Failed to save sessions to disk', e);
    }
  }

  public createSession(username: string, spotfirePassword?: string): UserSession {
    const sessionId = randomUUID();
    const now = new Date();
    const session: UserSession = {
      sessionId,
      username,
      spotfirePassword,
      createdAt: now,
      lastAccessAt: now,
    };
    this.sessions.set(sessionId, session);
    this.saveSessions();
    return session;
  }

  public getSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastAccessAt.getTime() > this.SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      this.saveSessions();
      return null;
    }

    session.lastAccessAt = new Date();
    this.saveSessions();
    return session;
  }

  public removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveSessions();
  }

  public purgeExpiredSessions(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessAt.getTime() > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
        changed = true;
      }
    }
    if (changed) this.saveSessions();
  }
}

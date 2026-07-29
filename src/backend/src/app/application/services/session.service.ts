// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { randomUUID } from 'node:crypto';

export interface UserSession {
  sessionId: string;
  username: string;
  spotfirePassword?: string;
  createdAt: Date;
  lastAccessAt: Date;
}

export class SessionService {
  private readonly sessions = new Map<string, UserSession>();
  private readonly SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
    return session;
  }

  public getSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastAccessAt.getTime() > this.SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastAccessAt = new Date();
    return session;
  }

  public removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public purgeExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessAt.getTime() > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

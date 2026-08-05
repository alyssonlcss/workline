// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class TempStorageService {
  private readonly baseDataDir: string;

  public constructor(baseDir?: string) {
    this.baseDataDir = baseDir ?? resolve(process.cwd(), '../data');
  }

  public getSessionDirectory(sessionId: string): string {
    return join(this.baseDataDir, 'sessions', sessionId);
  }

  public async getActiveJobDirectory(sessionId: string): Promise<string | undefined> {
    const sessionDir = this.getSessionDirectory(sessionId);
    if (!existsSync(sessionDir)) return undefined;
    
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(sessionDir, { withFileTypes: true });
    const jobDirs = entries.filter(e => e.isDirectory());
    if (jobDirs.length > 0) {
      return join(sessionDir, jobDirs[0].name);
    }
    return undefined;
  }

  public getJobDirectory(sessionId: string, jobId: string): string {
    return join(this.getSessionDirectory(sessionId), jobId);
  }

  public async cleanupSessionDirectory(sessionId: string): Promise<void> {
    const dir = this.getSessionDirectory(sessionId);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  }

  public async prepareJobDirectory(sessionId: string, jobId: string): Promise<string> {
    const dir = this.getJobDirectory(sessionId, jobId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  public async cleanupJobDirectory(sessionId: string, jobId: string): Promise<void> {
    const dir = this.getJobDirectory(sessionId, jobId);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  }

  public getBaseDataDir(): string {
    return this.baseDataDir;
  }
}

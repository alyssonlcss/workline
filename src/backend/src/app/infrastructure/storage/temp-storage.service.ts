// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class TempStorageService {
  private readonly baseDataDir: string;

  public constructor(baseDir?: string) {
    this.baseDataDir = baseDir ?? resolve(process.cwd(), 'src/data');
  }

  public getJobDirectory(sessionId: string, jobId: string): string {
    return join(this.baseDataDir, 'sessions', sessionId, jobId);
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

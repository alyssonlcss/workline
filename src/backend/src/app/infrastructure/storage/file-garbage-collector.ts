// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export class FileGarbageCollector {
  private timer?: NodeJS.Timeout;

  public constructor(
    private readonly baseDataDir: string,
    private readonly maxAgeMs: number = 30 * 60 * 1000, // 30 min TTL
    private readonly intervalMs: number = 5 * 60 * 1000, // Check every 5 min
  ) {}

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runCleanup().catch((err) => {
        console.error('[garbage-collector] Cleanup error:', err);
      });
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public async runCleanup(): Promise<void> {
    const sessionsDir = join(this.baseDataDir, 'sessions');
    if (!existsSync(sessionsDir)) return;

    const now = Date.now();
    try {
      const sessionFolders = await readdir(sessionsDir, { withFileTypes: true });
      for (const folder of sessionFolders) {
        if (!folder.isDirectory()) continue;
        const sessionPath = join(sessionsDir, folder.name);

        try {
          const jobFolders = await readdir(sessionPath, { withFileTypes: true });
          let remainingJobs = 0;

          for (const jobFolder of jobFolders) {
            const jobPath = join(sessionPath, jobFolder.name);
            const folderStat = await stat(jobPath);

            if (now - folderStat.mtimeMs > this.maxAgeMs) {
              await rm(jobPath, { recursive: true, force: true });
            } else {
              remainingJobs++;
            }
          }

          if (remainingJobs === 0) {
            await rm(sessionPath, { recursive: true, force: true });
          }
        } catch {
          // Ignore individual folder removal errors
        }
      }
    } catch {
      // Ignore root sweep errors
    }
  }
}

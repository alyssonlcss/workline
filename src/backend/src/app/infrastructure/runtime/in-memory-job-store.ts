// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import type { ScannerJob } from '../../domain/entities/scanner-job.js';
import type { ScannerJobStorePort } from '../../domain/ports/scanner-job-store.port.js';

export class InMemoryJobStore implements ScannerJobStorePort {
  private readonly jobs = new Map<string, ScannerJob>();

  public async create(job: ScannerJob): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  public async update(job: ScannerJob): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  public async findById(id: string): Promise<ScannerJob | null> {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : null;
  }

  public purgeStaleJobs(maxAgeMs = 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - new Date(job.createdAt).getTime() > maxAgeMs) {
        this.jobs.delete(id);
      }
    }
  }
}
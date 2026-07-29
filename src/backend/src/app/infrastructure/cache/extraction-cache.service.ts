// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { createHash } from 'node:crypto';

export interface CachedExtraction {
  cachedAt: Date;
  result: any;
}

export class ExtractionCacheService {
  private readonly cache = new Map<string, CachedExtraction>();
  private readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

  public generateKey(params: {
    reportTitle?: string;
    analysisTab?: string;
    tableTitle?: string;
    selectedFilters?: unknown;
    periodSelection?: unknown;
    userCredentials?: { username?: string; password?: string };
  }): string {
    const rawStr = JSON.stringify({
      title: params.reportTitle ?? '',
      tab: params.analysisTab ?? '',
      table: params.tableTitle ?? '',
      filters: params.selectedFilters ?? [],
      period: params.periodSelection ?? {},
      user: params.userCredentials?.username ?? '',
      pass: params.userCredentials?.password ?? '',
    });
    return createHash('sha256').update(rawStr).digest('hex');
  }

  public get(key: string, ttlMs = this.DEFAULT_TTL_MS): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt.getTime() > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  public set(key: string, result: any): void {
    this.cache.set(key, {
      cachedAt: new Date(),
      result: structuredClone(result),
    });
  }

  public purgeExpired(ttlMs = this.DEFAULT_TTL_MS): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt.getTime() > ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

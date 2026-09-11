// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

import type { ExternalHttpClient } from '../../infrastructure/incidence/external-http-client.js';
import type { ExternalIncidencePayload } from '../../domain/entities/incidence-data.entity.js';

export class IncidenceEnrichmentService {
  private readonly globalIncidenceCache = new Map<string, ExternalIncidencePayload>();
  private activePrefetchPromise: Promise<void> | null = null;

  public constructor(
    private readonly httpClient: ExternalHttpClient,
  ) {}

  public async prefetchIncidences(dataInicio: string, dataFim: string, polo: string, onProgress?: (msg: string) => void): Promise<void> {
    this.activePrefetchPromise = this.doPrefetch(dataInicio, dataFim, polo, onProgress);
    try {
      await this.activePrefetchPromise;
    } finally {
      this.activePrefetchPromise = null;
    }
  }

  private async doPrefetch(dataInicio: string, dataFim: string, polo: string, onProgress?: (msg: string) => void): Promise<void> {
    try {
      let skip = 0;
      const take = 5000;
      let hasMore = true;
      let count = 0;
      const startMsg = `[IncidenceEnrichment] Iniciando carga do Openview para ${polo} (${dataInicio} a ${dataFim})`;
        console.log(startMsg);
        onProgress?.(startMsg);

      while (hasMore) {
        const response = await this.httpClient.get<{ items?: ExternalIncidencePayload[]; data?: ExternalIncidencePayload[] }>( 
          '/incidencias/consultar',
          {
            colNumOrder: '0',
            orderAsc: 'true',
            skip: skip.toString(),
            take: take.toString(),
            dataInicio,
            dataFim,
            polos: polo
          }
        );

        const items: ExternalIncidencePayload[] = Array.isArray(response) ? response : (response as any).items ?? (response as any).itens ?? (response as any).data ?? [];

        if (items.length === 0) {
          hasMore = false;
        } else {
          for (const item of items) {
            const id = item.incidencia || (item as any).numero;
            if (id) {
              this.globalIncidenceCache.set(String(id), item);
            }
          }
          count += items.length;
          skip += take;
            onProgress?.(`[IncidenceEnrichment] Carregando Openview... (${count} O.S baixadas)`);
          }
      }
      const endMsg = `[IncidenceEnrichment] Carga concluída: ${count} incidências cacheadas para ${polo}`;
        console.log(endMsg);
        onProgress?.(endMsg);
    } catch (e) {
      console.error(`[IncidenceEnrichment] Failed to prefetch incidences:`, e);
    }
  }

  public async getAllCachedIncidences(): Promise<ExternalIncidencePayload[]> {
    if (this.activePrefetchPromise) {
      console.log('[IncidenceEnrichment] Waiting for active prefetch to complete...');
      await this.activePrefetchPromise;
    }
    return Array.from(this.globalIncidenceCache.values());
  }
}

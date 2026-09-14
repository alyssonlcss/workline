// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

import type { ExternalHttpClient } from '../../infrastructure/incidence/external-http-client.js';
import type { ExternalIncidencePayload } from '../../domain/entities/incidence-data.entity.js';

export class IncidenceEnrichmentService {
  public constructor(
    private readonly httpClient: ExternalHttpClient,
  ) {}

  public async fetchIncidences(dataInicio: string, dataFim: string, polos: string[]): Promise<ExternalIncidencePayload[]> {
    try {
      let skip = 0;
      const take = 5000;
      let hasMore = true;
      let totalRecords = 0;
      const allItems: ExternalIncidencePayload[] = [];
      const poloStr = polos.join(',');
      const prefix = `\x1b[32m[IncidenceEnrichment]\x1b[0m`;
      const startMsg = `${prefix} Consultando Openview para ${poloStr} (${dataInicio} a ${dataFim})`;
      console.log(startMsg);

      while (hasMore) {
        const queryParams = {
          colNumOrder: '0',
          orderAsc: 'true',
          skip: skip.toString(),
          take: take.toString(),
          dataInicio,
          dataFim,
          polos: poloStr
        };

        const queryStr = new URLSearchParams(queryParams).toString();
        console.log(`${prefix} GET /incidencias/consultar?${queryStr}`);

        const response = await this.httpClient.get<{ items?: ExternalIncidencePayload[]; data?: ExternalIncidencePayload[]; total?: number }>( 
          '/incidencias/consultar',
          queryParams
        );

        const items: ExternalIncidencePayload[] = Array.isArray(response) ? response : (response as any).items ?? (response as any).itens ?? (response as any).data ?? [];
        totalRecords = (response as any).total ?? ((response as any).totalRecords ?? items.length);

        if (items.length === 0) {
          hasMore = false;
        } else {
          allItems.push(...items);
          skip += take;
        }
      }
      
      console.log(`${prefix} Consulta concluída: ${allItems.length} incidências retornadas para ${poloStr} | Status 200 | Total: ${totalRecords}`);
      return allItems;
    } catch (e) {
      console.error(`\x1b[31m[IncidenceEnrichment]\x1b[0m Falha ao consultar incidências:`, e);
      return [];
    }
  }
}

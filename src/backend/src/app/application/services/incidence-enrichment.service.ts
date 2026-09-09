// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExternalHttpClient } from '../../infrastructure/incidence/external-http-client.js';
import type {
  ExternalIncidencePayload,
  EnrichedIncidence,
  IncidenceTag,
  IncidenceFlag,
} from '../../domain/entities/incidence-data.entity.js';

interface BaseCoordinates {
  name: string;
  lat: number;
  lon: number;
  polo: string;
}

/**
 * Service responsible for fetching incidence data from the external API
 * and enriching it with visual metadata (tags, flags, map links).
 *
 * This service is 100% isolated from the M300/Spotfire pipeline.
 */
export class IncidenceEnrichmentService {
  private readonly bases: BaseCoordinates[];
  private readonly mapsUrlTemplate: string;

  public constructor(
    private readonly httpClient: ExternalHttpClient,
    mapsUrlTemplate: string,
  ) {
    this.mapsUrlTemplate = mapsUrlTemplate.endsWith('/')
      ? mapsUrlTemplate.slice(0, -1)
      : mapsUrlTemplate;
    this.bases = this.loadBaseCoordinates();
  }

  /**
   * Enriches multiple incidences in batch (Fetch Inicial).
   * Designed for the main visible cards on the dashboard.
   */
  public async enrichBatch(incidenceNumbers: { incidence: string, team?: string }[]): Promise<EnrichedIncidence[]> {
    console.log(`[IncidenceEnrichment] enrichBatch called with ${incidenceNumbers.length} incidence(s).`);
    const results: EnrichedIncidence[] = [];

    for (const item of incidenceNumbers) {
      const enriched = await this.enrichSingle(item.incidence, item.team);
      results.push(enriched);
    }

    return results;
  }

  /**
   * Enriches a single incidence (Lazy Fetch / "Ver Mais").
   */
  public async enrichSingle(incidenceNumber: string, team?: string): Promise<EnrichedIncidence> {
    
    try {
      const response = await this.httpClient.get<{ items?: ExternalIncidencePayload[]; data?: ExternalIncidencePayload[] }>(
        '/incidencias/consultar',
        {
          colNumOrder: '0',
          orderAsc: 'true',
          skip: '0',
          take: '50',
          incidencia: incidenceNumber,
        },
      );

      // The API may wrap results in `items`, `itens` or `data` or return an array directly
      const items: ExternalIncidencePayload[] =
        Array.isArray(response) ? response :
        (response as any).items ?? (response as any).itens ?? (response as any).data ?? [];

      const payload = items.find((item: any) => {
        const id = item.incidencia || item.numero;
        return String(id) === String(incidenceNumber);
      }) ?? items[0];

      if (payload && !payload.incidencia && (payload as any).numero) {
        payload.incidencia = (payload as any).numero;
      }

      if (items.length === 0) {
        console.warn(`[GetIncidenciaOpenview] WARNING: items is empty! Response keys: ${Object.keys(response || {}).join(', ')}`);
        try { console.warn(JSON.stringify(response).slice(0, 300)); } catch(e){}
      } else if (!payload) {
        console.warn(`[GetIncidenciaOpenview] WARNING: payload is undefined but items.length is ${items.length}! First item:`, JSON.stringify(items[0]));
      }

      const total = (response as any).total ?? items.length;
      console.log(`\x1b[32m[GetIncidenciaOpenview]\x1b[0m fetching data for incidence: ${incidenceNumber} | EQ: ${team || 'N/A'} | Status 200 | Items: ${items.length} | Total: ${total}`);

      if (!payload) {
        return this.buildNotFound(incidenceNumber);
      }
      
      // LOG PAYLOAD KEYS FOR DEBUGGING
      if (Math.random() < 0.1 || incidenceNumber.endsWith('9')) { // Log for some to avoid flooding
        console.log(`[DEBUG] Openview payload keys for ${incidenceNumber}:`, Object.keys(payload).join(', '));
      }

      return this.buildEnrichedIncidence(incidenceNumber, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Extract status from message if available, else assume 400/500
      const statusMatch = message.match(/HTTP (\d+)/);
      const status = statusMatch ? statusMatch[1] : 'Error';
      console.error(`\x1b[31m[GetIncidenciaOpenview]\x1b[0m fetching data for incidence: ${incidenceNumber} | EQ: ${team || 'N/A'} | Status ${status} | Error: ${message}`);
      return this.buildError(incidenceNumber, message);
    }
  }

  /**
   * Builds the full enriched incidence from a raw API payload.
   */
  private buildEnrichedIncidence(
    incidenceNumber: string,
    payload: ExternalIncidencePayload,
  ): EnrichedIncidence {
    const lat = payload.latitude != null ? Number(payload.latitude) : null;
    const lon = payload.longitude != null ? Number(payload.longitude) : null;
    const hasCoords = lat != null && lon != null && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);

    // ── Location & Maps URL ──
    const mapsUrl = hasCoords ? `${this.mapsUrlTemplate}/${lat},${lon}` : null;

    // Location label logic
    let locationLabel: string | null = null;
    let locationFieldUsed: string | null = null;
    
    if (hasCoords) {
      const parts = [payload.bairro, payload.municipio].filter(Boolean);
      if (parts.length > 0) {
        locationLabel = parts.join(', ');
      } else {
        locationLabel = `${lat!.toFixed(4)}, ${lon!.toFixed(4)}`;
      }
    } else {
      if (payload.municipio) {
        locationLabel = payload.municipio;
        locationFieldUsed = 'município';
      } else if ((payload as any).conjunto) {
        locationLabel = (payload as any).conjunto;
        locationFieldUsed = 'conjunto';
      }
    }

    // ── Nearest base & estimated return ──
    let estimatedReturnMin: number | null = null;
    let nearestBaseName: string | null = null;

    if (hasCoords && this.bases.length > 0) {
      const nearest = this.findNearestBase(lat!, lon!);
      if (nearest) {
        nearestBaseName = nearest.name;
        // Haversine distance → estimate at 40 km/h average speed (urban/rural mix)
        const distKm = this.haversineDistance(lat!, lon!, nearest.lat, nearest.lon);
        estimatedReturnMin = Math.round((distKm / 40) * 60);
        if (estimatedReturnMin < 1) estimatedReturnMin = 1;
      }
    }

    // ── Tags ──
    const tags: IncidenceTag[] = [];

    // Blue Tag: Nível de Tensão
    if (payload.nivelTensao) {
      tags.push({
        type: 'nivel_tensao',
        label: `NT: ${payload.nivelTensao}`,
        color: 'blue',
      });
    }

    // Orange Tag: 5 Regras de Ouro
    const cumpre5RO = payload.cumpreRegrasOuro;
    if (
      cumpre5RO === true ||
      cumpre5RO === 'true' ||
      (typeof cumpre5RO === 'string' && cumpre5RO.toLowerCase() === 'sim')
    ) {
      tags.push({
        type: 'regras_ouro',
        label: '5RO',
        color: 'orange',
      });
    }

    // ── Flags ──
    const flags: IncidenceFlag[] = [];

    // Blue Flag: Localização + Retorno Estimado
    if (locationLabel) {
      const retornoText = estimatedReturnMin != null
        ? ` | deslocamento estimado: ${estimatedReturnMin} min`
        : '';
        
      const locPrefixText = locationFieldUsed ? `Localização (${locationFieldUsed}):` : `Localização:`;
      const locPrefixHtml = `<b><span style="color:#1d4ed8;">${locPrefixText}</span></b>`;
      const plainTextInfo = `${locationLabel}${retornoText}`;
      
      const linkContent = mapsUrl
        ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline;">${plainTextInfo}</a>`
        : plainTextInfo;

      flags.push({
        type: 'localizacao',
        html: `${locPrefixHtml} ${linkContent}`,
        plainText: `${locPrefixText} ${plainTextInfo}`,
        href: mapsUrl ?? undefined,
        color: 'blue',
      });
    }

    // Blue Flag: Observação com formatação
    if (payload.observacao && payload.observacao.trim().length > 0) {
      const obs = payload.observacao.trim();
      const prefixHtml = `<b><span style="color:#1d4ed8;">Reporte de execução:</span></b>`;
      const prefixPlain = `Reporte de execução:`;

      flags.push({
        type: 'observacao_m300',
        html: `${prefixHtml} ${obs}`,
        plainText: `${prefixPlain} ${obs}`,
        color: 'blue',
      });
    }

    return {
      incidenceNumber,
      raw: payload,
      locationLabel,
      estimatedReturnMin,
      nearestBaseName,
      mapsUrl,
      tags,
      flags,
      status: 'enriched',
    };
  }

  private buildNotFound(incidenceNumber: string): EnrichedIncidence {
    return {
      incidenceNumber,
      raw: { incidencia: incidenceNumber },
      locationLabel: null,
      estimatedReturnMin: null,
      nearestBaseName: null,
      mapsUrl: null,
      tags: [],
      flags: [],
      status: 'not_found',
    };
  }

  private buildError(incidenceNumber: string, errorMessage: string): EnrichedIncidence {
    return {
      incidenceNumber,
      raw: { incidencia: incidenceNumber },
      locationLabel: null,
      estimatedReturnMin: null,
      nearestBaseName: null,
      mapsUrl: null,
      tags: [],
      flags: [],
      status: 'error',
      errorMessage,
    };
  }

  /**
   * Loads base coordinates from polos.json.
   * Parses the `localBase` field: ["-lat,lon"]
   */
  private loadBaseCoordinates(): BaseCoordinates[] {
    const result: BaseCoordinates[] = [];

    try {
      const configPath = join(process.cwd(), 'polos.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      for (const polo of config.polos ?? []) {
        for (const base of polo.bases ?? []) {
          if (base.localBase && Array.isArray(base.localBase) && base.localBase.length > 0) {
            const coordStr = base.localBase[0];
            const parts = coordStr.split(',');
            if (parts.length === 2) {
              const lat = parseFloat(parts[0]);
              const lon = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lon)) {
                result.push({ name: base.name, lat, lon, polo: polo.name });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[IncidenceEnrichment] Failed to load base coordinates from polos.json:', err);
    }

    console.log(`[IncidenceEnrichment] Loaded ${result.length} base(s) with coordinates for return estimation.`);
    return result;
  }

  /**
   * Finds the nearest operational base to the given coordinates.
   */
  private findNearestBase(lat: number, lon: number): BaseCoordinates | null {
    if (this.bases.length === 0) return null;

    let nearest: BaseCoordinates | null = null;
    let minDist = Infinity;

    for (const base of this.bases) {
      const dist = this.haversineDistance(lat, lon, base.lat, base.lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = base;
      }
    }

    return nearest;
  }

  /**
   * Haversine formula: returns the distance in kilometers between two coordinates.
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degToRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

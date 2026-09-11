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

  private readonly geocodeCache = new Map<string, { lat: number; lon: number } | null>();
  private readonly reverseGeocodeCache = new Map<string, string | null>();
  private readonly routeCache = new Map<string, number | null>();
  private lastNominatimRequestTime = 0;

  private async nominatimRequest(url: string): Promise<any> {
    const now = Date.now();
    const timeSinceLast = now - this.lastNominatimRequestTime;
    if (timeSinceLast < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
    }
    this.lastNominatimRequestTime = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'WorklineApp/1.0 (internal)' } });
      if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('[Nominatim] fetch failed:', e);
      return null;
    }
  }

  private async geocodeMunicipio(municipio: string): Promise<{ lat: number; lon: number } | null> {
    if (!municipio) return null;
    const cacheKey = municipio.toLowerCase().trim();
    if (this.geocodeCache.has(cacheKey)) return this.geocodeCache.get(cacheKey)!;
    
    const q = encodeURIComponent(`${municipio}, Ceará, Brazil`);
    const data = await this.nominatimRequest(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      this.geocodeCache.set(cacheKey, result);
      return result;
    }
    this.geocodeCache.set(cacheKey, null);
    return null;
  }

  private async reverseGeocode(lat: number, lon: number): Promise<string | null> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (this.reverseGeocodeCache.has(cacheKey)) return this.reverseGeocodeCache.get(cacheKey)!;
    
    const data = await this.nominatimRequest(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    if (data && data.address) {
      const localidade = data.address.town || data.address.village || data.address.city_district || data.address.suburb || data.address.hamlet;
      if (localidade) {
         this.reverseGeocodeCache.set(cacheKey, localidade);
         return localidade;
      }
    }
    this.reverseGeocodeCache.set(cacheKey, null);
    return null;
  }

  private async getOsrmRoutingEstimate(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number | null> {
    const key = `${lat1},${lon1}|${lat2},${lon2}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key)!;

    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'WorklineApp/1.0 (internal)' } });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const durationSec = data.routes[0].duration;
          const mins = Math.max(1, Math.round(durationSec / 60));
          this.routeCache.set(key, mins);
          return mins;
        }
      }
    } catch (e) {
      console.error('[OSRM] fetch failed:', e);
    }
    
    this.routeCache.set(key, null);
    return null;
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

      return await this.buildEnrichedIncidence(incidenceNumber, payload);
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
  private async buildEnrichedIncidence(
    incidenceNumber: string,
    payload: ExternalIncidencePayload,
  ): Promise<EnrichedIncidence> {
    let lat = payload.latitude != null ? Number(payload.latitude) : null;
    let lon = payload.longitude != null ? Number(payload.longitude) : null;
    let hasCoords = lat != null && lon != null && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);

    let locationLabel: string | null = null;
    let locationFieldUsed: string | null = null;
    
    if (hasCoords) {
      const localidade = await this.reverseGeocode(lat!, lon!);
      const muni = payload.municipio;
      if (localidade && muni && localidade.toLowerCase() !== muni.toLowerCase()) {
        locationLabel = `${localidade}, ${muni}`;
      } else {
        const parts = [payload.bairro, muni].filter(Boolean);
        locationLabel = parts.length > 0 ? parts.join(', ') : `${lat!.toFixed(4)}, ${lon!.toFixed(4)}`;
      }
    } else {
      const fallbackStr = payload.municipio || (payload as any).conjunto;
      if (fallbackStr) {
        const geocoded = await this.geocodeMunicipio(fallbackStr);
        if (geocoded) {
          lat = geocoded.lat;
          lon = geocoded.lon;
          hasCoords = true;
        }
        locationLabel = fallbackStr;
        locationFieldUsed = payload.municipio ? 'município' : 'conjunto';
      }
    }

    let mapsUrl = hasCoords ? `${this.mapsUrlTemplate}/${lat},${lon}` : null;
    if (!mapsUrl && locationLabel) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`;
    }

    let estimatedReturnMin: number | null = null;
    let nearestBaseName: string | null = null;
    let baseLat: number | null = null;
    let baseLon: number | null = null;

    if (hasCoords && this.bases.length > 0) {
      const nearest = this.findNearestBase(lat!, lon!);
      if (nearest) {
        nearestBaseName = nearest.name;
        baseLat = nearest.lat;
        baseLon = nearest.lon;
        const distKm = this.haversineDistance(lat!, lon!, nearest.lat, nearest.lon);
        const drivingDistKm = distKm * 1.4;
        estimatedReturnMin = Math.round((drivingDistKm / 30) * 60);
        if (estimatedReturnMin < 1) estimatedReturnMin = 1;
        
        const osrmMins = await this.getOsrmRoutingEstimate(lat!, lon!, nearest.lat, nearest.lon);
        if (osrmMins !== null) {
          estimatedReturnMin = osrmMins;
        }
      }
    }

    const tags: IncidenceTag[] = [];

    if (payload.nivelTensao) {
      tags.push({
        type: 'nivel_tensao',
        label: `NT: ${payload.nivelTensao}`,
        color: 'blue',
      });
    }

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

    const flags: IncidenceFlag[] = [];

    if (locationLabel) {
      const locPrefixText = locationFieldUsed ? `Localização (${locationFieldUsed}):` : `Localização:`;
      const locPrefixHtml = `<b><span style="color:#1d4ed8;">${locPrefixText}</span></b>`;
      const plainTextInfo = `${locationLabel}`;
      
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
      lat: hasCoords ? lat : null,
      lon: hasCoords ? lon : null,
      baseLat,
      baseLon,
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

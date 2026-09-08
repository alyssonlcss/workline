// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

/**
 * Raw payload returned by the external incidence API.
 * GET {API_URL}/incidencias/consultar?...&incidencia={NUMBER}
 */
export interface ExternalIncidencePayload {
  incidencia: string;
  latitude?: number | null;
  longitude?: number | null;
  nivelTensao?: string | null;
  cumpreRegrasOuro?: boolean | string | null;
  observacao?: string | null;
  status?: string | null;
  causa?: string | null;
  alimentador?: string | null;
  dataAbertura?: string | null;
  dataPrevisao?: string | null;
  qtdClientesAfetados?: number | null;
  municipio?: string | null;
  bairro?: string | null;
}

/**
 * Enriched incidence data ready for frontend consumption.
 * Contains derived visual metadata (tags, flags, map links).
 */
export interface EnrichedIncidence {
  /** Original incidence number. */
  incidenceNumber: string;

  /** Raw data from the external API. */
  raw: ExternalIncidencePayload;

  /** "Distrito, Município" or coordinate-based label. */
  locationLabel: string | null;

  /** Estimated return time in minutes from the incidence to the nearest operational base. */
  estimatedReturnMin: number | null;

  /** Name of the nearest operational base used for the return estimate. */
  nearestBaseName: string | null;

  /** Full Google Maps URL for the incidence location. */
  mapsUrl: string | null;

  /** Visual tags to render as badges on the card. */
  tags: IncidenceTag[];

  /** Visual flags to render in the notice/alert list of the card. */
  flags: IncidenceFlag[];

  /** Whether the enrichment succeeded or the API returned no data. */
  status: 'enriched' | 'not_found' | 'error';

  /** Error message if status is 'error'. */
  errorMessage?: string;
}

export interface IncidenceTag {
  /** Unique identifier for the tag type. */
  type: 'nivel_tensao' | 'regras_ouro';
  /** Display label (e.g. "NT: Baixa", "5RO"). */
  label: string;
  /** CSS color class: 'blue' | 'orange'. */
  color: 'blue' | 'orange';
}

export interface IncidenceFlag {
  /** Unique identifier for the flag type. */
  type: 'localizacao' | 'observacao_m300';
  /** Pre-built HTML content for the flag. */
  html: string;
  /** Plain text version (for PDF / clipboard). */
  plainText: string;
  /** Optional hyperlink URL (e.g. Google Maps). */
  href?: string;
  /** CSS color class: 'blue'. */
  color: 'blue';
}

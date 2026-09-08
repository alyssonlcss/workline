// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

import { ExternalAuthProvider } from './external-auth.provider.js';

/**
 * HTTP client for the external incidence API.
 * Automatically injects the Bearer token and handles 401 re-authentication.
 *
 * This module is 100% isolated from the Spotfire/M300 pipeline.
 */
export class ExternalHttpClient {
  private static readonly MAX_RETRIES = 2;

  public constructor(
    private readonly apiUrl: string,
    private readonly authProvider: ExternalAuthProvider,
  ) {}

  /**
   * Performs a GET request to the external API with automatic
   * Bearer token injection and 401 retry logic.
   */
  public async get<T = unknown>(path: string, queryParams?: Record<string, string | number>): Promise<T> {
    const url = this.buildUrl(path, queryParams);
    return this.executeWithRetry<T>(url, { method: 'GET' });
  }

  /**
   * Performs a POST request to the external API.
   */
  public async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.executeWithRetry<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Execute a fetch with automatic 401 retry.
   * On 401: invalidate token → get new token → retry once.
   */
  private async executeWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= ExternalHttpClient.MAX_RETRIES; attempt++) {
      try {
        const token = await this.authProvider.getToken();

        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${token}`);

        const response = await fetch(url, {
          ...init,
          headers,
        });

        if (response.status === 401) {
          console.warn(`[ExternalHttpClient] 401 Unauthorized on attempt ${attempt + 1} — invalidating token and retrying...`);
          this.authProvider.invalidateToken();

          // Backoff before retry
          if (attempt < ExternalHttpClient.MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
          }
          continue;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            `[ExternalHttpClient] HTTP ${response.status} ${response.statusText} — ${url}\n${body}`,
          );
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < ExternalHttpClient.MAX_RETRIES) {
          console.warn(`[ExternalHttpClient] Request failed (attempt ${attempt + 1}): ${lastError.message}`);
          await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error(`[ExternalHttpClient] Request failed after ${ExternalHttpClient.MAX_RETRIES + 1} attempts`);
  }

  /**
   * Builds the full URL from the configured API base URL, path, and optional query parameters.
   */
  private buildUrl(path: string, queryParams?: Record<string, string | number>): string {
    const base = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${cleanPath}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}

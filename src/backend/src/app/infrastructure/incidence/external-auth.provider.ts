// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

import puppeteer, { type Browser, type Page } from 'puppeteer';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Singleton provider that captures a JWT token from the external incidence
 * portal using Puppeteer in headless mode. The token is intercepted from
 * network requests/responses during the SSO login flow.
 *
 * This module is 100% isolated from the Spotfire/M300 automation pipeline.
 */
export class ExternalAuthProvider {
  private static instance: ExternalAuthProvider | null = null;

  private cachedToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  private constructor(
    private readonly webUrl: string,
    private readonly browserPath: string,
  ) {
    if (process.env.OPENVIEW_TOKEN && process.env.OPENVIEW_TOKEN.trim().length > 0) {
      this.cachedToken = process.env.OPENVIEW_TOKEN.trim();
      console.log(`\x1b[32m[AuthenticatorOpenview]\x1b[0m Loaded token from .env (length: ${this.cachedToken.length}) | Status 200`);
    }
  }

  public static getInstance(webUrl: string, browserPath: string): ExternalAuthProvider {
    if (!ExternalAuthProvider.instance) {
      ExternalAuthProvider.instance = new ExternalAuthProvider(webUrl, browserPath);
    }
    return ExternalAuthProvider.instance;
  }

  /**
   * Returns a valid JWT token. If no token is cached, launches Puppeteer
   * to capture one from the portal's network traffic.
   */
  public async getToken(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    // Mutex: if another caller is already refreshing, await the same promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.captureToken();

    try {
      const token = await this.refreshPromise;
      this.cachedToken = token;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Invalidates the cached token, forcing the next `getToken()` call
   * to re-launch Puppeteer and capture a fresh token.
   */
  public invalidateToken(): void {
    this.cachedToken = null;
  }

  /**
   * Core capture logic:
   * 1. Launch headless browser
   * 2. Inject request/response listeners BEFORE navigation
   * 3. Navigate to the portal web URL
   * 4. Poll for the token (up to 60s)
   * 5. If not captured, clear cookies/cache/storage, reload, and poll again
   * 6. Close browser and return the token
   */
  private async captureToken(): Promise<string> {
    let browser: Browser | null = null;

    try {
      const launchArgs: string[] = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ];

      browser = await puppeteer.launch({
        headless: true,
        executablePath: this.browserPath || undefined,
        args: launchArgs,
        defaultViewport: { width: 1280, height: 720 },
      });

      const page = await browser.newPage();
      let capturedToken: string | null = null;

      // ── Tactic A: Watch request headers for Bearer tokens ──
      page.on('request', (request) => {
        try {
          if (capturedToken) return;
          const headers = request.headers();
          const authHeader = headers['authorization'] || headers['Authorization'];
          if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
            const token = authHeader.substring(7).trim();
            if (token && token.length > 50) {
              capturedToken = token;
            }
          }
        } catch (_) {
          // Silently ignore listener errors
        }
      });

      // ── Tactic B: Watch response body for auth endpoint ──
      page.on('response', async (response) => {
        try {
          if (capturedToken) return;
          if (
            response.url().includes('/autenticacao/autenticar') &&
            response.request().method() === 'POST'
          ) {
            const data = await response.json();
            if (data && data.token) {
              capturedToken = data.token;
            }
          }
        } catch (_) {
          // Silently ignore listener errors
        }
      });

      // ── First attempt: navigate and poll ──
      await page.goto(this.webUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      capturedToken = await this.pollForToken(() => capturedToken, 60);

      // ── Second attempt: clear state and reload ──
      if (!capturedToken) {
        console.log('[ExternalAuth] Token not captured on first attempt — clearing browser state and retrying...');

        const client = await page.createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (_) {
            // ignore
          }
        });
        await client.detach();

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });

        capturedToken = await this.pollForToken(() => capturedToken, 60);
      }

      if (!capturedToken) {
        throw new Error(
          '[ExternalAuth] Failed to capture JWT token after 2 attempts. ' +
          'Ensure the machine has an active SSO/Microsoft session for the external portal.',
        );
      }

      console.log(`[ExternalAuth] Token captured successfully (length: ${capturedToken.length})`);
      this.saveTokenToEnv(capturedToken);
      return capturedToken;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Polls a getter function every second for up to `maxSeconds`.
   * Returns the token as soon as it's available, or null on timeout.
   */
  private async pollForToken(
    getter: () => string | null,
    maxSeconds: number,
  ): Promise<string | null> {
    for (let i = 0; i < maxSeconds; i++) {
      const value = getter();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return getter();
  }

  /**
   * Saves the captured token back into the .env file as OPENVIEW_TOKEN.
   */
  private saveTokenToEnv(token: string): void {
    try {
      const envPath = resolve(process.cwd(), '.env');
      let content = '';
      try {
        content = readFileSync(envPath, 'utf8');
      } catch (e) {
        // file doesn't exist yet, ignore
      }

      const envVar = `OPENVIEW_TOKEN=${token}`;
      if (content.includes('OPENVIEW_TOKEN=')) {
        content = content.replace(/^OPENVIEW_TOKEN=.*$/m, envVar);
      } else {
        content += `\n${envVar}\n`;
      }

      writeFileSync(envPath, content, 'utf8');
      console.log('[ExternalAuth] Token saved to .env successfully.');
    } catch (err) {
      console.error('[ExternalAuth] Failed to save token to .env:', err);
    }
  }
}

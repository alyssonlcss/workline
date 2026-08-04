// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { createReadStream } from 'node:fs';
import { access, copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';

import { StartScannerJobUseCase } from '../../application/use-cases/start-scanner-job.use-case.js';
import { GetScannerJobUseCase } from '../../application/use-cases/get-scanner-job.use-case.js';
import { PostDownloadReportService } from '../../application/services/post-download-report.service.js';
import { SessionService } from '../../application/services/session.service.js';
import { environment, resolveDefaultDataDir } from '../../infrastructure/config/env.js';
import { InMemoryJobStore } from '../../infrastructure/runtime/in-memory-job-store.js';
import { ExtractionQueueManager } from '../../infrastructure/runtime/extraction-queue.manager.js';
import { ExtractionCacheService } from '../../infrastructure/cache/extraction-cache.service.js';
import { TempStorageService } from '../../infrastructure/storage/temp-storage.service.js';
import { FileGarbageCollector } from '../../infrastructure/storage/file-garbage-collector.js';
import { PuppeteerSpotfireAutomation } from '../../infrastructure/spotfire/puppeteer-spotfire-automation.js';
import { registerAuthRoutes } from './auth.controller.js';

const filterSchema = z.object({
  title: z.string().trim().min(1),
  kind: z.enum(['list', 'range', 'text', 'toggle-group', 'unknown']),
  selectedValues: z.array(z.string()).default([]),
  options: z.array(z.object({
    label: z.string(),
    selected: z.boolean(),
  })).optional(),
  range: z.object({
    min: z.string(),
    max: z.string(),
    selectedMin: z.string(),
    selectedMax: z.string(),
  }).optional(),
  textValue: z.string().optional(),
});

const createExecutionSchema = z.object({
  analysisTab: z.string().trim().min(1).optional(),
  reportTitle: z.string().optional(),
  tableTitle: z.string().trim().min(1).optional(),
  selectedFilters: z.array(filterSchema).optional(),
});

const dataDownloadSchema = z.object({
  reportTitle: z.string().trim().min(1).optional(),
  selectedFilters: z.array(filterSchema).optional(),
  periodSelection: z.object({
    year: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
    month: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  }).optional(),
  userCredentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
});

const reportGenerationSchema = z.object({
  jobId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  reportFilters: z.object({
    bases: z.array(z.string().trim().min(1)).optional(),
    teamTypes: z.array(z.enum(['propria', 'parceira'])).optional(),
    teams: z.array(z.string().trim().min(1)).optional(),
    includeExtraTags: z.boolean().optional(),
    dates: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
});

export async function createServer() {
  const server = Fastify({ logger: true, disableRequestLogging: true });
  const jobStore = new InMemoryJobStore();
  const automation = new PuppeteerSpotfireAutomation(environment);
  const downloadTargets = environment.spotfire.downloadTargets;

  const sessionService = new SessionService();
  const queueManager = new ExtractionQueueManager(3); // Max 3 concurrent Puppeteer workers
  const cacheService = new ExtractionCacheService();
  const tempStorage = new TempStorageService();
  const garbageCollector = new FileGarbageCollector(tempStorage.getBaseDataDir());
  garbageCollector.start();

  server.log.info(
    `SPOTFIRE_DOWNLOAD_TABLES: ${downloadTargets.length} table(s) → ${downloadTargets.map(t => `${t.analysisTab}/${t.tableTitle}`).join(', ')}`,
  );

  const startScannerJob = new StartScannerJobUseCase(new PuppeteerSpotfireAutomation(environment), jobStore);
  const getScannerJob = new GetScannerJobUseCase(jobStore);
  const postDownloadReport = new PostDownloadReportService(environment);

  await server.register(cors, {
    origin: true,
  });

  await server.register(cookie);
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  registerAuthRoutes(server, sessionService);

  server.decorate('config', {
    port: environment.port,
  });

  server.get('/api/health', async () => ({
    status: 'ok',
    reportTitle: 'Relatório',
  }));

  server.get('/api/scanner/config/bases', async () => {
    return (environment.report as any).basesConfig;
  });

  server.post('/api/scanner/executions', async (request, reply) => {
    const payload = createExecutionSchema.parse(request.body);
    const userAgent = request.headers['user-agent'] ?? '';
    const clientBrowserType = userAgent.includes('Edg/') ? 'edge' : userAgent.includes('Chrome/') ? 'chrome' : undefined;
    const job = await startScannerJob.execute({ ...payload, clientBrowserType });
    return reply.code(202).send(job);
  });

  server.post('/api/scanner/data-download', async (request, reply) => {
    const payload = dataDownloadSchema.parse(request.body);
    const reportTitle = payload.reportTitle ?? 'Relatório';
    const controller = new AbortController();
    const userAgent = request.headers['user-agent'] ?? '';
    const clientBrowserType = userAgent.includes('Edg/') ? 'edge' : userAgent.includes('Chrome/') ? 'chrome' : undefined;

    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string) || 'default-session';
    const session = sessionService.getSession(sessionId);
    const jobId = randomUUID();

    request.raw.once('aborted', () => {
      controller.abort(createAbortError('client disconnected during data download'));
    });

    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin ?? '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onProgress = (message: string) => {
      sendEvent('progress', { message });
    };

    // Check In-Memory Cache first
    const cacheKey = cacheService.generateKey({
      reportTitle,
      selectedFilters: payload.selectedFilters,
      periodSelection: payload.periodSelection,
      userCredentials: payload.userCredentials,
    });

    const cachedResult = cacheService.get(cacheKey);
    if (cachedResult) {
      onProgress('Dados recuperados instantaneamente do cache em memória!');
      sendEvent('result', cachedResult);
      reply.raw.end();
      return;
    }

    try {
      throwIfAborted(controller.signal);

      const resultData = await queueManager.enqueue({
        id: jobId,
        onProgress,
        task: async () => {
          throwIfAborted(controller.signal);
          const jobDirectory = await tempStorage.prepareJobDirectory(sessionId, jobId);
          onProgress('Diretório isolado preparado. Iniciando extração no Spotfire...');

          const userCredentials = payload.userCredentials?.username
            ? payload.userCredentials
            : session?.spotfirePassword
              ? { username: session.username, password: session.spotfirePassword }
              : undefined;

          const localAutomation = new PuppeteerSpotfireAutomation(environment);
          const result = await localAutomation.runExtraction({
            reportTitle,
            analysisTab: downloadTargets[0].analysisTab,
            tableTitle: downloadTargets[0].tableTitle,
            tablesToExport: downloadTargets.map(t => ({ tab: t.analysisTab, tableTitle: t.tableTitle })),
            selectedFilters: payload.selectedFilters,
            periodSelection: payload.periodSelection,
            clientBrowserType,
            customOutputDir: jobDirectory,
            userCredentials,
            signal: controller.signal,
            onProgress,
          });

          throwIfAborted(controller.signal);

          const allExportedFiles = result.exportedFiles;
          const downloadedFiles: Array<{
            analysisTab: string;
            tableTitle: string;
            fileName: string;
            filePath: string;
          }> = [];

          const skippedTables: Array<{ analysisTab: string; tableTitle: string; reason: string }> = [];

          for (let i = 0; i < downloadTargets.length; i++) {
            const target = downloadTargets[i];
            const exportedFile = allExportedFiles[i];

            if (!exportedFile) {
              const reason = `no file generated (index ${i})`;
              server.log.warn(`[${i + 1}/${downloadTargets.length}] SKIPPED — ${target.tableTitle}: ${reason}`);
              skippedTables.push({ analysisTab: target.analysisTab, tableTitle: target.tableTitle, reason });
              continue;
            }

            const tabSlug = target.analysisTab.replace(/\s+/g, '_');
            const tableSlug = target.tableTitle.replace(/\s+/g, '_');
            const fileLabel = target.fileAlias ?? `${tabSlug}-${tableSlug}`;
            const fileName = `${fileLabel}.csv`;
            const filePath = await moveDownloadedFile(exportedFile, jobDirectory, fileName);

            downloadedFiles.push({
              analysisTab: target.analysisTab,
              tableTitle: target.tableTitle,
              fileName,
              filePath,
            });
          }

          if (downloadedFiles.length === 0) {
            throw new Error('none of the configured tables were downloaded — check Spotfire tab/table names');
          }

          return {
            status: 'completed',
            jobId,
            sessionId,
            reportTitle,
            updatedAt: new Date().toISOString(),
            files: downloadedFiles,
            filters: result.filters ?? [],
            availableTabs: result.availableTabs ?? [],
            availableTables: result.availableTables ?? [],
          };
        },
      });

      // Save to cache for subsequent requests
      cacheService.set(cacheKey, resultData);

      sendEvent('result', resultData);
      reply.raw.end();
    } catch (error) {
      if (isAbortError(error)) {
        sendEvent('error', { message: normalizeAbortMessage(error) });
        reply.raw.end();
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      sendEvent('error', { message: errorMessage });
      reply.raw.end();
    }
  });

  server.get('/api/scanner/executions/:jobId', async (request, reply) => {
    const params = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = await getScannerJob.execute(params.jobId);

    if (!job) {
      return reply.code(404).send({ message: 'job not found' });
    }

    return reply.send(job);
  });

  server.get('/api/scanner/reports/teams', async (request, reply) => {
    const querySchema = z.object({ jobId: z.string().uuid().optional(), sessionId: z.string().optional() });
    const query = querySchema.parse(request.query);
    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string) || query.sessionId || 'default-session';
    
    let outputDir = environment.spotfire.outputDirectory;
    if (query.jobId) {
      outputDir = tempStorage.getJobDirectory(sessionId, query.jobId);
    }

    const { dataDirectory, downloadedFiles } = await resolveReportFiles(
      outputDir,
      downloadTargets,
    );

    const teams = await postDownloadReport.listTeams({ dataDirectory, downloadedFiles });
    return reply.send({ teams });
  });

  server.post('/api/scanner/reports/generate', async (request, reply) => {
    const payload = reportGenerationSchema.parse(request.body);
    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string) || payload.sessionId || 'default-session';
    
    let outputDir = environment.spotfire.outputDirectory;
    if (payload.jobId) {
      outputDir = tempStorage.getJobDirectory(sessionId, payload.jobId);
    }

    const { dataDirectory, downloadedFiles } = await resolveReportFiles(
      outputDir,
      downloadTargets,
    );

    if (downloadedFiles.length === 0) {
      return reply.code(404).send({
        message: 'no downloaded files found to generate report',
      });
    }

    const generatedReport = await postDownloadReport.generate({
      dataDirectory,
      downloadedFiles,
      reportFilters: payload.reportFilters,
    });

    return reply.send({
      status: 'completed',
      generatedReport,
    });
  });

  server.post('/api/scanner/reports/export-data', async (request, reply) => {
    const payload = reportGenerationSchema.parse(request.body);
    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string) || payload.sessionId || 'default-session';
    
    let outputDir = environment.spotfire.outputDirectory;
    if (payload.jobId) {
      outputDir = tempStorage.getJobDirectory(sessionId, payload.jobId);
    }

    const { dataDirectory, downloadedFiles } = await resolveReportFiles(
      outputDir,
      downloadTargets,
    );

    if (downloadedFiles.length === 0) {
      return reply.code(404).send({
        message: 'no downloaded files found to generate export data',
      });
    }

    const generatedReport = await postDownloadReport.generate({
      dataDirectory,
      downloadedFiles,
      reportFilters: payload.reportFilters,
      skipSave: true,
    });

    return reply.send({
      status: 'completed',
      generatedReport,
    });
  });

  server.get('/api/scanner/executions/:jobId/export', async (request, reply) => {
    const params = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = await getScannerJob.execute(params.jobId);

    if (!job?.exportFilePath) {
      return reply.code(404).send({ message: 'export not available for this job' });
    }

    try {
      await access(job.exportFilePath);
    } catch {
      return reply.code(404).send({ message: 'export file not found' });
    }

    const extension = extname(job.exportFilePath).toLowerCase();
    const fileName = basename(job.exportFilePath);
    const contentType = extension === '.csv' || extension === '.txt'
      ? 'text/csv; charset=utf-8'
      : 'application/octet-stream';

    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.type(contentType);

    return reply.send(createReadStream(job.exportFilePath));
  });

  /**
   * Apaga PDFs de exportação da pasta Downloads do usuário.
   * Tipos: 'atual' | 'proprias' | 'parceiras' | 'all'
   * Padrão de nome: Atual_*.pdf, Proprias_*.pdf, Parceiras_*.pdf
   * 'all' remove os três prefixos de uma vez.
   */
  server.post('/api/export/cleanup', async (request, reply) => {
    const schema = z.object({ type: z.enum(['atual', 'proprias', 'parceiras', 'all']) });
    const { type } = schema.parse(request.body);

    const prefixes = type === 'all'
      ? ['Atual_', 'Proprias_', 'Parceiras_']
      : [type === 'atual' ? 'Atual_' : type === 'proprias' ? 'Proprias_' : 'Parceiras_'];
    const downloadsDir = join(homedir(), 'Downloads');

    try {
      const entries = await readdir(downloadsDir);
      const toDelete = entries.filter(f => prefixes.some(p => f.startsWith(p)) && f.endsWith('.pdf'));
      await Promise.all(toDelete.map(f => rm(join(downloadsDir, f), { force: true })));
      server.log.info(`[export/cleanup] ${toDelete.length} arquivo(s) removidos: ${toDelete.join(', ') || 'nenhum'}`);
      return reply.send({ deleted: toDelete.length, files: toDelete });
    } catch (err) {
      server.log.warn({ err }, '[export/cleanup] falha ao limpar Downloads — prosseguindo normalmente');
      return reply.code(200).send({ deleted: 0, files: [], warning: 'cleanup skipped' });
    }
  });

  server.get('/api/scanner/filters/:jobId', async (request, reply) => {
    const params = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = await getScannerJob.execute(params.jobId);

    if (!job) {
      return reply.code(404).send({ message: 'job not found' });
    }

    return reply.send({
      jobId: job.id,
      status: job.status,
      filters: job.filters,
      availableTabs: job.availableTabs,
      availableTables: job.availableTables,
      exportFilePath: job.exportFilePath,
    });
  });

  return server;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      port: number;
    };
  }
}

async function resetDataDirectory(dataDirectory: string): Promise<void> {
  await rm(dataDirectory, { recursive: true, force: true });
  await mkdir(dataDirectory, { recursive: true });
}

async function moveDownloadedFile(sourcePath: string, dataDirectory: string, targetFileName: string): Promise<string> {
  await mkdir(dataDirectory, { recursive: true });

  const targetPath = join(dataDirectory, targetFileName);
  await rm(targetPath, { force: true });
  await rename(sourcePath, targetPath);

  return targetPath;
}

async function cleanupDataDirectory(dataDirectory: string, preservedFileNames: string[]): Promise<void> {
  const preserved = new Set(preservedFileNames);
  const remainingEntries = await readdir(dataDirectory);

  for (const entry of remainingEntries) {
    if (!preserved.has(entry)) {
      const entryPath = join(dataDirectory, entry);
      await rm(entryPath, { recursive: true, force: true });
    }
  }
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw normalizeAbortError(signal.reason);
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError';
}

function normalizeAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    if (reason.name === 'AbortError') {
      return reason;
    }

    const error = new Error(reason.message);
    error.name = 'AbortError';
    return error;
  }

  return createAbortError(
    typeof reason === 'string' && reason.trim().length > 0
      ? reason
      : 'data download aborted',
  );
}

function normalizeAbortMessage(error: Error): string {
  return error.message.trim().length > 0 ? error.message : 'data download aborted';
}

function resolveDownloadedFiles(
  dataDirectory: string,
  targets: ReadonlyArray<{ analysisTab: string; tableTitle: string; fileAlias?: string }>,
): Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }> {
  const resolved: Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }> = [];

  for (const target of targets) {
    const tabSlug = target.analysisTab.replace(/\s+/g, '_');
    const tableSlug = target.tableTitle.replace(/\s+/g, '_');
    const fileLabel = target.fileAlias ?? `${tabSlug}-${tableSlug}`;
    const fileName = `${fileLabel}.csv`;
    const filePath = join(dataDirectory, fileName);

    resolved.push({
      analysisTab: target.analysisTab,
      tableTitle: target.tableTitle,
      fileName,
      filePath,
    });
  }

  return resolved;
}

function resolveDataDirectoryCandidates(configuredOutputDirectory: string): string[] {
  const defaultDir = resolveDefaultDataDir();
  const candidates = [
    configuredOutputDirectory ? resolve(process.cwd(), configuredOutputDirectory) : defaultDir,
    defaultDir,
    resolve(process.cwd(), 'Data'),
    resolve(process.cwd(), '../Data'),
    resolve(process.cwd(), '../../Data'),
    resolve(process.cwd(), 'src/data'),
    resolve(process.cwd(), 'data'),
    resolve(process.cwd(), '../data'),
    resolve(process.cwd(), '../../data'),
  ];

  return Array.from(new Set(candidates));
}

async function resolveReportFiles(
  configuredOutputDirectory: string,
  downloadTargets: ReadonlyArray<{ analysisTab: string; tableTitle: string; fileAlias?: string }>,
): Promise<{
  dataDirectory: string;
  downloadedFiles: Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }>;
}> {
  const candidates = resolveDataDirectoryCandidates(configuredOutputDirectory);

  for (const dataDirectory of candidates) {
    const potentialFiles = resolveDownloadedFiles(dataDirectory, downloadTargets);
    const downloadedFiles = await filterExistingDownloadedFiles(potentialFiles);

    if (downloadedFiles.length > 0) {
      return { dataDirectory, downloadedFiles };
    }

    const fallbackCsvFiles = await resolveAnyCsvFiles(dataDirectory);
    if (fallbackCsvFiles.length > 0) {
      return { dataDirectory, downloadedFiles: fallbackCsvFiles };
    }
  }

  return {
    dataDirectory: candidates[0],
    downloadedFiles: [],
  };
}

async function filterExistingDownloadedFiles(
  files: ReadonlyArray<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }>,
): Promise<Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }>> {
  const resolved: Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }> = [];

  for (const file of files) {
    try {
      await access(file.filePath);
      resolved.push(file);
    } catch {
      // ignore missing files and keep only existing downloaded tables
    }
  }

  return resolved;
}

async function resolveAnyCsvFiles(
  dataDirectory: string,
): Promise<Array<{ analysisTab: string; tableTitle: string; fileName: string; filePath: string }>> {
  const entries = await readdir(dataDirectory).catch(() => [] as string[]);
  const csvEntries = entries.filter((entry) => entry.toLowerCase().endsWith('.csv'));

  return csvEntries.map((entry) => ({
    analysisTab: 'unknown',
    tableTitle: entry.replace(/\.csv$/i, ''),
    fileName: entry,
    filePath: join(dataDirectory, entry),
  }));
}
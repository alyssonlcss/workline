// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import { randomUUID } from 'node:crypto';

import type { ScannerJob } from '../../domain/entities/scanner-job.js';
import type { ScannerRunRequest } from '../../domain/entities/scanner-run-request.js';
import type { ScannerAutomationPort } from '../../domain/ports/scanner-automation.port.js';
import type { ScannerJobStorePort } from '../../domain/ports/scanner-job-store.port.js';
import type { IncidenceEnrichmentService } from '../services/incidence-enrichment.service.js';

export class StartScannerJobUseCase {
  private incidenceService?: IncidenceEnrichmentService | null;

  public constructor(
    private readonly automation: ScannerAutomationPort,
    private readonly jobStore: ScannerJobStorePort,
  ) {}

  public setIncidenceService(service: IncidenceEnrichmentService | null): void {
    this.incidenceService = service;
  }

  public async execute(request: ScannerRunRequest): Promise<ScannerJob> {
    const now = new Date().toISOString();

    const job: ScannerJob = {
      id: randomUUID(),
      status: 'queued',
      request: {
        analysisTab: request.analysisTab,
        reportTitle: request.reportTitle ?? 'Scanner 4.0 - CE',
        tableTitle: request.tableTitle,
        selectedFilters: request.selectedFilters,
      },
      createdAt: now,
      updatedAt: now,
      filters: [],
      availableTabs: [],
      availableTables: [],
    };

    await this.jobStore.create(job);
    void this.run(job);
    
    // Fire and forget prefetch for Openview
    this.triggerOpenviewPrefetch(request);

    return job;
  }

  private triggerOpenviewPrefetch(request: ScannerRunRequest): void {
    if (!this.incidenceService) return;

    const baseFilter = request.selectedFilters?.find(f => f.title === 'Base' || f.title === 'Polo');
    if (!baseFilter || baseFilter.selectedValues.length === 0) return;
    const baseName = baseFilter.selectedValues[0].toUpperCase();

    const baseToPolo: Record<string, string> = {
      'ATLÂNTICO': 'ATLANTICO',
      'ATLANTICO': 'ATLANTICO',
      'CENTRO-NORTE': 'DECEN',
      'NORTE': 'DNORT',
      'CENTRO-SUL': 'DECES',
      'FORTALEZA': 'DEMEF',
      'LESTE': 'DLEST',
      'METROPOLITANA': 'DEMEM',
      'SUL': 'DSUL'
    };
    
    const polo = baseToPolo[baseName] || baseName;

        let dataInicio: string;
    let dataFim: string;

    if ((request as any).reportDates && (request as any).reportDates.length > 0) {
      const sortedDates = [...(request as any).reportDates].sort();
      dataInicio = `${sortedDates[0]} 00:00:00`;
      dataFim = `${sortedDates[sortedDates.length - 1]} 23:59:59`;
    } else {
      let months: string[] = [];
      if (request.periodSelection?.month) {
         months = Array.isArray(request.periodSelection.month) ? request.periodSelection.month : [request.periodSelection.month];
      } else {
         const monthFilter = request.selectedFilters?.find(f => f.title.toLowerCase().includes('mês') || f.title.toLowerCase().includes('mes'));
         if (monthFilter) months = monthFilter.selectedValues;
      }

      let years: string[] = [];
      if (request.periodSelection?.year) {
         years = Array.isArray(request.periodSelection.year) ? request.periodSelection.year : [request.periodSelection.year];
      } else {
         const yearFilter = request.selectedFilters?.find(f => f.title.toLowerCase().includes('ano'));
         if (yearFilter) years = yearFilter.selectedValues;
      }

      if (months.length === 0) return;

      const monthAbbrevToNum: Record<string, string> = {
        jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
        jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
      };

      months = months.filter(m => m.toLowerCase() !== 'all');
      if (months.length === 0) return;

      months.sort((a, b) => parseInt(monthAbbrevToNum[a.toLowerCase()] ?? '0') - parseInt(monthAbbrevToNum[b.toLowerCase()] ?? '0'));
      
      years = years.filter(y => y.toLowerCase() !== 'all');
      if (years.length > 0) years.sort();

      const firstMonthStr = months[0].toLowerCase();
      const lastMonthStr = months[months.length - 1].toLowerCase();
      
      const firstMonthNum = monthAbbrevToNum[firstMonthStr] || '01';
      const lastMonthNum = monthAbbrevToNum[lastMonthStr] || '12';

      const firstYear = years.length > 0 ? years[0] : new Date().getFullYear().toString();
      const lastYear = years.length > 0 ? years[years.length - 1] : firstYear;

      dataInicio = `${firstYear}-${firstMonthNum}-01 00:00:00`;
      
      const now = new Date();
      let endDay = new Date(parseInt(lastYear), parseInt(lastMonthNum), 0).getDate();
      if (parseInt(lastYear) === now.getFullYear() && parseInt(lastMonthNum) === now.getMonth() + 1) {
         endDay = now.getDate();
      }
      const endDayStr = endDay.toString().padStart(2, '0');
      dataFim = `${lastYear}-${lastMonthNum}-${endDayStr} 23:59:59`;
    }
  }

  private async run(job: ScannerJob): Promise<void> {
    const runningJob: ScannerJob = {
      ...job,
      status: 'running',
      updatedAt: new Date().toISOString(),
    };

    await this.jobStore.update(runningJob);

    try {
      const result = await this.automation.runExtraction({
        analysisTab: runningJob.request.analysisTab,
        reportTitle: runningJob.request.reportTitle,
        tableTitle: runningJob.request.tableTitle,
        selectedFilters: runningJob.request.selectedFilters,
      });

      await this.jobStore.update({
        ...runningJob,
        status: 'completed',
        filters: result.filters,
        availableTabs: result.availableTabs,
        availableTables: result.availableTables,
        exportFilePath: result.exportFilePath,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown extraction error';

      await this.jobStore.update({
        ...runningJob,
        status: 'failed',
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
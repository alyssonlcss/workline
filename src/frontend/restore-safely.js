const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'dashboard.component.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Imports
content = content.replace(
  /import { ScannerApiService, GeneratedReport, [^}]+ } from '\.\.\/\.\.\/core\/api\/scanner-api\.service';/,
  (match) => {
    // just inject at the end before }
    return match.replace(' } from', ', EnrichedIncidence, IncidenceTag, IncidenceFlag } from');
  }
);
if (!content.includes('EnrichedIncidence')) {
  content = content.replace(
    /import {([^}]+)} from '\.\.\/\.\.\/core\/api\/scanner-api\.service';/,
    "import {$1, EnrichedIncidence, IncidenceTag, IncidenceFlag} from '../../core/api/scanner-api.service';"
  );
}

// 2. State & Getters
const stateBlock = `
  protected readonly enrichedIncidenceData = signal<Map<string, EnrichedIncidence>>(new Map());
  protected readonly incidenceLoadingSet = signal<Set<string>>(new Set());

  protected getIncidenceTags(teamName: string): IncidenceTag[] {
    const data = this.enrichedIncidenceData().get(teamName);
    return data?.tags ?? [];
  }

  protected getIncidenceFlags(teamName: string): IncidenceFlag[] {
    const data = this.enrichedIncidenceData().get(teamName);
    return data?.flags ?? [];
  }

  protected readonly filterDrawerOpen`;

content = content.replace(/[\s]*protected readonly filterDrawerOpen/, stateBlock);

// 3. pdfHelpers
content = content.replace(
  /stripEmojiForPdf: \(t: string\) => this\.stripEmojiForPdf\(t\),/g,
  `stripEmojiForPdf: (t: string) => this.stripEmojiForPdf(t),
      getIncidenceTags: (teamName: string) => this.getIncidenceTags(teamName),
      getIncidenceFlags: (teamName: string) => this.getIncidenceFlags(teamName),`
);

// 4. fetchIncidenceBatch and triggerIncidenceBatchFetch
const methodsBlock = `
  protected async fetchIncidenceBatch(teamToOsMap: Map<string, string>): Promise<void> {
    const incidenceNumbers = Array.from(new Set(teamToOsMap.values()));
    if (incidenceNumbers.length === 0) return;

    try {
      const { firstValueFrom } = await import('rxjs');
      const response = await firstValueFrom(this.api.enrichIncidences(incidenceNumbers));
      const dataMap = new Map(this.enrichedIncidenceData());
      
      const osToData = new Map<string, EnrichedIncidence>();
      for (const enriched of response.results) {
        osToData.set(enriched.incidenceNumber, enriched);
      }
      
      for (const [team, osNumber] of teamToOsMap.entries()) {
        const enriched = osToData.get(osNumber);
        if (enriched) {
          dataMap.set(team, enriched);
        }
      }
      
      this.enrichedIncidenceData.set(dataMap);
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch incidence batch:', err);
    }
  }

  private triggerIncidenceBatchFetch(report: GeneratedReport): void {
    const teamToOsMap = new Map<string, string>();
    
    const analysisTypes = [
      'osDiaAnalysis',
      'utilizacaoAnalysis',
      'tmeImpAnalysis',
      'primeiroLoginAnalysis',
      'primeiroDeslocAnalysis',
      'retornoBaseAnalysis'
    ] as const;

    for (const key of analysisTypes) {
      const arr = report.specialAnalysis?.[key] as any[];
      if (arr) {
        for (const ev of arr) {
          if (ev.team && !teamToOsMap.has(ev.team)) {
            let nrOrdem = '';
            const orders = (ev.flaggedOrders || ev.orders || ev.tempoPadraoVazioOrders || ev.missingOrders || []) as any[];
            if (orders.length > 0 && orders[0].nr_ordem) {
               nrOrdem = orders[0].nr_ordem;
            }
            if (nrOrdem) {
               teamToOsMap.set(ev.team, nrOrdem);
            }
          }
        }
      }
    }
    
    if (teamToOsMap.size > 0) {
      this.fetchIncidenceBatch(teamToOsMap);
    }
  }

  private updateReportDataAndDates`;

content = content.replace(/[\s]*private updateReportDataAndDates/, methodsBlock);

// 5. trigger it!
content = content.replace(
  /this\.reportData\.set\(report\);/,
  `this.reportData.set(report);\n    this.triggerIncidenceBatchFetch(report);`
);

fs.writeFileSync(file, content);
console.log('Restored all UI integrations safely.');

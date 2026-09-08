const fs = require('fs');
const file = 'src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

const declRegex = /protected readonly reportData = signal<GeneratedReport \| null>\(null\);/;
if (!content.includes('signal<Map<string, import')) {
  content = content.replace(
    declRegex,
    `protected readonly reportData = signal<GeneratedReport | null>(null);
  protected readonly enrichedIncidenceData = signal<Map<string, import('../../core/api/scanner-api.service').EnrichedIncidence>>(new Map());`
  );
}

if (!content.includes('protected async fetchIncidenceBatch')) {
  const methods = `  protected async fetchIncidenceBatch(incidencesToFetch: { team: string; incidence: string }[]): Promise<void> {
    if (incidencesToFetch.length === 0) return;

    try {
      const { firstValueFrom } = await import('rxjs');
      const response = await firstValueFrom(this.api.enrichIncidences(incidencesToFetch));
      const dataMap = new Map(this.enrichedIncidenceData());
      
      for (const enriched of response.results) {
         const strOs = String(enriched.incidenceNumber).padStart(10, '0');
         for (const req of incidencesToFetch) {
            if (req.incidence === strOs) {
               dataMap.set(\`\${req.team}|\${strOs}\`, enriched);
            }
         }
      }
      
      this.enrichedIncidenceData.set(dataMap);
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch incidence batch:', err);
    }
  }

  private triggerIncidenceBatchFetch(report: GeneratedReport): void {
    const ordersToFetch = new Map<string, { team: string, incidence: string }>();
    
    const analysisTypes = [
      'osDiaAnalysis', 'utilizacaoAnalysis', 'tmeImpAnalysis', 
      'primeiroLoginAnalysis', 'primeiroDeslocAnalysis', 'retornoBaseAnalysis'
    ] as const;

    for (const type of analysisTypes) {
      const arr = report.specialAnalysis?.[type] as any[];
      if (arr) {
        for (const ev of arr) {
          if (ev.team) {
            const topOrders = (ev.flaggedOrders || ev.orders || ev.tempoPadraoVazioOrders || ev.missingOrders || []) as any[];
            const extraOrders = (ev.extraFlaggedOrders || []) as any[];
            const groups = this.allDateGroupsForKpi(topOrders, extraOrders);
            for (const grp of groups) {
               for (const order of grp.visibleItems) {
                 if (order.nr_ordem) {
                   const strOs = String(order.nr_ordem).padStart(10, '0');
                   const mapKey = \`\${ev.team}|\${strOs}\`;
                   if (!ordersToFetch.has(mapKey)) {
                     ordersToFetch.set(mapKey, { team: ev.team, incidence: strOs });
                   }
                 }
               }
            }
          }
        }
      }
    }
    
    if (ordersToFetch.size > 0) {
      this.fetchIncidenceBatch(Array.from(ordersToFetch.values()));
    }
  }`;

  content = content.replace(
    /private updateReportDataAndDates\(report: GeneratedReport\) \{/,
    `${methods}\n\n  private updateReportDataAndDates(report: GeneratedReport) {`
  );

  content = content.replace(
    /this\.reportData\.set\(report\);/,
    `this.reportData.set(report);
    this.triggerIncidenceBatchFetch(report);`
  );
}

fs.writeFileSync(file, content);
console.log('Injected');

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'dashboard.component.ts');
let content = fs.readFileSync(file, 'utf-8');

const targetMethod = `protected toggleDateExpanded(kpiKey: string, team: string, dateRef: string): void {
    const key = \`\${kpiKey}|\${team}|\${dateRef}\`;
    this.expandedEvidenceDates.update((cur) => ({ ...cur, [key]: !cur[key] }));
  }`;

const replacementMethod = `protected toggleDateExpanded(kpiKey: string, team: string, dateRef: string): void {
    const key = \`\${kpiKey}|\${team}|\${dateRef}\`;
    this.expandedEvidenceDates.update((cur) => ({ ...cur, [key]: !cur[key] }));

    // Lazy load the hidden items if expanded
    if (this.expandedEvidenceDates()[key]) {
      this.lazyLoadHiddenIncidences(kpiKey, team, dateRef);
    }
  }

  private lazyLoadHiddenIncidences(kpiKey: string, team: string, dateRef: string): void {
    const report = this.reportData();
    if (!report) return;

    let arr: any[] | undefined = undefined;
    if (kpiKey === 'OS Dia') arr = report.specialAnalysis?.osDiaAnalysis;
    else if (kpiKey === 'Eficiência') arr = report.specialAnalysis?.utilizacaoAnalysis;
    else if (kpiKey === 'Utilização') arr = report.specialAnalysis?.utilizacaoAnalysis;
    else if (kpiKey === 'TME IMP') arr = report.specialAnalysis?.tmeImpAnalysis;
    else if (kpiKey === '1º Login') arr = report.specialAnalysis?.primeiroLoginAnalysis;
    else if (kpiKey === '1º Desloc.') arr = report.specialAnalysis?.primeiroDeslocAnalysis;
    else if (kpiKey === 'Retorno Base') arr = report.specialAnalysis?.retornoBaseAnalysis;
    
    const analysisTypes = [
      'osDiaAnalysis', 'utilizacaoAnalysis', 'tmeImpAnalysis', 
      'primeiroLoginAnalysis', 'primeiroDeslocAnalysis', 'retornoBaseAnalysis'
    ] as const;

    const ordersToFetch = new Map<string, { team: string, incidence: string }>();

    for (const type of analysisTypes) {
      const typeArr = report.specialAnalysis?.[type] as any[];
      if (typeArr) {
        const ev = typeArr.find(a => a.team === team);
        if (ev) {
           const topOrders = (ev.flaggedOrders || ev.orders || ev.tempoPadraoVazioOrders || ev.missingOrders || []) as any[];
           const extraOrders = (ev.extraFlaggedOrders || []) as any[];
           const groups = this.allDateGroupsForKpi(topOrders, extraOrders);
           const grp = groups.find(g => g.dateRef === dateRef);
           if (grp) {
              for (const order of grp.hiddenItems) {
                 if (order.nr_ordem) {
                   const strOs = String(order.nr_ordem).padStart(10, '0');
                   const mapKey = \`\${ev.team}|\${strOs}\`;
                   if (!this.enrichedIncidenceData().has(mapKey) && !ordersToFetch.has(mapKey)) {
                     ordersToFetch.set(mapKey, { team: ev.team, incidence: strOs });
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

if (content.includes(targetMethod)) {
  content = content.replace(targetMethod, replacementMethod);
  fs.writeFileSync(file, content);
  console.log('Injected lazy load hidden incidences logic');
} else if (content.includes('lazyLoadHiddenIncidences')) {
  console.log('Lazy load logic already injected');
} else {
  console.log('Failed to find target method to replace');
}

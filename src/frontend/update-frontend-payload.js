const fs = require('fs');
const path = require('path');

// 1. Update frontend scanner-api.service.ts
const frontendFile = path.join(process.cwd(), 'src', 'app', 'core', 'api', 'scanner-api.service.ts');
let frontendContent = fs.readFileSync(frontendFile, 'utf-8');
frontendContent = frontendContent.replace(
  /public enrichIncidences\(incidences: string\[\]\): Observable<\{ results: EnrichedIncidence\[\] \}> \{[\s\S]*?return this\.http\.post<\{ results: EnrichedIncidence\[\] \}>\(\n\s*`\$\{this\.API_URL\}\/incidence\/enrich`,\n\s*\{ incidences \},\n\s*\);/,
  `public enrichIncidences(incidences: { incidence: string; team: string }[]): Observable<{ results: EnrichedIncidence[] }> {
    return this.http.post<{ results: EnrichedIncidence[] }>(
      \`\${this.API_URL}/incidence/enrich\`,
      { incidences },
    );`
);
fs.writeFileSync(frontendFile, frontendContent);

// 2. Update dashboard.component.ts fetchIncidenceBatch and triggerIncidenceBatchFetch
const dashboardFile = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'dashboard.component.ts');
let dashboardContent = fs.readFileSync(dashboardFile, 'utf-8');
dashboardContent = dashboardContent.replace(
  /protected async fetchIncidenceBatch\(teamToOsMap: Map<string, string>\): Promise<void> \{[\s\S]*?const incidenceNumbers = Array\.from\(new Set\(teamToOsMap\.values\(\)\)\);[\s\S]*?if \(incidenceNumbers\.length === 0\) return;[\s\S]*?try \{[\s\S]*?const \{ firstValueFrom \} = await import\('rxjs'\);[\s\S]*?const response = await firstValueFrom\(this\.api\.enrichIncidences\(incidenceNumbers\)\);/,
  `protected async fetchIncidenceBatch(teamToOsMap: Map<string, string>): Promise<void> {
    const incidences = Array.from(teamToOsMap.entries()).map(([team, incidence]) => ({ team, incidence }));
    if (incidences.length === 0) return;

    try {
      const { firstValueFrom } = await import('rxjs');
      const response = await firstValueFrom(this.api.enrichIncidences(incidences));`
);
fs.writeFileSync(dashboardFile, dashboardContent);

console.log('Updated Frontend');

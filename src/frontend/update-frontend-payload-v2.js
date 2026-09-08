const fs = require('fs');
const path = require('path');

const frontendFile = path.join(process.cwd(), 'src', 'app', 'core', 'api', 'scanner-api.service.ts');
let frontendContent = fs.readFileSync(frontendFile, 'utf-8');

frontendContent = frontendContent.replace(
  /public enrichIncidences\(incidences: string\[\]\): Observable<\{ results: EnrichedIncidence\[\] \}> \{[\s\S]*?return this\.http\.post<\{ results: EnrichedIncidence\[\] \}>\([\s\S]*?\);[\s\S]*?\}/,
  `public enrichIncidences(incidences: { incidence: string; team: string }[]): Observable<{ results: EnrichedIncidence[] }> {
    return this.http.post<{ results: EnrichedIncidence[] }>(
      \`\${this.API_URL}/incidence/enrich\`,
      { incidences },
    );
  }`
);

fs.writeFileSync(frontendFile, frontendContent);
console.log('Fixed frontend payload properly');

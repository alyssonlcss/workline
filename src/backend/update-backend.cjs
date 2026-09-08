const fs = require('fs');
const path = require('path');

// 1. Update backend create-server.ts schema
const backendFile = path.join(process.cwd(), 'src', 'app', 'presentation', 'http', 'create-server.ts');
let backendContent = fs.readFileSync(backendFile, 'utf-8');
backendContent = backendContent.replace(
  /const enrichBatchSchema = z\.object\(\{\n\s*incidences: z\.array\(z\.string\(\)\.trim\(\)\.min\(1\)\)\.min\(1\)\.max\(100\),\n\s*\}\);/,
  `const enrichBatchSchema = z.object({
    incidences: z.array(z.object({
      incidence: z.string().trim().min(1),
      team: z.string().trim().optional()
    })).min(1).max(100),
  });`
);
fs.writeFileSync(backendFile, backendContent);

// 2. Update incidence-enrichment.service.ts
const serviceFile = path.join(process.cwd(), 'src', 'app', 'application', 'services', 'incidence-enrichment.service.ts');
let serviceContent = fs.readFileSync(serviceFile, 'utf-8');

serviceContent = serviceContent.replace(
  /public async enrichBatch\(incidenceNumbers: string\[\]\): Promise<EnrichedIncidence\[\]> \{/,
  `public async enrichBatch(incidenceNumbers: { incidence: string, team?: string }[]): Promise<EnrichedIncidence[]> {`
);

serviceContent = serviceContent.replace(
  /for \(const number of incidenceNumbers\) \{[\s\S]*?const enriched = await this\.enrichSingle\(number\);/,
  `for (const item of incidenceNumbers) {
      const enriched = await this.enrichSingle(item.incidence, item.team);`
);

serviceContent = serviceContent.replace(
  /public async enrichSingle\(incidenceNumber: string\): Promise<EnrichedIncidence> \{/,
  `public async enrichSingle(incidenceNumber: string, team?: string): Promise<EnrichedIncidence> {`
);

serviceContent = serviceContent.replace(
  /console\.log\(`\[IncidenceEnrichment\] enrichSingle fetching data for incidence: \$\{incidenceNumber\}`\);/,
  `const teamLog = team ? \` (Team: \${team})\` : '';
    console.log(\`[IncidenceEnrichment] enrichSingle fetching data for incidence: \${incidenceNumber}\${teamLog}\`);`
);

// Add the total log inside the try block
serviceContent = serviceContent.replace(
  /const payload = items\.find\([\s\S]*?\) \?\? items\[0\];/,
  `const payload = items.find(
        (item) => String(item.incidencia) === String(incidenceNumber),
      ) ?? items[0];

      const total = (response as any).total ?? items.length;
      console.log(\`[IncidenceEnrichment] enrichSingle API responded with Status 200, Total: \${total} for incidence: \${incidenceNumber}\${teamLog}\`);`
);

fs.writeFileSync(serviceFile, serviceContent);

console.log('Updated Backend');

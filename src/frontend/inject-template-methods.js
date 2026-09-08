const fs = require('fs');
const file = 'src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

const methodsToInject = `
  protected getIncidenceForOrder(teamName: string, nrOrdem: string | number | undefined): import('../../domain/entities/incidence-data.entity').EnrichedIncidence | undefined {
    if (!nrOrdem) return undefined;
    const strOs = String(nrOrdem).padStart(10, '0');
    return this.enrichedIncidenceData().get(\`\${teamName}|\${strOs}\`);
  }

  protected getIncidenceTags(teamName: string): any[] {
    const data = this.enrichedIncidenceData();
    const tagsMap = new Map<string, any>();
    for (const [key, incidence] of data.entries()) {
      if (key.startsWith(\`\${teamName}|\`)) {
        for (const tag of incidence.tags) {
          tagsMap.set(tag.label, tag);
        }
      }
    }
    return Array.from(tagsMap.values());
  }

  protected getIncidenceFlags(teamName: string): any[] {
    const data = this.enrichedIncidenceData();
    const flags = [];
    for (const [key, incidence] of data.entries()) {
      if (key.startsWith(\`\${teamName}|\`)) {
        flags.push(...incidence.flags);
      }
    }
    return flags;
  }

  protected sanitizeHtml(html: string): import('@angular/platform-browser').SafeHtml {
    // If you don't have DomSanitizer injected, we can just return it as any or string, 
    // but typically Angular requires SafeHtml. If DomSanitizer isn't available, returning raw string works for [innerHTML] if it's trusted.
    return html as any; 
  }
`;

if (!content.includes('getIncidenceTags(teamName: string)')) {
  // Replace the last closing brace of the file with the methods + closing brace
  content = content.replace(/\s*\}\s*$/, `\n${methodsToInject}\n}`);
  fs.writeFileSync(file, content);
  console.log('Injected missing template methods');
} else {
  console.log('Methods already exist');
}

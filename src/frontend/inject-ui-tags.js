const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'dashboard.component.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add tags after team name in the card headers
const tagHtml = `<span class="rpt-osdia-team">{{ analysis.team }}</span>
                          <ng-container *ngFor="let tag of getIncidenceTags(analysis.team)">
                            <span class="rpt-osdia-badge" [class.rpt-osdia-badge--blue]="tag.type === 'blue'" [class.rpt-osdia-badge--orange]="tag.type === 'orange'">
                              {{ tag.label }}
                            </span>
                          </ng-container>`;

content = content.replace(/<span class="rpt-osdia-team">\{\{\s*analysis\.team\s*\}\}<\/span>/g, tagHtml);

// 2. Add flags in the alerts lists
// We need to match the closing </ul> of the alerts list, but ONLY if we are inside a context that has `ev` and `analysis.team`.
// Fortunately, the alerts lists are standard: 
// <ul class="osdia-ev-alerts">
//   <li *ngFor="let alert of getAlerts('...', ev)" ...>...</li>
// </ul>

const flagsHtml = `  <ng-container *ngIf="getIncidenceForOrder(analysis.team, ev.nr_ordem) as inc">
                                  <li *ngFor="let flag of inc.flags" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="flag.type === 'orange'" [class.osdia-ev-alert--blue]="flag.type === 'blue'">
                                    <strong *ngIf="flag.type === 'blue'">Localização: </strong>
                                    <strong *ngIf="flag.type === 'orange'">Obs: </strong>
                                    <a *ngIf="flag.linkUrl" [href]="flag.linkUrl" target="_blank" class="blue-flag-link">{{ flag.label }}</a>
                                    <span *ngIf="!flag.linkUrl" [innerHTML]="flag.label"></span>
                                  </li>
                                </ng-container>
                              </ul>`;

content = content.replace(/<\/ul>/g, (match, offset, string) => {
  // Only replace if preceded by `osdia-ev-alert`
  const context = string.substring(offset - 200, offset);
  if (context.includes('osdia-ev-alerts') || context.includes('getAlerts(')) {
    return flagsHtml;
  }
  return match;
});

// 3. Add getIncidenceForOrder method
if (!content.includes('getIncidenceForOrder(')) {
  content = content.replace(
    /protected getIncidenceTags\(teamName: string\): IncidenceTag\[\] \{/,
    `protected getIncidenceForOrder(teamName: string, nrOrdem: string | number | undefined): import('../../domain/entities/incidence-data.entity').EnrichedIncidence | undefined {
    if (!nrOrdem) return undefined;
    const inc = this.enrichedIncidenceData().get(teamName);
    if (inc && String(inc.incidenceNumber) === String(nrOrdem)) {
      return inc;
    }
    return undefined;
  }

  protected getIncidenceTags(teamName: string): IncidenceTag[] {`
  );
}

// 4. Update pdfHelpers
if (!content.includes('getIncidenceForOrder: (team: string, ordem: any) => this.getIncidenceForOrder(team, ordem),')) {
  content = content.replace(
    /getIncidenceTags: \(teamName: string\) => this\.getIncidenceTags\(teamName\),/,
    `getIncidenceForOrder: (team: string, ordem: any) => this.getIncidenceForOrder(team, ordem),
      getIncidenceTags: (teamName: string) => this.getIncidenceTags(teamName),`
  );
}

fs.writeFileSync(file, content);
console.log('Fixed UI template with tags and flags!');

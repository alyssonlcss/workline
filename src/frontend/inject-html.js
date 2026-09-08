const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'dashboard.component.ts');
let content = fs.readFileSync(file, 'utf-8');

// Replace team name with tags
content = content.replace(
  /<span class="rpt-osdia-team">{{ analysis\.team }}(.*?)<\/span>/g,
  `<span class="rpt-osdia-team">{{ analysis.team }}$1</span>
                        <span class="incidence-tags-row" *ngIf="getIncidenceTags(analysis.team).length > 0">
                          <span *ngFor="let tag of getIncidenceTags(analysis.team)" class="incidence-tag" [ngClass]="'incidence-tag--' + tag.color">{{ tag.label }}</span>
                        </span>`
);

// Inject flags after card meta
content = content.replace(
  /(<div class="rpt-osdia-card-meta">[\s\S]*?<\/div>)/g,
  `$1\n                      <div *ngFor="let flag of getIncidenceFlags(analysis.team)" class="incidence-flag" [ngClass]="'incidence-flag--' + flag.color">\n                        <span class="incidence-flag-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></span>\n                        <span [innerHTML]="sanitizeHtml(flag.html)"></span>\n                      </div>`
);

fs.writeFileSync(file, content);
console.log('Template updated successfully');

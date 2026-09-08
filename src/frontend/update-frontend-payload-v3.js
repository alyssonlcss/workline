const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove all team-level getIncidenceFlags blocks
content = content.replace(/[ \t]*<div \*ngFor="let flag of getIncidenceFlags\(analysis\.team\)"[\s\S]*?<span \[innerHTML\]="sanitizeHtml\(flag\.html\)"><\/span>\s*<\/div>\n/g, '');

// 2. Inject tags into osdia-ev-header
content = content.replace(/<div class="osdia-ev-header">/g, 
  `<div class="osdia-ev-header">
    <ng-container *ngIf="getIncidenceForOrder(analysis.team, ev.nr_ordem) as inc">
      <span class="rpt-osdia-flag" *ngFor="let t of inc.tags" [style.background-color]="t.color === 'blue' ? '#0b5394' : '#e67c22'" style="color: white; border: none">{{ t.label }}</span>
    </ng-container>`);

// 3. Inject flags into osdia-ev-alerts (we append to the end of the ul)
content = content.replace(/<ul class="osdia-ev-alerts">([\s\S]*?)<\/ul>/g,
  `<ul class="osdia-ev-alerts">$1  <ng-container *ngIf="getIncidenceForOrder(analysis.team, ev.nr_ordem) as inc">
    <li *ngFor="let flag of inc.flags" class="osdia-ev-alert">
      <strong [style.color]="flag.color === 'blue' ? '#4a90d9' : 'inherit'" style="margin-right: 4px;">[Openview]</strong>
      <span [innerHTML]="sanitizeHtml(flag.html)"></span>
    </li>
  </ng-container>
</ul>`);

fs.writeFileSync(file, content);
console.log('Refactor complete');

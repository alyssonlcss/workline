const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Regex to capture the ng-container and the osdia-ev-ordem span, and swap their positions
content = content.replace(
  /(<ng-container \*ngIf="getIncidenceForOrder\(analysis\.team, ev\.nr_ordem\) as inc">\s*<span class="rpt-osdia-badge rpt-osdia-badge--first" \*ngFor="let t of inc\.tags">{{ t\.label }}<\/span>\s*<\/ng-container>)\s*(<span class="osdia-ev-ordem">[^<]+<\/span>)/g,
  '$2\n                                $1'
);

fs.writeFileSync(file, content);
console.log('Tags moved to the right successfully');

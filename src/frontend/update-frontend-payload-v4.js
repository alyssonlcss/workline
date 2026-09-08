const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<span class="rpt-osdia-flag" \*ngFor="let t of inc\.tags" \[style\.background-color\]="t\.color === 'blue' \? '#0b5394' : '#e67c22'" style="color: white; border: none">{{ t\.label }}<\/span>/g,
  `<span class="rpt-osdia-badge rpt-osdia-badge--first" *ngFor="let t of inc.tags">{{ t.label }}</span>`
);

fs.writeFileSync(file, content);
console.log('Style applied successfully');

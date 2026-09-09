const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

const pattern = /[ \t]*<div \*ngFor="let flag of getIncidenceFlags\(analysis\.team\)" class="incidence-flag"[^>]*>[\s\S]*?<\/div>\r?\n/g;
content = content.replace(pattern, '');

fs.writeFileSync(file, content);
console.log('Removed getIncidenceFlags from all KPIs');

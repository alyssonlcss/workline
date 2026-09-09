const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Safely remove ng-container block (limit length to 300 chars to avoid greedy match)
content = content.replace(/[ \t]*<ng-container \*ngFor="let tag of getIncidenceTags\(analysis\.team\)">[\s\S]{1,300}?<\/ng-container>\n/g, '');

// Safely remove incidence-tags-row block
content = content.replace(/[ \t]*<span class="incidence-tags-row" \*ngIf="getIncidenceTags\(analysis\.team\)\.length > 0">[\s\S]{1,300}?<\/span>\n/g, '');

fs.writeFileSync(file, content);
console.log('Removed team-level tags SAFELY');

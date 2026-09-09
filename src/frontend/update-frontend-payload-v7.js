const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove incidence-tags-row blocks
content = content.replace(/[ \t]*<span class="incidence-tags-row"[^>]*>[\s\S]*?<\/span>\s*<\/span>\n/g, '');

// Remove ng-container *ngFor="let tag of getIncidenceTags..." blocks
content = content.replace(/[ \t]*<ng-container \*ngFor="let tag of getIncidenceTags\(analysis\.team\)">[\s\S]*?<\/ng-container>\n/g, '');

fs.writeFileSync(file, content);
console.log('Removed team-level tags successfully');

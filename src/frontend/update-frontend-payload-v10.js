const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove [Openview]
content = content.replace(
  /<strong \[style\.color\]="flag\.color === 'blue' \? '#4a90d9' : 'inherit'" style="margin-right: 4px;">\[Openview\]<\/strong>\s*/g,
  ''
);

// 2. Remove team-level getIncidenceTags ng-container
content = content.replace(/[ \t]*<ng-container \*ngFor="let tag of getIncidenceTags\(analysis\.team\)">[\s\S]{1,200}?<\/ng-container>\r?\n/g, '');

// 3. Remove team-level getIncidenceTags incidence-tags-row
content = content.replace(/[ \t]*<span class="incidence-tags-row"[^>]*>[\s\S]{1,200}?<\/span>\r?\n/g, '');

fs.writeFileSync(file, content);
console.log('Fixed tags correctly');

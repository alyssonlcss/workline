const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove [Openview]
content = content.replace(
  /<strong \[style\.color\]="flag\.color === 'blue' \? '#4a90d9' : 'inherit'" style="margin-right: 4px;">\[Openview\]<\/strong>\s*/g,
  ''
);

// 2. Safely remove incidence-tags-row using a custom loop to find the exact block and replace it
// Since regex is tricky with newlines, we will match the start and end precisely.
const pattern1 = /<ng-container \*ngFor="let tag of getIncidenceTags\(analysis\.team\)">[\s\S]*?<\/ng-container>/g;
content = content.replace(pattern1, '');

const pattern2 = /<span class="incidence-tags-row"[^>]*>[\s\S]*?<\/span>\s*<\/span>/g;
content = content.replace(pattern2, '');

fs.writeFileSync(file, content);
console.log('Fixed tags completely and cleanly');

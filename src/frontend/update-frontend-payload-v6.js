const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<strong \[style\.color\]="flag\.color === 'blue' \? '#4a90d9' : 'inherit'" style="margin-right: 4px;">\[Openview\]<\/strong>\s*/g,
  ''
);

fs.writeFileSync(file, content);

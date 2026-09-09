const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace the previous CSS for ::ng-deep .osdia-ev-alert--info,
const oldCssRegex = /^[ \t]*::ng-deep \.osdia-ev-alert--info,[\s\S]*?color: #4a90d9 !important;\s*\}/m;

const newCss = `      ::ng-deep .osdia-ev-alert--info {
        color: inherit;
      }
      ::ng-deep .osdia-ev-alert--info b,
      ::ng-deep .osdia-ev-alert--info strong {
        color: #4a90d9 !important;
      }`;

content = content.replace(oldCssRegex, newCss);

fs.writeFileSync(file, content);
console.log('Fixed CSS to only color title blue');

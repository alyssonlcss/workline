const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace #4a90d9 with #1d4ed8 in the CSS rules for the info alert
content = content.replace(
  /::ng-deep \.osdia-ev-alert--info b,\s*::ng-deep \.osdia-ev-alert--info strong\s*\{\s*color:\s*#4a90d9 !important;\s*\}/g,
  `::ng-deep .osdia-ev-alert--info b,
      ::ng-deep .osdia-ev-alert--info strong {
        color: #1d4ed8 !important;
      }`
);

// Replace %234a90d9 with %231d4ed8 in the SVG
content = content.replace(
  /stroke="%234a90d9"/g,
  'stroke="%231d4ed8"'
);

fs.writeFileSync(file, content);
console.log('Changed info alert color to darker blue #1d4ed8');

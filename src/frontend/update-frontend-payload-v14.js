const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace the previous CSS for osdia-ev-alert--info with one using ::ng-deep
const oldCss = /^[ \t]*\.osdia-ev-alert--info b,\s*\.osdia-ev-alert--info strong\s*\{\s*color:\s*#4a90d9;\s*\}/gm;
content = content.replace(oldCss, '');

const cssToAdd = `
      ::ng-deep .osdia-ev-alert--info,
      ::ng-deep .osdia-ev-alert--info * {
        color: #4a90d9 !important;
      }
`;
if (!content.includes('::ng-deep .osdia-ev-alert--info')) {
  content = content.replace(
    /(\.osdia-ev-alert--info::before\s*{[^}]+})/,
    match => match + '\n' + cssToAdd
  );
}

fs.writeFileSync(file, content);
console.log('Fixed dynamic CSS for info alerts');

const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add [class.osdia-ev-alert--info]="flag.color === 'blue'" to all Openview flags
content = content.replace(
  /<li \*ngFor="let flag of inc\.flags" class="osdia-ev-alert">/g,
  '<li *ngFor="let flag of inc.flags" class="osdia-ev-alert" [class.osdia-ev-alert--info]="flag.color === \'blue\'">'
);

// 2. Add CSS rules for .osdia-ev-alert--info
const cssToAdd = `
      .osdia-ev-alert--info::before {
        content: 'ℹ';
        color: #4a90d9;
        font-size: 0.8rem;
      }
      .osdia-ev-alert--info b, .osdia-ev-alert--info strong {
        color: #4a90d9;
      }
`;
if (!content.includes('.osdia-ev-alert--info::before')) {
  content = content.replace(
    /\.osdia-ev-alert--warn::before\s*{[^}]+}/,
    match => match + '\n' + cssToAdd
  );
}

fs.writeFileSync(file, content);
console.log('Added info alert styles and classes successfully');

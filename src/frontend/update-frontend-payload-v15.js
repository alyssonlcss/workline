const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace the current .osdia-ev-alert--info::before rule
const oldCss = /^[ \t]*\.osdia-ev-alert--info::before\s*\{[\s\S]*?\}/m;

const newCss = `      .osdia-ev-alert--info::before {
        content: '';
        width: 12px;
        height: 12px;
        position: absolute;
        left: 0;
        top: 3px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234a90d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>');
        background-size: contain;
        background-repeat: no-repeat;
      }`;

content = content.replace(oldCss, newCss);

fs.writeFileSync(file, content);
console.log('Fixed info icon SVG and alignment');

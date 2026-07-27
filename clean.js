const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/scanner_analytics/src/frontend/src/app/features/dashboard/services/dashboard-pdf.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/(const chips = getDashboardChips\([^)]+\)\.map[^;]+;)[\s\S]*?(const teamItems: any\[\] = \[chipRow\(chips\)\];)/g, '$1\n          $2');

fs.writeFileSync(file, code, 'utf8');

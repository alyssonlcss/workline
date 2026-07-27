const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/scanner_analytics/src/frontend/src/app/features/dashboard/services/dashboard-pdf.service.ts';
let code = fs.readFileSync(file, 'utf8');

// Ensure import
if (!code.includes('getDashboardChips')) {
  code = code.replace(
    /import \{ buildTimelineSegments, TimelineSegment \} from '\.\.\/\.\.\/shared\/utils\/timeline-segment\.utils';/,
    `import { buildTimelineSegments, TimelineSegment } from '../../shared/utils/timeline-segment.utils';\nimport { getDashboardChips, getDashboardAlerts } from '../../shared/utils/dashboard-presentation.utils';`
  );
}

// Helper to replace chip generation
function replaceChips(kpiName, matchRegex) {
  code = code.replace(matchRegex, 
    `const chips = getDashboardChips('${kpiName}', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
  );
}

// Replace OS Dia chips
code = code.replace(
  /const chips: string\[\] = \[\s*`OS\/Dia \$\{fmt\(analysis\.osDiaValue\)\}`[\s\S]*?if \(analysis\.summary\?.+?\s+chips\.push\(.+?\);\s*\n/g,
  `const chips = getDashboardChips('OS Dia', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Replace Eficiencia chips
code = code.replace(
  /const chips: string\[\] = \[\s*`Utilização: \$\{analysis\.utilizacaoValue\}%`[\s\S]*?if \(analysis\.idleDays > 0\).*?\n/g,
  `const chips = getDashboardChips('Eficiência', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Replace TME IMP chips
code = code.replace(
  /const chips: string\[\] = \[\s*`TME IMP: \$\{fmt\(analysis\.tmeImpValue\)\} min`[\s\S]*?if \(analysis\.summary\?.+?\s+chips\.push\(.+?\);\s*\n/g,
  `const chips = getDashboardChips('TME Improdutivo', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Replace 1º Login chips
code = code.replace(
  /const chips: string\[\] = \[\s*`1º Login: \$\{analysis\.primeiroLoginValue\?.toFixed\(0\)\} min`[\s\S]*?if \(analysis\.summary\?.+?\s+chips\.push\(.+?\);\s*\n/g,
  `const chips = getDashboardChips('1º Login', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Replace 1º Desloc chips
code = code.replace(
  /const chips: string\[\] = \[\s*`1º Desloc\.: \$\{analysis\.primeiroDeslocValue\?.toFixed\(0\)\} min`[\s\S]*?if \(analysis\.summary\?.+?\s+chips\.push\(.+?\);\s*\n/g,
  `const chips = getDashboardChips('1º Desloc.', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Replace Retorno Base chips
code = code.replace(
  /const chips: string\[\] = \[\s*`Retorno Base: \$\{analysis\.retornoBaseValue\?.toFixed\(0\)\} min`[\s\S]*?if \(analysis\.summary\?.+?\s+chips\.push\(.+?\);\s*\n/g,
  `const chips = getDashboardChips('Retorno Base', analysis).map(c => \`\${c.label} \${c.value}\`);\n          `
);

// Helper to replace alert generation
// OS Dia Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('tr_excede_hd'\)\) dayItems\.push\(alertItem\(`Tempo de Reparo alto: \$\{helpers\.osDiaAlertBody\('tr_excede_hd', ev\)\}`\)\);[\s\S]*?if \(ev\.flags\?\.includes\('sem_os_alto'\)\) dayItems\.push\(alertItem\(`Tempo Sem OS elevado: \$\{helpers\.osDiaAlertBody\('sem_os_alto', ev\)\}`\)\);/g,
  `getDashboardAlerts('OS Dia', ev).forEach(alert => dayItems.push(alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

// Eficiencia Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('baixa_eficiencia'\)\) dayItems\.push\(alertItem\(`Baixa Eficiência: \$\{helpers\.eficienciaAlertBody\('baixa_eficiencia', ev\)\}`\)\);/g,
  `getDashboardAlerts('Eficiência', ev).forEach(alert => dayItems.push(alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

// TME IMP Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('tme_muito_alto'\)\) dayItems\.push\(alertItem\(`TME Muito Alto: \$\{helpers\.tmeImpAlertBody\('tme_muito_alto', ev\)\}`\)\);[\s\S]*?if \(ev\.flags\?\.includes\('retorno_vazio_alto'\)\) dayItems\.push\(alertItem\(`Retorno Vazio elevado: \$\{helpers\.tmeImpAlertBody\('retorno_vazio_alto', ev\)\}`\)\);/g,
  `getDashboardAlerts('TME Improdutivo', ev).forEach(alert => dayItems.push(alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

// 1º Login Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('login_muito_tardio'\)\) dayItems\.push\(alertItem\(`Log In muito tardio: \$\{helpers\.loginAlertBody\('login_muito_tardio', ev\)\}`\)\);/g,
  `getDashboardAlerts('1º Login', ev).forEach(alert => dayItems.push(alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

// 1º Desloc Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('despacho_tardio'\)\) dayItems\.push\(alertItem\(`\$\{ev\.flags\.includes\('login_atrasado'\) \? 'Despacho tardio após login atrasado:' : 'Despacho tardio:'\} \$\{helpers\.deslocAlertBody\('despacho_tardio', ev\)\}`\)\);[\s\S]*?if \(ev\.flags\?\.includes\('sem_desloc_registrado'\)\) dayItems\.push\(alertItem\(`Sem deslocamento registrado: \$\{helpers\.deslocAlertBody\('sem_desloc_registrado', ev\)\}`\)\);/g,
  `getDashboardAlerts('1º Desloc.', ev).forEach(alert => dayItems.push(alert.isWarn ? alertWarnItem(alert.title, alert.bodyHtml) : alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

// Retorno Base Alerts
code = code.replace(
  /if \(ev\.flags\?\.includes\('retorno_muito_alto'\)\) dayItems\.push\(alertItem\(`Retorno à Base muito alto: \$\{helpers\.retornoAlertBody\('retorno_muito_alto', ev\)\}`\)\);/g,
  `getDashboardAlerts('Retorno Base', ev).forEach(alert => dayItems.push(alertItem(\`\${alert.title} \${alert.bodyHtml}\`)));`
);

fs.writeFileSync(file, code, 'utf8');
console.log('done pdf refactor!');

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'services', 'dashboard-pdf.service.ts');
let content = fs.readFileSync(file, 'utf-8');

// Append incidence flags to the alerts arrays
content = content.replace(
  /const alerts = helpers\.getAlerts\(kpi\.kpi, ev\);/g,
  `const alerts = [...helpers.getAlerts(kpi.kpi, ev), ...renderIncidenceFlags(ev.team || (ev as any).equipe || (ev as any).team || '')];`
);

fs.writeFileSync(file, content);
console.log('PDF service alerts updated');

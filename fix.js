const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/scanner_analytics/src/frontend/src/app/features/dashboard/services/dashboard-pdf.service.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { getDashboardChips')) {
  code = code.replace(
    /import \{ TimelineSegment, buildTimelineSegments, extractTime, parseDt, tlFlexGrow \} from '..\/..\/..\/shared\/utils\/timeline-segment.utils';/,
    `import { TimelineSegment, buildTimelineSegments, extractTime, parseDt, tlFlexGrow } from '../../../shared/utils/timeline-segment.utils';\nimport { getDashboardChips, getDashboardAlerts, DashboardChip, DashboardAlert } from '../../../shared/utils/dashboard-presentation.utils';`
  );
}

// Fix alertWarnItem args and HTML tags for ALL getDashboardAlerts
code = code.replace(
  /getDashboardAlerts\('([^']+)', ev\)\.forEach\(alert => dayItems\.push\(.+?\)\);/g,
  `getDashboardAlerts('$1', ev).forEach(alert => dayItems.push(alert.isWarn ? alertWarnItem(\`\${alert.title} \${alert.bodyHtml}\`.replace(/<[^>]+>/g, '')) : alertItem(\`\${alert.title} \${alert.bodyHtml}\`.replace(/<[^>]+>/g, ''))));`
);

fs.writeFileSync(file, code, 'utf8');

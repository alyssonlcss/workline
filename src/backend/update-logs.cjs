const fs = require('fs');
const path = require('path');

// 1. Update incidence-enrichment.service.ts
const serviceFile = path.join(process.cwd(), 'src', 'app', 'application', 'services', 'incidence-enrichment.service.ts');
let serviceContent = fs.readFileSync(serviceFile, 'utf-8');

// Remove the old logs
serviceContent = serviceContent.replace(
  /const teamLog = team \? ` \(Team: \$\{team\}\)` : '';\s*console\.log\(`\[IncidenceEnrichment\] enrichSingle fetching data for incidence: \$\{incidenceNumber\}\$\{teamLog\}`\);/,
  ``
);

serviceContent = serviceContent.replace(
  /console\.log\(`\[IncidenceEnrichment\] enrichSingle API responded with Status 200, Total: \$\{total\} for incidence: \$\{incidenceNumber\}\$\{teamLog\}`\);/,
  `console.log(\`\\x1b[32m[GetIncidenciaOpenview]\\x1b[0m fetching data for incidence: \${incidenceNumber} | EQ: \${team || 'N/A'} | Status 200 | Total: \${total}\`);`
);

serviceContent = serviceContent.replace(
  /console\.error\(`\[IncidenceEnrichment\] Failed to enrich incidence \$\{incidenceNumber\}: \$\{message\}`\);/,
  `// Extract status from message if available, else assume 400/500
      const statusMatch = message.match(/HTTP (\\d+)/);
      const status = statusMatch ? statusMatch[1] : 'Error';
      console.error(\`\\x1b[31m[GetIncidenciaOpenview]\\x1b[0m fetching data for incidence: \${incidenceNumber} | EQ: \${team || 'N/A'} | Status \${status} | Error: \${message}\`);`
);

fs.writeFileSync(serviceFile, serviceContent);

// 2. Update external-auth.provider.ts
const authFile = path.join(process.cwd(), 'src', 'app', 'infrastructure', 'incidence', 'external-auth.provider.ts');
let authContent = fs.readFileSync(authFile, 'utf-8');

authContent = authContent.replace(
  /console\.log\(`\[ExternalAuth\] Loaded token from \.env \(length: \$\{this\.cachedToken\.length\}\)`\);/g,
  `console.log(\`\\x1b[32m[AuthenticatorOpenview]\\x1b[0m Loaded token from .env (length: \${this.cachedToken.length}) | Status 200\`);`
);

authContent = authContent.replace(
  /console\.log\(`\[ExternalAuth\] Successfully captured fresh token \(length: \$\{capturedToken\.length\}\)`\);/g,
  `console.log(\`\\x1b[32m[AuthenticatorOpenview]\\x1b[0m Successfully captured fresh token (length: \${capturedToken.length}) | Status 200\`);`
);

authContent = authContent.replace(
  /console\.warn\(`\[ExternalAuth\] Failed to capture token after 60s timeout\.`\);/g,
  `console.error(\`\\x1b[31m[AuthenticatorOpenview]\\x1b[0m Failed to capture token after 60s timeout | Status 408\`);`
);

authContent = authContent.replace(
  /console\.warn\(`\[ExternalAuth\] Second attempt failed\. Token capture unsuccessful\.`\);/g,
  `console.error(\`\\x1b[31m[AuthenticatorOpenview]\\x1b[0m Second attempt failed. Token capture unsuccessful | Status 400\`);`
);

fs.writeFileSync(authFile, authContent);

console.log('Updated logs');

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'services', 'dashboard-pdf.service.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add nrOrdem to renderIncidenceFlags calls
content = content.replace(
  /\.\.\.renderIncidenceFlags\((ev\.team \|\| \(ev as any\)\.equipe \|\| \(ev as any\)\.team \|\| '')\)/g,
  `...renderIncidenceFlags($1, ev.nr_ordem)`
);

// 2. Patch alerts.forEach to handle _pdfObj
const searchPattern = /alerts\.forEach\(\(alert: any\) => \{\n\s*const cleanBody = alert\.bodyHtml\.replace\(\/<\[\^>\]\*>\/g, ''\);\n\s*if \(alert\.isWarn\) \{\n\s*orderItems\.push\(alertWarnItemRuns\(alert\.title, \[\{ text: cleanBody, color: DARK \}\]\)\);\n\s*\} else \{\n\s*orderItems\.push\(alertItem\(`\$\{alert\.title\} \$\{cleanBody\}`\)\);\n\s*\}\n\s*\}\);/g;

const replacePattern = `alerts.forEach((alert: any) => {
                if (alert._pdfObj) {
                  orderItems.push(alert._pdfObj);
                  return;
                }
                const cleanBody = alert.bodyHtml.replace(/<[^>]*>/g, '');
                if (alert.isWarn) {
                  orderItems.push(alertWarnItemRuns(alert.title, [{ text: cleanBody, color: DARK }]));
                } else {
                  orderItems.push(alertItem(\`\${alert.title} \${cleanBody}\`));
                }
              });`;
content = content.replace(searchPattern, replacePattern);

// 3. Re-inject `getIncidenceForOrder` type
if (!content.includes('getIncidenceForOrder: (teamName: string, nrOrdem: string | number) => any;')) {
  content = content.replace(
    /getIncidenceTags: \(teamName: string\) => any\[\];/,
    `getIncidenceForOrder: (teamName: string, nrOrdem: string | number) => any;
  getIncidenceTags: (teamName: string) => any[];`
  );
}

// 4. Re-inject cardHeader
const oldHeader = /const cardHeader = \(team: string, badge: string, badgeRed = true\): any => \(\{\n\s*columns: \[\n\s*\{ text: team, bold: true, fontSize: 9, color: DARK, width: '\*' \},\n\s*\{ text: badge, bold: true, fontSize: 8, color: badgeRed \? RED : BLUE, width: 'auto', alignment: 'right' as const \},\n\s*\],\n\s*margin: \[0, 0, 0, 2\],\n\s*\}\);/;

const newHeader = `const cardHeader = (team: string, badge: string, badgeRed = true): any => {
        const columns: any[] = [
          { text: team, bold: true, fontSize: 9, color: DARK, width: '*' }
        ];
        
        const incidenceTags = helpers.getIncidenceTags ? helpers.getIncidenceTags(team) || [] : [];
        for (const tag of incidenceTags) {
           columns.push({
             text: tag.label,
             bold: true,
             fontSize: 7,
             color: '#fff',
             background: tag.color === 'blue' ? '#3b82f6' : '#f97316',
             width: 'auto',
             margin: [0, 0, 4, 0],
             alignment: 'right' as const
           });
        }
        
        if (badge) {
          columns.push({ text: badge, bold: true, fontSize: 8, color: badgeRed ? RED : BLUE, width: 'auto', alignment: 'right' as const });
        }
        
        return {
          columns,
          margin: [0, 0, 0, 2],
        };
      };`;
content = content.replace(oldHeader, newHeader);

// 5. Re-inject renderIncidenceFlags
const oldRender = /const renderIncidenceFlags = \(team: string\): any\[\] => \{[\s\S]*?margin: \[0, 2, 0, 0\]\n\s*\}\;\n\s*\}\);\n\s*\};/;

const newRender = `const renderIncidenceFlags = (team: string, nrOrdem: string | number): any[] => {
        if (!helpers.getIncidenceForOrder) return [];
        const inc = helpers.getIncidenceForOrder(team, nrOrdem);
        if (!inc || !inc.flags || inc.flags.length === 0) return [];

        return inc.flags.map((f: any) => {
          let textObj: any = { text: f.plainText, fontSize: 7, color: '#1e40af' };
          
          if (f.type === 'observacao_m300') {
             textObj = { text: f.plainText, fontSize: 7, color: '#f97316', italics: true };
          } else if (f.type === 'localizacao') {
             textObj = { text: f.plainText, fontSize: 7, color: '#2563eb', decoration: f.href ? 'underline' : undefined };
          }
          
          return {
            title: '',
            bodyHtml: textObj.text,
            isWarn: f.type === 'observacao_m300',
            _pdfObj: {
              columns: [
                { text: '•', color: f.type === 'observacao_m300' ? '#f97316' : '#3b82f6', width: 10, fontSize: 7 },
                textObj
              ],
              margin: [0, 2, 0, 0]
            }
          };
        });
      };`;
content = content.replace(oldRender, newRender);

fs.writeFileSync(file, content);
console.log('Successfully rebuilt PDF file');

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'features', 'dashboard', 'services', 'dashboard-pdf.service.ts');
let content = fs.readFileSync(file, 'utf-8');

// cardHeader inject
content = content.replace(
  /const cardHeader = \(team: string, badge: string, badgeRed = true\): any => \(\{\n        columns: \[\n          \{ text: team, bold: true, fontSize: 9, color: DARK, width: '\*' \},\n          \{ text: badge, bold: true, fontSize: 8, color: badgeRed \? RED : BLUE, width: 'auto', alignment: 'right' as const \},\n        \],\n        margin: \[0, 0, 0, 2\],\n      \}\);/g,
  `const cardHeader = (team: string, badge: string, badgeRed = true): any => {
        const tags = helpers.getIncidenceTags(team) || [];
        const tagElements = tags.map((t: any) => ({
          text: t.label,
          fontSize: 7,
          color: t.color === 'blue' ? '#2563eb' : '#d97706',
          margin: [4, 0, 0, 0],
          bold: true
        }));
        
        return {
          columns: [
            { 
              text: [
                { text: team, bold: true, fontSize: 9, color: DARK },
                ...tagElements
              ], 
              width: '*' 
            },
            { text: badge, bold: true, fontSize: 8, color: badgeRed ? RED : BLUE, width: 'auto', alignment: 'right' as const },
          ],
          margin: [0, 0, 0, 2],
        };
      };`
);

// We need a helper to generate flag blocks
const flagHelper = `
      const renderIncidenceFlags = (team: string): any[] => {
        const flags = helpers.getIncidenceFlags(team) || [];
        if (flags.length === 0) return [];
        return flags.map((f: any) => {
          let textObj: any = { text: f.plainText, fontSize: 7, color: '#1e40af' };
          
          if (f.type === 'observacao_m300') {
             // For m300 obs, the plainText starts with "Retorno OS: "
             // We can bold the "m300:" part if it's there
             textObj = { text: f.plainText, fontSize: 7, color: '#1e40af', italics: true };
          } else if (f.href) {
             textObj = { text: f.plainText, fontSize: 7, color: '#2563eb', decoration: 'underline' };
          }
          
          return {
            columns: [
              { text: '•', color: '#3b82f6', width: 10, fontSize: 7 },
              textObj
            ],
            margin: [0, 2, 0, 0]
          };
        });
      };
`;

// Insert helper before chipRow
content = content.replace(
  /const chipRow = \(chips: string\[\]\): any => \(\{/g,
  `${flagHelper}\n      const chipRow = (chips: string[]): any => ({`
);

fs.writeFileSync(file, content);
console.log('PDF service updated');

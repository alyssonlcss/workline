const fs = require('fs');
const path = require('path');

const backendFile = path.join(process.cwd(), 'src', 'app', 'presentation', 'http', 'create-server.ts');
let backendContent = fs.readFileSync(backendFile, 'utf-8');

backendContent = backendContent.replace(
  /const enrichBatchSchema = z\.object\(\{[\s\S]*?incidences: z\.array\(z\.string\(\)[\s\S]*?\}\);/,
  `const enrichBatchSchema = z.object({
    incidences: z.array(z.object({
      incidence: z.string().trim().min(1),
      team: z.string().trim().optional()
    })).min(1).max(100),
  });`
);

fs.writeFileSync(backendFile, backendContent);
console.log('Fixed backend schema string match');

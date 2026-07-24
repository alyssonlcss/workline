
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('report_7d.json')).generatedReport;
const basesConfig = JSON.parse(fs.readFileSync('bases.json'));

const getPoloForTeam = (team) => {
  for (const polo of basesConfig.polos) {
    if (polo.matchType === 'direct_prefix') {
      for (const base of polo.bases) {
        if (base.propria && team.startsWith(base.propria[0])) return base.name;
        if (base.parceira && team.startsWith(base.parceira[0])) return base.name;
      }
    } else if (polo.matchType === 'infix_type_with_base_prefix') {
      for (const base of polo.bases) {
        const p_propria = base.prefixes[0] + polo.typeIdentifiers.propria[0];
        const p_parceira = base.prefixes[0] + polo.typeIdentifiers.parceira[0];
        if (team.startsWith(p_propria) || team.startsWith(p_parceira)) return base.name;
      }
    }
  }
  return 'Outros';
};

const poloMap = {};
for (const sc of report.teamScorecard) {
  const polo = getPoloForTeam(sc.team);
  if (!poloMap[polo]) poloMap[polo] = [];
  
  let problem = '';
  // Check action plan first
  const plan = report.specialAnalysis.actionPlan.find(p => p.team === sc.team);
  if (plan && plan.issues.length > 0) {
    problem = plan.issues[0]; // get the first issue
  } else {
    // Check failing KPIs
    const failing = [];
    for (const [k, v] of Object.entries(sc.kpiStatus)) {
      if (v === 'below') failing.push(k);
    }
    if (failing.length > 0) {
      problem = 'Abaixo da meta em: ' + failing.join(', ');
    } else {
      problem = 'Nenhum problema crítico';
    }
  }
  
  poloMap[polo].push({
    team: sc.team,
    score: sc.score,
    problem
  });
}

let msg = '*Desempenho Operacional - Últimos 7 dias*\n\n';

for (const polo of Object.keys(poloMap).sort()) {
  if (polo === 'Outros') continue;
  const teams = poloMap[polo];
  teams.sort((a, b) => a.score - b.score);
  
  const worst2 = teams.slice(0, 2);
  msg += '*' + polo + '*\n';
  for (const t of worst2) {
    msg += '- Equipe ' + t.team + ' (Score ' + t.score + '): ' + t.problem + '\n';
  }
  msg += '\n';
}

console.log(msg);


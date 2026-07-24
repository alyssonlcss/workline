
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
  
  // Find most recurring problem for this team
  let problem = 'Nenhum desvio crítico';
  const teamDevs = report.deviations.teamBreakdown.find(d => d.team === sc.team);
  if (teamDevs && teamDevs.deviations.length > 0) {
    problem = teamDevs.deviations[0]; // Assuming the first is the most frequent or they are sorted
  }
  
  poloMap[polo].push({
    team: sc.team,
    score: sc.score,
    problem
  });
}

let msg = '*Desempenho Operacional - Últimos 7 dias*\n\n';

for (const polo of Object.keys(poloMap).sort()) {
  const teams = poloMap[polo];
  // Sort teams by score ascending (worst first)
  teams.sort((a, b) => a.score - b.score);
  
  const worst2 = teams.slice(0, 2);
  msg += '*' + polo + '*\n';
  for (const t of worst2) {
    msg += '- Equipe ' + t.team + ' (Score ' + t.score + '): ' + t.problem + '\n';
  }
  msg += '\n';
}

console.log(msg);


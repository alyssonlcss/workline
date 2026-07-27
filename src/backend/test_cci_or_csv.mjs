import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { analyzeUtilizacao } from './src/app/application/services/report/analyzers/utilizacao.analyzer.js';

const csvPath = 'c:\\Users\\BR0083895903\\source\\scanner_analytics\\src\\data\\Tab_Completa-Deslocamentos.csv';
const csvContent = fs.readFileSync(csvPath, 'utf16le');
const delimiter = csvContent.includes('\t') ? '\t' : (csvContent.includes(';') ? ';' : ',');
const deslocRows = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true, delimiter });

const dummyKpis = [{ kpi: 'Utilização', opportunityTeams: [] }];
const utilAnalysis = analyzeUtilizacao(deslocRows, dummyKpis);

const config = JSON.parse(fs.readFileSync('../../bases.json', 'utf-8'));
const getBaseForTeam = (team) => {
  for (const polo of config.polos) {
    if (polo.matchType === 'direct_prefix') {
      for (const base of polo.bases) {
        if (base.propria && team.startsWith(base.propria[0])) return base.name;
        if (base.parceira && team.startsWith(base.parceira[0])) return base.name;
      }
    } else if (polo.matchType === 'infix_type_with_base_prefix') {
      for (const base of polo.bases) {
        const p_propria = (base.prefixes?.[0] || '') + (polo.typeIdentifiers?.propria[0] || '');
        const p_parceira = (base.prefixes?.[0] || '') + (polo.typeIdentifiers?.parceira[0] || '');
        if (team.startsWith(p_propria) || team.startsWith(p_parceira)) return base.name;
      }
    }
  }
  return 'Outros';
};

const baseMap = new Map();

for (const u of utilAnalysis) {
  const base = getBaseForTeam(u.team);
  const entreOsOrders = (u.flaggedOrders || []).filter(o => 
    o.sem_os_details?.some(d => d.type === 'entre_ordens' && d.min > 15)
  );
  const entreOsAll = u.flaggedOrders?.flatMap(o => o.sem_os_details?.filter(d => d.type === 'entre_ordens' && d.min > 0) || []) || [];
  const entreOsOver15 = entreOsAll.filter(d => d.min > 15);
  const count = entreOsOver15.length;
  const totalOrders = u.totalOrders || 1;
  const diasTrab = u.totalJornadas || 26;

  const distinctDates = new Set(entreOsOrders.map(o => o.date_ref).filter(Boolean));
  const distinctDaysCount = distinctDates.size > 0 ? distinctDates.size : count;

  const cond1 = (count / totalOrders) >= 0.20;
  const cond2 = (distinctDaysCount / diasTrab) >= 0.25;

  if (count > 0) {
    if (!baseMap.has(base)) baseMap.set(base, []);
    baseMap.get(base).push({
      team: u.team,
      count,
      distinctDaysCount,
      totalOrders,
      diasTrab,
      pctOS: ((count / totalOrders) * 100).toFixed(1),
      pctDays: ((distinctDaysCount / diasTrab) * 100).toFixed(1),
      cond1,
      cond2,
      isMatch: cond1 || cond2,
      sumMin: entreOsOver15.reduce((s, d) => s + d.min, 0)
    });
  }
}

console.log('--- ALL BASES RESULTS WITH OR CONDITION ---');
for (const [base, teams] of baseMap) {
  const eligible = teams.filter(t => t.isMatch);
  console.log(`\n🏢 Base: ${base} (Total matching OR condition: ${eligible.length} / ${teams.length})`);
  teams.sort((a,b) => b.sumMin - a.sumMin);
  teams.slice(0, 5).forEach(t => {
    console.log(`   - ${t.team}: count=${t.count}/${t.totalOrders} OS (${t.pctOS}%), distinctDays=${t.distinctDaysCount}/${t.diasTrab} days (${t.pctDays}%) | cond1(OS>=20%): ${t.cond1} | cond2(Days>=25%): ${t.cond2} => MATCH: ${t.isMatch ? '✅ YES' : '❌ NO'}`);
  });
}

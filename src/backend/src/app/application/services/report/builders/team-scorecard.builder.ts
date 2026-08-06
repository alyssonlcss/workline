import type { CsvRow } from '../csv-utils.js';
import type { TeamKpiScorecard, KpiInsight } from '../types.js';
import { createAccessor, normalizeToken } from '../csv-utils.js';
import { KPI_THRESHOLDS } from '../constants.js';

export function buildTeamScorecard(deslocRows: CsvRow[], kpis: KpiInsight[]): TeamKpiScorecard[] {
  if (deslocRows.length === 0) return [];

  const acc = createAccessor(deslocRows[0]);
  const teamCol  = acc.resolve(['Equipe', 'Team', 'Equipe Nome']);
  const dateCol  = acc.resolve(['Data Referência', 'Data Referencia', 'Data', 'Data Conclusao']);
  if (!teamCol || !dateCol) return [];

  const teamDates = new Map<string, Set<string>>();
  for (const row of deslocRows) {
    const team = String(row[teamCol] ?? '').trim();
    const date = String(row[dateCol] ?? '').trim();
    if (!team || !date) continue;
    
    let dates = teamDates.get(team);
    if (!dates) {
      dates = new Set<string>();
      teamDates.set(team, dates);
    }
    dates.add(date);
  }

  // kpi name → team → raw value (from KPI scores already computed)
  const kpiValueMap = new Map<string, Map<string, number>>();
  for (const insight of kpis) {
    const m = new Map<string, number>();
    for (const s of insight.scores) m.set(s.team, s.rawValue);
    kpiValueMap.set(insight.kpi, m);
  }

  const KPI_KEY_MAP: Array<{ key: keyof TeamKpiScorecard['kpis']; kpiName: string }> = [
    { key: 'osDia',         kpiName: 'OS Dia'       },
    { key: 'eficiencia',    kpiName: 'Eficiência'   },
    { key: 'utilizacao',    kpiName: 'Utilização'   },
    { key: 'tmeImp',        kpiName: 'TME IMP'      },
    { key: 'primeiroLogin', kpiName: '1º Login'     },
    { key: 'primeiroDesloc',kpiName: '1º Desloc.'   },
    { key: 'retornoBase',   kpiName: 'Retorno Base' },
  ];

  const allTeams = new Set<string>(teamDates.keys());
  for (const insight of kpis) {
    for (const s of insight.scores) allTeams.add(s.team);
  }

  const result: TeamKpiScorecard[] = [];

  for (const team of allTeams) {
    const dates = teamDates.get(team);
    const kpiValues: TeamKpiScorecard['kpis']    = {};
    const kpiStatus: TeamKpiScorecard['kpiStatus'] = {};
    let score = 0;
    let kpisBelowMeta = 0;

    for (const { key, kpiName } of KPI_KEY_MAP) {
      const val = kpiValueMap.get(kpiName)?.get(team);
      if (val === undefined) {
        if (kpiName === 'TME IMP') {
          (kpiStatus as Record<string, string>)[key] = 'above';
          score++;
        }
        continue;
      }
      (kpiValues as Record<string, number>)[key] = val;
      const threshold = KPI_THRESHOLDS.find((t) => normalizeToken(t.kpi) === normalizeToken(kpiName));
      if (!threshold) continue;
      const isAbove = threshold.direction === 'higher-is-better' ? val >= threshold.meta : val <= threshold.meta;
      (kpiStatus as Record<string, string>)[key] = isAbove ? 'above' : 'below';
      if (isAbove) score++; else kpisBelowMeta++;
    }

    result.push({ 
      team, 
      classificacao: undefined,
      diasTrabalhados: dates?.size ?? 0, 
      kpis: kpiValues, 
      kpiStatus, 
      score, 
      kpisBelowMeta 
    });
  }

  return result.sort((a, b) => {
    if (a.classificacao !== undefined && b.classificacao !== undefined) return a.classificacao - b.classificacao;
    if (a.classificacao !== undefined) return -1;
    if (b.classificacao !== undefined) return 1;
    return b.score - a.score;
  });
}

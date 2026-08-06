import type { 
  KpiInsight, 
  TeamKpiScorecard, 
  OsDiaTeamAnalysis, 
  UtilizacaoTeamAnalysis, 
  TeamActionPlan, 
  TmeImpTeamAnalysis, 
  RetornoBaseTeamAnalysis, 
  ExecutiveSummary 
} from '../types.js';
import { round2 } from '../csv-utils.js';

export function buildExecutiveSummary(
  kpis: KpiInsight[],
  scorecard: TeamKpiScorecard[],
  osDiaAnalysis: OsDiaTeamAnalysis[],
  utilizacaoAnalysis: UtilizacaoTeamAnalysis[],
  actionPlan: TeamActionPlan[],
  tmeImpAnalysis: TmeImpTeamAnalysis[],
  retornoBaseAnalysis: RetornoBaseTeamAnalysis[],
): ExecutiveSummary {
  const totalTeams = scorecard.length;
  const teamsBelowMetaCount = scorecard.filter((s) => s.kpisBelowMeta >= 3).length;

  let periodDays = 0;
  for (const sc of scorecard) {
    if (sc.diasTrabalhados && sc.diasTrabalhados > periodDays) {
      periodDays = sc.diasTrabalhados;
    }
  }

  // KPI alerts: per-kpi count of teams below meta + worst
  const kpiAlerts: ExecutiveSummary['kpiAlerts'] = [];
  for (const insight of kpis) {
    const below = insight.scores.filter((s) =>
      insight.direction === 'higher-is-better'
        ? s.rawValue < insight.metaTarget
        : s.rawValue > insight.metaTarget,
    );
    if (below.length === 0) continue;
    const worst = insight.direction === 'higher-is-better'
      ? below.reduce((a, b) => a.rawValue < b.rawValue ? a : b)
      : below.reduce((a, b) => a.rawValue > b.rawValue ? a : b);
    kpiAlerts.push({
      kpi:            insight.kpi,
      teamsBelowMeta: below.length,
      worst:          { team: worst.team, value: round2(worst.rawValue) },
      meta:           insight.metaTarget,
    });
  }
  kpiAlerts.sort((a, b) => b.teamsBelowMeta - a.teamsBelowMeta);

  // Top action issues: count only Temp. Partida and Sem OS issues, per team (truly recurrent = ≥2 teams)
  const RECURRENT_PREFIXES = ['Temp. Partida elevado', 'SemOrdem\u226510min'];
  const issueCounts = new Map<string, number>();
  for (const plan of actionPlan) {
    const seenPrefixes = new Set<string>();
    for (const issue of plan.issues) {
      const prefix = RECURRENT_PREFIXES.find((p) => issue.startsWith(p));
      if (!prefix || seenPrefixes.has(prefix)) continue;
      seenPrefixes.add(prefix);
      issueCounts.set(prefix, (issueCounts.get(prefix) ?? 0) + 1);
    }
  }
  const topActionIssues = Array.from(issueCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([prefix, count]) => `${prefix}: ${count} equipes`);

  // Idle highlight
  const allWithIdle = ([...osDiaAnalysis, ...utilizacaoAnalysis] as Array<{ idleAnalysis?: { idlePct: number } }>)
    .filter((a) => a.idleAnalysis && a.idleAnalysis.idlePct >= 15);
  const idleHighlight = allWithIdle.length > 0
    ? `${allWithIdle.length} eq. ociosidade > 15% HD`
    : null;

  const retornoBaseAlertCount = retornoBaseAnalysis.filter((a) => a.retornoBaseValue > a.metaTarget).length;
  const tmeImpAlertCount = tmeImpAnalysis.filter((a) => a.tmeImpValue > a.metaTarget).length;

  return { periodDays, totalTeams, teamsBelowMetaCount, kpiAlerts, topActionIssues, idleHighlight, retornoBaseAlertCount, tmeImpAlertCount };
}

import type { TeamMetricSummary, KpiInsight, DeviationByTeam, CrossedInsight } from '../types.js';
import { normalizeToken, percentile } from '../csv-utils.js';

export function buildCrossedInsights(
  teamMetrics: TeamMetricSummary[],
  kpis: KpiInsight[],
  teamDeviations: DeviationByTeam[],
): CrossedInsight[] {
  const deviationMap = new Map(teamDeviations.map((item) => [item.team, item.deviations]));
  const utilKpi = kpis.find((item) => normalizeToken(item.kpi) === normalizeToken('Utilização'));
  const retornoBase = kpis.find((item) => normalizeToken(item.kpi) === normalizeToken('Retorno Base'));

  const matrixEvidence = teamMetrics
    .filter((item) => {
      const deviations = deviationMap.get(item.team) ?? [];
      return deviations.some((entry) => {
        const token = normalizeToken(entry);
        return token.includes(normalizeToken('Util < 40%')) || token.includes(normalizeToken('Intervalo < 30 ou > 70 min'));
      });
    })
    .slice(0, 8)
    .map((item) => ({
      team: item.team,
      semOrdemJornada: item.semOrdemJornada,
      tempPrepJornada: item.tempPrepJornada,
    }));

  const falsePositiveEvidence = (retornoBase?.topTeams ?? [])
    .filter((item) => {
      const deviations = deviationMap.get(item.team) ?? [];
      return deviations.some((entry) => normalizeToken(entry).includes(normalizeToken('Retorno a base < 8 min')));
    })
    .map((item) => ({
      team: item.team,
      retornoBase: item.value,
    }));

  const highIdleThreshold = percentile(teamMetrics.map((item) => item.semOrdemJornada), 0.75);
  const idleCulpabilityEvidence = teamMetrics
    .filter((item) => item.semOrdemJornada >= highIdleThreshold)
    .filter((item) => {
      const deviations = deviationMap.get(item.team) ?? [];
      return deviations.some((entry) => {
        const token = normalizeToken(entry);
        return token.includes(normalizeToken('Sem Fim Turno')) || token.includes(normalizeToken('Calendário Errado'));
      });
    })
    .map((item) => ({
      team: item.team,
      semOrdemJornada: item.semOrdemJornada,
    }));

  return [
    {
      title: 'Matriz Desvios vs Utilização',
      description: utilKpi
        ? 'Cruza equipes com desvios críticos de utilização/intervalo com os tempos calculados de TempPrep e SemOSentreOS.'
        : 'Cruza equipes com desvios críticos de utilização/intervalo com tempos de ociosidade calculados.',
      evidence: matrixEvidence,
    },
    {
      title: 'Análise de Falsos Positivos de Retorno',
      description: 'Identifica equipes com boa nota de Retorno Base e desvio de retorno suspeito (<8 min).',
      evidence: falsePositiveEvidence,
    },
    {
      title: 'Culpabilidade do Ócio',
      description: 'Relaciona alto SemOSentreOS com desvios de indisciplina de apontamento.',
      evidence: idleCulpabilityEvidence,
    },
  ];
}

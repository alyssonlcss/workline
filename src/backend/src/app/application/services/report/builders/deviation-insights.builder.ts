import type { CsvRow } from '../csv-utils.js';
import type { DeviationInsight, DeviationByTeam } from '../types.js';
import { createAccessor } from '../csv-utils.js';

export function buildDeviationInsights(rows: CsvRow[]): { mostRecurring: DeviationInsight[]; teamBreakdown: DeviationByTeam[] } {
  if (rows.length === 0) {
    return { mostRecurring: [], teamBreakdown: [] };
  }

  const accessor = createAccessor(rows[0]);
  const teamCol = accessor.resolve(['Equipe', 'Team']);
  const deviationCol = accessor.resolve(['Desvio', 'Tipo Desvio', 'Desvios', 'Ocorrência', 'Ocorrencia', 'Descrição']);

  if (!teamCol || !deviationCol) {
    return { mostRecurring: [], teamBreakdown: [] };
  }

  const countByDeviation = new Map<string, number>();
  const countByTeam = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const team = String(row[teamCol] ?? '').trim();
    const category = String(row[deviationCol] ?? '').trim();
    if (!team || !category) {
      continue;
    }

    countByDeviation.set(category, (countByDeviation.get(category) ?? 0) + 1);

    const teamMap = countByTeam.get(team) ?? new Map<string, number>();
    teamMap.set(category, (teamMap.get(category) ?? 0) + 1);
    countByTeam.set(team, teamMap);
  }

  const mostRecurring = Array.from(countByDeviation.entries())
    .map(([category, occurrences]) => ({ category, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  const teamBreakdown = Array.from(countByTeam.entries())
    .map(([team, teamMap]) => ({
      team,
      deviations: Array.from(teamMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => category),
    }))
    .sort((a, b) => a.team.localeCompare(b.team));

  return { mostRecurring, teamBreakdown };
}

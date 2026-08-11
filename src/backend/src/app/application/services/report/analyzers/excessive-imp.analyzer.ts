import type { CsvRow } from '../csv-utils.js';
import type { ExcessiveImpWarning } from '../types.js';
import { createAccessor, parseNumber, round2 } from '../csv-utils.js';

export function analyzeExcessiveImp(
  deslocRows: CsvRow[],
  resolvedTeams: Map<string, { base: string; teamType: 'propria' | 'parceira'; polo?: string | null }>
): ExcessiveImpWarning[] {
  if (deslocRows.length === 0) return [];

  const acc = createAccessor(deslocRows[0]);
  const teamCol = acc.resolve(['Equipe']);
  const statusCol = acc.resolve(['status', 'Status']);
  const trImpCol = acc.resolve(['TR Ordem Imp SS', 'TR Ordem Imp SS equipe', 'TR Ordem', 'TR_Ordem']);
  const causaCol = acc.resolve(['CAUSA', 'Causa']);

  if (!teamCol || !statusCol || !causaCol || !trImpCol) {
    return [];
  }

  const teamStats = new Map<string, {
    totalOrders: number;
    impOrders: number;
    totalTmeImp: number;
    causes: Map<string, { count: number; totalTmeImp: number }>;
  }>();

  const baseStats = new Map<string, {
    totalOrders: number;
    impOrders: number;
  }>();

  const poloStats = new Map<string, {
    totalOrders: number;
    impOrders: number;
  }>();

  for (const row of deslocRows) {
    const team = String(row[teamCol] ?? '').trim();
    if (!team) continue;

    const teamInfo = resolvedTeams.get(team);
    const base = teamInfo?.base || 'Outros';
    const polo = teamInfo?.polo || 'Outros';

    let bStats = baseStats.get(base);
    if (!bStats) {
      bStats = { totalOrders: 0, impOrders: 0 };
      baseStats.set(base, bStats);
    }
    bStats.totalOrders++;

    let pStats = poloStats.get(polo);
    if (!pStats) {
      pStats = { totalOrders: 0, impOrders: 0 };
      poloStats.set(polo, pStats);
    }
    pStats.totalOrders++;

    let stats = teamStats.get(team);
    if (!stats) {
      stats = { totalOrders: 0, impOrders: 0, totalTmeImp: 0, causes: new Map() };
      teamStats.set(team, stats);
    }

    stats.totalOrders++;

    const status = String(row[statusCol] ?? '').trim();
    if (status === 'Improdutivo') {
      stats.impOrders++;
      bStats.impOrders++;
      pStats.impOrders++;

      const trRaw = parseNumber(String(row[trImpCol] ?? ''));
      const tme = trRaw !== null && Number.isFinite(trRaw) && trRaw > 0 ? trRaw : 0;

      stats.totalTmeImp += tme;

      const causa = String(row[causaCol] ?? '').trim() || 'N/D';
      let causeStats = stats.causes.get(causa);
      if (!causeStats) {
        causeStats = { count: 0, totalTmeImp: 0 };
        stats.causes.set(causa, causeStats);
      }
      causeStats.count++;
      causeStats.totalTmeImp += tme;
    }
  }

  const warnings: ExcessiveImpWarning[] = [];

  for (const [team, stats] of teamStats.entries()) {
    if (stats.totalOrders === 0) continue;
    
    const pctImp = stats.impOrders / stats.totalOrders;
    
    if (pctImp > 0.1) {
      const teamInfo = resolvedTeams.get(team);
      const base = teamInfo?.base || 'Outros';
      const polo = teamInfo?.polo || 'Outros';
      const teamType = teamInfo?.teamType || 'propria';

      const avgTmeImp = stats.impOrders > 0 ? round2(stats.totalTmeImp / stats.impOrders) : 0;

      const topCausesRaw = Array.from(stats.causes.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

      const topCauses = topCausesRaw.map(([causa, causeStats]) => ({
        causa,
        count: causeStats.count,
        avgTmeImp: causeStats.count > 0 ? round2(causeStats.totalTmeImp / causeStats.count) : 0
      }));

      const bStats = baseStats.get(base);
      const basePctImp = bStats && bStats.totalOrders > 0 ? bStats.impOrders / bStats.totalOrders : 0;

      const pStats = poloStats.get(polo);
      const poloPctImp = pStats && pStats.totalOrders > 0 ? pStats.impOrders / pStats.totalOrders : 0;

      warnings.push({
        team,
        polo,
        base,
        teamType,
        totalOrders: stats.totalOrders,
        impOrders: stats.impOrders,
        pctImp: pctImp,
        basePctImp: basePctImp,
        poloPctImp: poloPctImp,
        avgTmeImp,
        topCauses
      });
    }
  }

  return warnings;
}

import { CsvRow } from '../csv-utils.js';
import { GlobalAveragesMap } from '../types.js';
import { BasesConfig } from '../../../../infrastructure/config/env.js';
import { createAccessor, parseNumber, parseDateTimeBr, minutesBetween } from '../csv-utils.js';
import { calculateTempPrepSemOs } from './team-stats.builder.js';

export function buildGlobalAverages(
  fullPeriodRows: CsvRow[],
  resolvedTeams: Map<string, { base: string; teamType: string }>,
  basesConfig: BasesConfig
): GlobalAveragesMap {
  const result: GlobalAveragesMap = {
    teamAverages: {},
    baseAverages: {},
    poloAverages: {}
  };

  if (fullPeriodRows.length === 0) return result;

  const acc = createAccessor(fullPeriodRows[0]);
  const teamCol = acc.resolve(['Equipe', 'Team', 'Equipe Nome']);
  const trOrdemCol = acc.resolve(['TR Ordem', 'TR_Ordem']);
  const tlOrdemCol = acc.resolve(['TL Ordem', 'TL_Ordem', 'Tempo Deslocamento (Min)']);
  const statusCol = acc.resolve(['status', 'Status']);
  const loginCol = acc.resolve(['1º Login Corrigido', '1o Login Corrigido', '1º Login', '1o Login']);
  const deslocCol = acc.resolve(['1º Desloc', '1o Desloc']);
  const retornoCol = acc.resolve(['Retorno a base', 'Retorno a Base', 'Retorno Base']);
  
  if (!teamCol) return result;

  const teamData: Record<string, {
    trSum: number; trCount: number;
    tlSum: number; tlCount: number;
    tmeSum: number; tmeCount: number;
    loginSum: number; loginCount: number;
    deslocSum: number; deslocCount: number;
    retornoSum: number; retornoCount: number;
    semOsSum: number; semOsCount: number;
    tempPrepSum: number; tempPrepCount: number;
  }> = {};

  for (const row of fullPeriodRows) {
    const teamRaw = String(row[teamCol] ?? '').trim();
    if (!teamRaw) continue;
    const team = teamRaw.toUpperCase();

    if (!teamData[team]) {
      teamData[team] = {
        trSum: 0, trCount: 0,
        tlSum: 0, tlCount: 0,
        tmeSum: 0, tmeCount: 0,
        loginSum: 0, loginCount: 0,
        deslocSum: 0, deslocCount: 0,
        retornoSum: 0, retornoCount: 0,
        semOsSum: 0, semOsCount: 0,
        tempPrepSum: 0, tempPrepCount: 0,
      };
    }
    const d = teamData[team];

    if (trOrdemCol) {
      const tr = parseNumber(String(row[trOrdemCol] ?? ''));
      if (tr !== null && Number.isFinite(tr) && tr >= 0) {
        d.trSum += tr;
        d.trCount++;
        if (statusCol) {
          const status = String(row[statusCol] ?? '').trim();
          if (status === 'Improdutivo' && tr > 0) {
             d.tmeSum += tr;
             d.tmeCount++;
          }
        }
      }
    }

    if (tlOrdemCol) {
      const tl = parseNumber(String(row[tlOrdemCol] ?? ''));
      if (tl !== null && Number.isFinite(tl) && tl >= 0) {
        d.tlSum += tl;
        d.tlCount++;
      }
    }

    if (loginCol) {
      const login = parseNumber(String(row[loginCol] ?? ''));
      if (login !== null && Number.isFinite(login) && login >= 0) {
        d.loginSum += login;
        d.loginCount++;
      }
    }

    if (deslocCol) {
      const desloc = parseNumber(String(row[deslocCol] ?? ''));
      if (desloc !== null && Number.isFinite(desloc) && desloc >= 0) {
        d.deslocSum += desloc;
        d.deslocCount++;
      }
    }

    if (retornoCol) {
      const retorno = parseNumber(String(row[retornoCol] ?? ''));
      if (retorno !== null && Number.isFinite(retorno) && retorno >= 0) {
        d.retornoSum += retorno;
        d.retornoCount++;
      }
    }
  }

  // Aggregate Base and Polo
  const baseData: Record<string, typeof teamData[string]> = {};
  const poloData: Record<string, typeof teamData[string]> = {};

    const getPoloForBase = (baseName: string): string => {
    for (const polo of basesConfig.polos) {
      if (polo.bases.some(b => b.name.toUpperCase() === baseName.toUpperCase())) {
        return polo.name;
      }
    }
    return 'Outros';
  };

  const tempSemOs = calculateTempPrepSemOs(fullPeriodRows, 0);
  for (const row of tempSemOs) {
    const team = row.team.toUpperCase();
    if (!teamData[team]) continue;
    
    if (Number.isFinite(row.semOrdemJornada) && row.semOrdemJornada > 0) {
      teamData[team].semOsSum += row.semOrdemJornada;
      teamData[team].semOsCount++;
    }
    
    if (Number.isFinite(row.tempPrepJornada) && row.tempPrepJornada >= 0) {
      teamData[team].tempPrepSum += row.tempPrepJornada;
      teamData[team].tempPrepCount++;
    }
  }

  for (const [team, metrics] of Object.entries(teamData)) {
    const resolved = resolvedTeams.get(team);
    if (resolved) {
      const base = resolved.base;
      const polo = getPoloForBase(base);

      if (!baseData[base]) {
         baseData[base] = { trSum: 0, trCount: 0, tlSum: 0, tlCount: 0, tmeSum: 0, tmeCount: 0, loginSum: 0, loginCount: 0, deslocSum: 0, deslocCount: 0, retornoSum: 0, retornoCount: 0, semOsSum: 0, semOsCount: 0, tempPrepSum: 0, tempPrepCount: 0 };
      }
      if (!poloData[polo]) {
         poloData[polo] = { trSum: 0, trCount: 0, tlSum: 0, tlCount: 0, tmeSum: 0, tmeCount: 0, loginSum: 0, loginCount: 0, deslocSum: 0, deslocCount: 0, retornoSum: 0, retornoCount: 0, semOsSum: 0, semOsCount: 0, tempPrepSum: 0, tempPrepCount: 0 };
      }

      const keys = Object.keys(metrics) as Array<keyof typeof metrics>;
      for (const k of keys) {
        baseData[base][k] += metrics[k];
        poloData[polo][k] += metrics[k];
      }
    }
  }

  for (const [name, metrics] of Object.entries(teamData)) {
    const resolved = resolvedTeams.get(name);
    const base = resolved?.base || 'Outros';
    const polo = getPoloForBase(base);
    
    result.teamAverages[name] = {
      base,
      polo,
      metrics: {
        tr_ordem: metrics.trCount > 0 ? Math.round(metrics.trSum / metrics.trCount) : 0,
        tl_ordem: metrics.tlCount > 0 ? Math.round(metrics.tlSum / metrics.tlCount) : 0,
        tme_imp: metrics.tmeCount > 0 ? Math.round(metrics.tmeSum / metrics.tmeCount) : 0,
        login: metrics.loginCount > 0 ? Math.round(metrics.loginSum / metrics.loginCount) : 0,
        desloc: metrics.deslocCount > 0 ? Math.round(metrics.deslocSum / metrics.deslocCount) : 0,
        retorno: metrics.retornoCount > 0 ? Math.round(metrics.retornoSum / metrics.retornoCount) : 0,
        sem_os: metrics.semOsCount > 0 ? Math.round(metrics.semOsSum / metrics.semOsCount) : 0,
        temp_prep: metrics.tempPrepCount > 0 ? Math.round(metrics.tempPrepSum / metrics.tempPrepCount) : 0,
      }
    };
  }

  const computeAvg = (data: Record<string, typeof teamData[string]>, target: Record<string, Record<string, number>>) => {
    for (const [name, metrics] of Object.entries(data)) {
      target[name] = {
        tr_ordem: metrics.trCount > 0 ? Math.round(metrics.trSum / metrics.trCount) : 0,
        tl_ordem: metrics.tlCount > 0 ? Math.round(metrics.tlSum / metrics.tlCount) : 0,
        tme_imp: metrics.tmeCount > 0 ? Math.round(metrics.tmeSum / metrics.tmeCount) : 0,
        login: metrics.loginCount > 0 ? Math.round(metrics.loginSum / metrics.loginCount) : 0,
        desloc: metrics.deslocCount > 0 ? Math.round(metrics.deslocSum / metrics.deslocCount) : 0,
        retorno: metrics.retornoCount > 0 ? Math.round(metrics.retornoSum / metrics.retornoCount) : 0,
        sem_os: metrics.semOsCount > 0 ? Math.round(metrics.semOsSum / metrics.semOsCount) : 0,
        temp_prep: metrics.tempPrepCount > 0 ? Math.round(metrics.tempPrepSum / metrics.tempPrepCount) : 0,
      };
    }
  };

  computeAvg(baseData, result.baseAverages);
  computeAvg(poloData, result.poloAverages);

  return result;
}

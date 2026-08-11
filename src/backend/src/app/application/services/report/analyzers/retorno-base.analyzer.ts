import type { CsvRow } from '../csv-utils.js';
import type { RetornoBaseTeamAnalysis, RetornoBaseDayEvidence, KpiInsight, GlobalAveragesMap } from '../types.js';
import { createAccessor, parseNumber, normalizeToken, round2, parseDateTimeBr, minutesBetween } from '../csv-utils.js';
import { enrichRetornoEvidence } from './domain-enrichers.js';
import { countDistinctDates } from './os-dia.analyzer.js';
import { getLimit } from '../../../../infrastructure/config/env.js';

export function analyzeRetornoBase(deslocRows: CsvRow[], kpis: KpiInsight[], globalAverages?: GlobalAveragesMap): RetornoBaseTeamAnalysis[] {
    if (deslocRows.length === 0) return [];

    const retornoKpi = kpis.find((k) => normalizeToken(k.kpi) === normalizeToken('Retorno Base'));
    if (!retornoKpi) return [];

    const teamsToAnalyze = new Map<string, { value: number }>();
    for (const s of retornoKpi.scores) {
      if (retornoKpi.direction === 'higher-is-better' ? s.rawValue < retornoKpi.metaTarget : s.rawValue > retornoKpi.metaTarget) {
        teamsToAnalyze.set(s.team, { value: s.rawValue });
      }
    }
    if (teamsToAnalyze.size === 0) return [];

    const deslocAcc = createAccessor(deslocRows[0]);
    const teamCol          = deslocAcc.resolve(['Equipe']);
    const dateCol          = deslocAcc.resolve(['Data Referência', 'Data Referencia']);
    const retornoBaseCol   = deslocAcc.resolve(['Retorno a base', 'Retorno a Base', 'Retorno Base']);
    const horaUltimaCol    = deslocAcc.resolve(['Hora Ultima Ordem', 'Hora Última Ordem']);
    const logOffCorCol     = deslocAcc.resolve(['Log Off Corrigido', 'LogOff Corrigido']);
    const fimIntervaloCol  = deslocAcc.resolve(['Fim Intervalo', 'Fim do Intervalo']);

    if (!teamCol) return [];

    const distinctDates = dateCol ? countDistinctDates(deslocRows, dateCol) : 0;

    // Global average
    const globalRetornoValues: number[] = [];
    const seenGlobal = new Set<string>();
    for (const row of deslocRows) {
      const team = teamCol ? String(row[teamCol] ?? '').trim() : '';
      const date = dateCol ? String(row[dateCol] ?? '').trim() : '';
      const key = `${team}|${date}`;
      if (seenGlobal.has(key)) continue;
      seenGlobal.add(key);
      const v = retornoBaseCol ? parseNumber(String(row[retornoBaseCol] ?? '')) : null;
      if (v !== null && Number.isFinite(v) && v > 0) globalRetornoValues.push(v);
    }
    const globalAvgRetorno = globalRetornoValues.length > 0
      ? globalRetornoValues.reduce((s, x) => s + x, 0) / globalRetornoValues.length : 0;

    const result: RetornoBaseTeamAnalysis[] = [];

    for (const [team, { value: retornoValue }] of teamsToAnalyze.entries()) {
      const teamNorm = normalizeToken(team);
      let teamRows = deslocRows.filter((r) => String(r[teamCol] ?? '').trim() === team);
      if (teamRows.length === 0) {
        teamRows = deslocRows.filter((r) => normalizeToken(String(r[teamCol] ?? '').trim()) === teamNorm);
      }
      if (teamRows.length === 0) continue;

      const polo = globalAverages?.teamAverages[team.toUpperCase()]?.polo;
      const limitMin = getLimit('LIMIT_RETORNO_EXCEDENTE_MIN', polo, 60);

      // Deduplicate by date
      const seenDates = new Set<string>();
      const jornadaRows: CsvRow[] = [];
      for (const row of teamRows) {
        const date = dateCol ? String(row[dateCol] ?? '').trim() : '';
        if (!seenDates.has(date)) { seenDates.add(date); jornadaRows.push(row); }
      }

      const teamRetornoValues: number[] = [];
      const rowEvaluations = jornadaRows.map((row) => {
        const rawRetornoMin = retornoBaseCol ? parseNumber(String(row[retornoBaseCol] ?? '')) : null;
        let trueRetornoMin: number | undefined;
        let divergenceDetected = false;

        if (rawRetornoMin !== null && Number.isFinite(rawRetornoMin) && rawRetornoMin > 0 && fimIntervaloCol && logOffCorCol) {
          const logOffStr = String(row[logOffCorCol] ?? '').trim();
          const fimIntervaloStr = String(row[fimIntervaloCol] ?? '').trim();
          const logOffDt = parseDateTimeBr(logOffStr);
          const fimIntervaloDt = parseDateTimeBr(fimIntervaloStr);
          if (logOffDt && fimIntervaloDt) {
            const diff = minutesBetween(logOffDt, fimIntervaloDt);
            if (diff > 0 && diff < rawRetornoMin) {
              trueRetornoMin = diff;
              divergenceDetected = true;
            }
          }
        }
        
        const effectiveRetorno = trueRetornoMin ?? rawRetornoMin;
        if (effectiveRetorno !== null && Number.isFinite(effectiveRetorno) && effectiveRetorno > 0) {
          teamRetornoValues.push(effectiveRetorno);
        }

        return { row, rawRetornoMin, trueRetornoMin, effectiveRetorno, divergenceDetected };
      });

      const teamAvgRetorno = teamRetornoValues.length > 0
        ? teamRetornoValues.reduce((s, x) => s + x, 0) / teamRetornoValues.length : 0;

      const valuesAboveLimit = teamRetornoValues.filter((v) => v > limitMin);
      const diasAcimaMetaCount = valuesAboveLimit.length;

      const flaggedDays: RetornoBaseDayEvidence[] = [];
      let countRetornoAlto = 0;
      let countRetornoMuitoAlto = 0;

      for (const evalObj of rowEvaluations) {
        const { row, rawRetornoMin, trueRetornoMin, effectiveRetorno, divergenceDetected } = evalObj;
        if (effectiveRetorno === null || !Number.isFinite(effectiveRetorno) || effectiveRetorno <= 0) continue;

        const flags: RetornoBaseDayEvidence['flags'] = [];
        
        if (effectiveRetorno > limitMin * 1.5) { flags.push('retorno_muito_alto'); countRetornoMuitoAlto++; }
        else if (effectiveRetorno > limitMin) { flags.push('retorno_alto'); countRetornoAlto++; }

        if (divergenceDetected) {
          flags.push('retorno_divergente');
        }

        if (flags.length === 0) continue;

        flaggedDays.push({
          date_ref: dateCol ? String(row[dateCol] ?? '').trim() : '',
          retorno_base_min: round2(rawRetornoMin ?? 0),
          true_retorno_min: trueRetornoMin ? round2(trueRetornoMin) : undefined,
          team_avg_retorno_min: round2(teamAvgRetorno),
          global_avg_retorno_min: round2(globalAvgRetorno),
          hora_ultima_ordem: horaUltimaCol ? String(row[horaUltimaCol] ?? '').trim() : '',
          log_off_corrigido: logOffCorCol  ? String(row[logOffCorCol] ?? '').trim()  : '',
          flags,
        });
      }

      flaggedDays.sort((a, b) => b.retorno_base_min - a.retorno_base_min);

      const enrichedFlagged = enrichRetornoEvidence(flaggedDays.slice(0, 10), limitMin, team, globalAverages);
      const extraFlagged = flaggedDays.length > 10
        ? enrichRetornoEvidence(flaggedDays.slice(10), limitMin, team, globalAverages)
        : [];

      result.push({
        team,
        retornoBaseValue: retornoValue,
        metaTarget: limitMin,
        gap: round2(retornoValue - limitMin),
        avgRetornoMin: round2(teamAvgRetorno),
        globalAvgRetornoMin: round2(globalAvgRetorno),
        limitMin: limitMin,
        totalDays: jornadaRows.length,
        diasAcimaMetaCount,
        flaggedDays: enrichedFlagged,
        extraFlaggedDays: extraFlagged,
        summary: { countRetornoAlto, countRetornoMuitoAlto },
      });
    }

    return result.sort((a, b) => b.retornoBaseValue - a.retornoBaseValue);
  }


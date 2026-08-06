// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietÃ¡rio e confidencial. Uso nÃ£o autorizado Ã© proibido.
import type { OsDiaOrderEvidence, EficienciaOrderEvidence, TmeImpOrderEvidence, PrimeiroLoginDayEvidence, PrimeiroDeslocDayEvidence, RetornoBaseDayEvidence, UtilizacaoOrderEvidence, GlobalAveragesMap } from '../types.js';
import { getLimit } from '../../../../infrastructure/config/env.js';

export function nfBr(v: number, minDec = 0, maxDec = 0): string {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
  }

export function getAvgText(team: string | undefined, globalAverages: GlobalAveragesMap | undefined, kpiType: 'sem_os' | 'temp_prep' | 'login' | 'desloc' | 'tme_imp' | 'retorno' | 'triagem' | 'tr_ordem'): string {
  if (!team || !globalAverages) return '';
  const teamMap = globalAverages.teamAverages[team.toUpperCase()];
  if (!teamMap) return '';

  const { base, polo } = teamMap;
  const baseMap = globalAverages.baseAverages[base];
  const poloMap = globalAverages.poloAverages[polo];

  if (!baseMap || !poloMap) return '';

  let tAvg = 0;
  let bAvg = 0;
  let pAvg = 0;
  
  if (kpiType === 'sem_os') {
    tAvg = teamMap.metrics.sem_os || 0;
    bAvg = baseMap.sem_os || 0;
    pAvg = poloMap.sem_os || 0;
  } else if (kpiType === 'temp_prep') {
    tAvg = teamMap.metrics.temp_prep || 0;
    bAvg = baseMap.temp_prep || 0;
    pAvg = poloMap.temp_prep || 0;
  } else if (kpiType === 'login') {
    tAvg = teamMap.metrics.login || 0;
    bAvg = baseMap.login || 0;
    pAvg = poloMap.login || 0;
  } else if (kpiType === 'desloc') {
    tAvg = teamMap.metrics.desloc || 0;
    bAvg = baseMap.desloc || 0;
    pAvg = poloMap.desloc || 0;
  } else if (kpiType === 'retorno') {
    tAvg = teamMap.metrics.retorno || 0;
    bAvg = baseMap.retorno || 0;
    pAvg = poloMap.retorno || 0;
  } else if (kpiType === 'tme_imp') {
    tAvg = teamMap.metrics.tme_imp || 0;
    bAvg = baseMap.tme_imp || 0;
    pAvg = poloMap.tme_imp || 0;
  } else if (kpiType === 'tr_ordem') {
    tAvg = teamMap.metrics.tr_ordem || 0;
    bAvg = baseMap.tr_ordem || 0;
    pAvg = poloMap.tr_ordem || 0;
  } else if (kpiType === 'triagem') {
    tAvg = teamMap.metrics.tl_ordem || 0;
    bAvg = baseMap.tl_ordem || 0;
    pAvg = poloMap.tl_ordem || 0;
  }

  if (tAvg <= 0 && bAvg <= 0 && pAvg <= 0) return '';

  return ` | MÃ©dia da Equipe: ${nfBr(tAvg, 0, 1)} min | MÃ©dia da Base (${base}): ${nfBr(bAvg, 0, 1)} min | MÃ©dia do Polo (${polo}): ${nfBr(pAvg, 0, 1)} min`;
}

export const getTempPrepLimit = (polo?: string) => getLimit('LIMIT_TEMP_PREP_MIN', polo, 10);
export const getSemOsLimit = (polo?: string) => getLimit('LIMIT_SEM_OS_MIN', polo, 10);
export const getPrimeiroDeslocLimit = (polo?: string) => getLimit('LIMIT_PRIMEIRO_DESLOC_MIN', polo, 25);
export const getTriagemLimit = (polo?: string) => getLimit('LIMIT_TRIAGEM_MIN', polo, 10);
export const getCalendarioErradoLimit = (polo?: string) => getLimit('LIMIT_CALENDARIO_ERRADO_MIN', polo, 15);
export const getLoginAtrasadoLimit = (polo?: string) => getLimit('LIMIT_LOGIN_ATRASADO_MIN', polo, 8);

  /** Computes a sem_os_details item's full display text (label: body). */
export function semOsDetailText(d: {
    type: string; min: number; from?: string; to?: string;
    global_avg_min?: number; above_avg_pct?: number;
    interval_discounted?: boolean; retorno_base_discounted?: number;
    retorno_base_used_row?: boolean; desp_anterior?: string; from_label?: string; polo?: string;
  }): string {
    const fmtAvg = (pct: number | undefined, avg: number | undefined): string => {
      if (!Number.isFinite(pct) || !Number.isFinite(avg) || (avg ?? 0) <= 0) return '';
      const dir = (pct! >= 0) ? 'acima' : 'abaixo';
      return ` | ${nfBr(Math.abs(pct!), 0, 1)}% ${dir} da mÃ©dia geral (${nfBr(avg!)} min)`;
    };
    switch (d.type) {
      case 'inicio_jornada': {
        const pctIJ = Math.round((d.min - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        return `1Âº Despacho: ${d.min} min do InÃ­cio CalendÃ¡rio (${d.from ?? 'â€”'}) atÃ© o primeiro despacho (${d.to ?? 'â€”'}) â€” ${pctIJ}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      case 'entre_ordens': {
        const mEO = Math.round(d.min);
        const pctEO = Math.round((mEO - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        return `Entre OS: ${mEO} min sem nova OS â€” Lib. Anterior (${d.from ?? 'â€”'})${d.desp_anterior ? ' Â· Desp. Anterior (' + d.desp_anterior + ')' : ''} atÃ© Despachada (${d.to ?? 'â€”'})${d.interval_discounted ? ' â€” intervalo descontado' : ''} â€” ${pctEO}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      case 'retorno_excedente': {
        const fromLabel = d.from_label ?? 'Ãºltima Liberada';
        const excessMin: number | undefined = (d as any).excess_min;
        const globalAvgMin: number | undefined = (d as any).global_avg_min;
        if (d.retorno_base_discounted != null) {
          if (excessMin != null) {
            const globalPart = globalAvgMin != null ? ` (${nfBr(globalAvgMin)} min)` : '';
            return `Retorno Excedente: ${nfBr(excessMin)} min acima da mÃ©dia geral de Retorno a base${globalPart} â€” Retorno a base: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? 'â€”'}) e Log Off (${d.to ?? 'â€”'}).`;
          }
          return `Retorno a base: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? 'â€”'}) e Log Off (${d.to ?? 'â€”'}).`;
        }
        const excessText = excessMin != null
          ? ` â€” ${nfBr(excessMin)} min acima da mÃ©dia geral de Retorno a base${globalAvgMin != null ? ' (' + nfBr(globalAvgMin) + ' min)' : ''}`
          : '';
        return `Retorno Excedente: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? 'â€”'}) e Log Off (${d.to ?? 'â€”'})${excessText}.`;
      }
      case 'intervalo_deslocamento': {
        const mID = Math.round(d.min);
        const pctID = Math.round((mID - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        const fromLabel = d.from_label ?? 'Lib. Anterior';
        return `Desl. Intervalo: ${mID} min entre ${fromLabel} (${d.from ?? 'â€”'}) e InÃ­cio Intervalo (${d.to ?? 'â€”'}) â€” ${pctID}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      default:
        return `${d.type}: ${d.min} min (${d.from ?? 'â€”'} â†’ ${d.to ?? 'â€”'})`;
    }
  }


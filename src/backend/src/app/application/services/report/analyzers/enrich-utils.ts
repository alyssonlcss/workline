// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
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

  return ` | Média da Equipe: ${nfBr(tAvg, 0, 1)} min | Média da Base (${base}): ${nfBr(bAvg, 0, 1)} min | Média do Polo (${polo}): ${nfBr(pAvg, 0, 1)} min`;
}

const getTempPrepLimit = (polo?: string) => getLimit('LIMIT_TEMP_PREP_MIN', polo, 10);
const getSemOsLimit = (polo?: string) => getLimit('LIMIT_SEM_OS_MIN', polo, 10);
const getPrimeiroDeslocLimit = (polo?: string) => getLimit('LIMIT_PRIMEIRO_DESLOC_MIN', polo, 25);
const getTriagemLimit = (polo?: string) => getLimit('LIMIT_TRIAGEM_MIN', polo, 10);
const getCalendarioErradoLimit = (polo?: string) => getLimit('LIMIT_CALENDARIO_ERRADO_MIN', polo, 15);
const getLoginAtrasadoLimit = (polo?: string) => getLimit('LIMIT_LOGIN_ATRASADO_MIN', polo, 8);

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
      return ` | ${nfBr(Math.abs(pct!), 0, 1)}% ${dir} da média geral (${nfBr(avg!)} min)`;
    };
    switch (d.type) {
      case 'inicio_jornada': {
        const pctIJ = Math.round((d.min - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        return `1º Despacho: ${d.min} min do Início Calendário (${d.from ?? '—'}) até o primeiro despacho (${d.to ?? '—'}) — ${pctIJ}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      case 'entre_ordens': {
        const mEO = Math.round(d.min);
        const pctEO = Math.round((mEO - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        return `Entre OS: ${mEO} min sem nova OS — Lib. Anterior (${d.from ?? '—'})${d.desp_anterior ? ' · Desp. Anterior (' + d.desp_anterior + ')' : ''} até Despachada (${d.to ?? '—'})${d.interval_discounted ? ' — intervalo descontado' : ''} — ${pctEO}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      case 'retorno_excedente': {
        const fromLabel = d.from_label ?? 'última Liberada';
        const excessMin: number | undefined = (d as any).excess_min;
        const globalAvgMin: number | undefined = (d as any).global_avg_min;
        if (d.retorno_base_discounted != null) {
          if (excessMin != null) {
            const globalPart = globalAvgMin != null ? ` (${nfBr(globalAvgMin)} min)` : '';
            return `Retorno Excedente: ${nfBr(excessMin)} min acima da média geral de Retorno a base${globalPart} — Retorno a base: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? '—'}) e Log Off (${d.to ?? '—'}).`;
          }
          return `Retorno a base: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? '—'}) e Log Off (${d.to ?? '—'}).`;
        }
        const excessText = excessMin != null
          ? ` — ${nfBr(excessMin)} min acima da média geral de Retorno a base${globalAvgMin != null ? ' (' + nfBr(globalAvgMin) + ' min)' : ''}`
          : '';
        return `Retorno Excedente: ${nfBr(d.min)} min entre ${fromLabel} (${d.from ?? '—'}) e Log Off (${d.to ?? '—'})${excessText}.`;
      }
      case 'intervalo_deslocamento': {
        const mID = Math.round(d.min);
        const pctID = Math.round((mID - getSemOsLimit(d.polo)) / getSemOsLimit(d.polo) * 100);
        const fromLabel = d.from_label ?? 'Lib. Anterior';
        return `Desl. Intervalo: ${mID} min entre ${fromLabel} (${d.from ?? '—'}) e Início Intervalo (${d.to ?? '—'}) — ${pctID}% acima do limite (${getSemOsLimit(d.polo)} min)${fmtAvg(d.above_avg_pct, d.global_avg_min)}.`;
      }
      default:
        return `${d.type}: ${d.min} min (${d.from ?? '—'} → ${d.to ?? '—'})`;
    }
  }

export function enrichOsDiaEvidence(orders: OsDiaOrderEvidence[], team?: string, globalAverages?: GlobalAveragesMap): OsDiaOrderEvidence[] {
    const teamMap = team ? globalAverages?.teamAverages[team.toUpperCase()] : undefined;
    const polo = teamMap?.polo;
    const parseDt = (s: string): number => {
      const parts = s.split(' ');
      if (parts.length < 2) return 0;
      const [day, mon, yr] = (parts[0] ?? '').split('/');
      const [hr, min, sec] = (parts[1] ?? '').split(':');
      return new Date(+(yr ?? 0), +(mon ?? 1) - 1, +(day ?? 1), +(hr ?? 0), +(min ?? 0), +(sec ?? 0)).getTime();
    };

    return orders.map((ev) => {
      if (ev.inicio_intervalo) {
        const iniTs = parseDt(ev.inicio_intervalo);
        if (iniTs > 0) {
          const candidates = [
            { ts: parseDt(ev.prev_liberada || ''), raw: ev.prev_liberada, label: 'Lib. Anterior' },
            { ts: parseDt(ev.liberada || ''), raw: ev.liberada, label: 'Liberada' },
            { ts: parseDt(ev.despachada || ''), raw: ev.despachada, label: 'Despachada' },
            { ts: parseDt(ev.no_local || ''), raw: ev.no_local, label: 'No Local' },
          ].filter(c => c.ts > 0 && c.ts < iniTs);
          
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.ts - a.ts);
            const best = candidates[0];
            const duration = Math.round((iniTs - best.ts) / 60000);
            
            if (duration >= getSemOsLimit(polo)) {
              ev.sem_os_details = ev.sem_os_details ?? [];
              if (!ev.sem_os_details.some(d => d.type === 'intervalo_deslocamento')) {
                ev.sem_os_details.push({
                  type: 'intervalo_deslocamento',
                  min: duration,
                  from: best.raw,
                  to: ev.inicio_intervalo,
                  from_label: best.label,
                  polo
                });
              }
              if (!ev.flags.includes('desloc_intervalo_alto')) ev.flags.push('desloc_intervalo_alto');
            }
          }
        }
      }

      if (ev.despachada) {
        const despTs = parseDt(ev.despachada);
        if (despTs > 0) {
          const candidates = [
            { ts: parseDt(ev.prev_liberada || ''), raw: ev.prev_liberada, label: 'Lib. Anterior' },
            { ts: parseDt(ev.liberada || ''), raw: ev.liberada, label: 'Liberada' },
            { ts: parseDt(ev.fim_intervalo || ''), raw: ev.fim_intervalo, label: 'Fim Intervalo' },
          ].filter(c => c.ts > 0 && c.ts < despTs);
          
          if (candidates.length > 0) {
            candidates.sort((a, b) => b.ts - a.ts);
            const best = candidates[0];
            const duration = Math.round((despTs - best.ts) / 60000);
            
            if (duration >= getSemOsLimit(polo)) {
              ev.sem_os_details = ev.sem_os_details ?? [];
              if (!ev.sem_os_details.some(d => d.type === 'entre_ordens' && d.from === best.raw)) {
                ev.sem_os_details.push({
                  type: 'entre_ordens',
                  min: duration,
                  from: best.raw,
                  to: ev.despachada,
                  from_label: best.label,
                  polo
                });
              }
              if (!ev.flags.includes('sem_os_alto')) ev.flags.push('sem_os_alto');
            }
          }
        }
      }

      if (ev.fim_intervalo) {
        const fInt = parseDt(ev.fim_intervalo);
        const aCam = ev.a_caminho ? parseDt(ev.a_caminho) : 0;
        const desp = ev.despachada ? parseDt(ev.despachada) : 0;
        
        if (fInt > 0 && (aCam === 0 || fInt > aCam) && (desp === 0 || fInt > desp)) {
          const isEndInterval = ev.retorno_excedente_details?.from === ev.fim_intervalo ||
                                ev.sem_os_details?.some((d: Record<string, any>) => d['type'] === 'fim_jornada' && d['from'] === ev.fim_intervalo) ||
                                (ev.liberada && fInt > parseDt(ev.liberada));
          if (isEndInterval) {
            if (!ev.flags.includes('intervalo_por_ultimo' as any)) {
              ev.flags.push('intervalo_por_ultimo' as any);
            }
          }
        }
      }

      const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
      if (!ev.prev_liberada && ev.inicio_calendario && logInVal) {
        const icalTs = parseDt(ev.inicio_calendario);
        const linTs = parseDt(logInVal);
        if (icalTs > 0 && linTs > 0) {
          const earlyMin = Math.round((icalTs - linTs) / 60000);
          if (earlyMin > getCalendarioErradoLimit(polo)) {
            if (!ev.flags.includes('calendario_errado' as any)) {
              ev.flags.push('calendario_errado' as any);
            }
          } else if (earlyMin < -getLoginAtrasadoLimit(polo)) {
            if (!ev.flags.includes('login_atrasado' as any)) {
              ev.flags.push('login_atrasado' as any);
            }
          }
        }
      }

      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag as string) {
          case 'tr_excede_hd': {
            let trEfetivo = ev.tr_ordem_min;
            let intervalNote = '';
            if (ev.no_local && ev.inicio_intervalo && ev.fim_intervalo) {
              const noLocalTs  = parseDt(ev.no_local);
              const iniIntTs   = parseDt(ev.inicio_intervalo);
              const fimIntTs   = parseDt(ev.fim_intervalo);
              const liberadaTs = parseDt(ev.liberada);
              if (noLocalTs > 0 && iniIntTs > 0 && fimIntTs > 0 && liberadaTs > 0 &&
                  iniIntTs >= noLocalTs && fimIntTs <= liberadaTs) {
                trEfetivo = Math.round((liberadaTs - fimIntTs) / 60000);
                const totalDiscounted = ev.tr_ordem_min - trEfetivo;
                intervalNote = ` (efetivo: ${trEfetivo} min, descontados ${totalDiscounted} min)`;
              }
            }
            const hdPct = ev.hd_total_min > 0
              ? Math.round(trEfetivo / ev.hd_total_min * 10000) / 100
              : ev.hd_pct_tr;
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} — ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'não cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
            break;
          }
          case 'tr_alto': {
            let intervalNote = '';
            let trEfetivo = ev.tr_ordem_min;
            if (ev.flags.includes('intervalo_no_reparo' as any)) {
              const noLocalTs = parseDt(ev.no_local || '');
              const iniIntTs  = parseDt(ev.inicio_intervalo || '');
              const fimIntTs   = parseDt(ev.fim_intervalo || '');
              const liberadaTs = parseDt(ev.liberada || '');
              if (noLocalTs > 0 && iniIntTs > 0 && fimIntTs > 0 && liberadaTs > 0 &&
                  iniIntTs >= noLocalTs && fimIntTs <= liberadaTs) {
                trEfetivo = Math.round((liberadaTs - fimIntTs) / 60000);
                const totalDiscounted = ev.tr_ordem_min - trEfetivo;
                intervalNote = ` (efetivo: ${trEfetivo} min, descontados ${totalDiscounted} min)`;
              }
            }
            const hdPct = ev.hd_total_min > 0
              ? Math.round(trEfetivo / ev.hd_total_min * 10000) / 100
              : ev.hd_pct_tr;
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} — ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'não cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
            break;
          }
          case 'tl_excede_hd':
            alertTexts[flag] = `o técnico passou ${ev.tl_ordem_min} min em deslocamento nesta OS — ${ev.global_avg_tl_min > 0 ? nfBr((ev.tl_ordem_min - ev.global_avg_tl_min) / ev.global_avg_tl_min * 100, 0, 0) : '?'}% acima da média geral de ${nfBr(ev.global_avg_tl_min)} min, representando ${ev.hd_pct_tl}% da jornada de ${ev.hd_total_min} min. Deslocamentos muito longos consomem boa parte do dia e diminuem o número de OS atendidas.${getAvgText(team, globalAverages, 'triagem')}`;
            break;
          case 'temp_prep_alto': {
            const tempPrepMin = ev.temp_prep_os_min ?? 0;
            const limit = getTempPrepLimit(polo);
            const pct = Math.round((tempPrepMin - limit) / limit * 100);
            const subject = ev.prev_liberada
              ? 'a Despachada e o registro de saída nesta OS'
              : 'a Despachada e o registro de saída desta 1ª OS';
            alertTexts[flag] = `o técnico levou ${tempPrepMin} min entre ${subject} — ${pct}% acima do limite de ${limit} min. Esse tempo representa espera antes de se deslocar para o próximo atendimento.${getAvgText(team, globalAverages, 'temp_prep')}`;
            break;
          }
          case 'sem_os_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'entre_ordens');
            const minVal = Math.round(detail?.min ?? ev.sem_os_total_min ?? getSemOsLimit(polo));
            alertTexts[flag] = `${minVal} min sem OS registrada — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa intervalos ociosos em que o técnico não estava atendendo nem a caminho de um chamado.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'inicio_jornada_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'inicio_jornada');
            const totalMin = Math.round(detail?.min ?? 0);
            if (ev.flags.includes('login_atrasado' as any)) {
              const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
              const icalTs = parseDt(ev.inicio_calendario || '');
              const linTs = parseDt(logInVal || '');
              const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
              const waitMin = Math.max(0, totalMin - delayMin);
              alertTexts[flag] = `a distribuição de OS ocorre apenas após o acesso ao sistema. Como a equipe iniciou com ${nfBr(delayMin)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado. No total, passaram-se ${nfBr(totalMin)} min entre o início da jornada programada e o recebimento da OS (sendo ${nfBr(waitMin)} min de espera após o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `${nfBr(totalMin)} min do Início Calendário até o primeiro despacho — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa espera ociosa no início da jornada.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          }
          case 'desloc_intervalo_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'intervalo_deslocamento');
            alertTexts[flag] = `${Math.round(detail?.min ?? 0)} min de Deslocamento de Intervalo — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo ocioso ocorreu antes de iniciar o deslocamento ou durante a pausa.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'intervalo_por_ultimo':
            alertTexts[flag] = `o intervalo foi registrado ao fim do turno (imediatamente antes do Log Off). O intervalo deve ser tirado entre ordens de serviço, não ao fim do turno, pois isso ocasiona erros na metrificação do retorno a base, que fica vazio.`;
            break;
          case 'login_atrasado': {
            const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal || '');
            const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) com ${delayMin} min de atraso em relação ao Início Calendário (acima do limite de ${getLoginAtrasadoLimit(polo)} min). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          }
          case 'calendario_errado': {
            const logInVal2 = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal2 || '');
            const earlyMin = icalTs > 0 && linTs > 0 ? Math.round((icalTs - linTs) / 60000) : getCalendarioErradoLimit(polo);
            alertTexts[flag] = `o login foi realizado ${earlyMin} min antes do Início Calendário (acima do limite de ${getCalendarioErradoLimit(polo)} min de antecedência). Verifique se o horário do calendário de trabalho da equipe está configurado corretamente.`;
            break;
          }
          case 'retorno_excedente':
            alertTexts[flag] = `${Math.round(ev.retorno_excedente_min ?? 0)} min excedentes de Retorno a Base no fim da jornada. Esse tempo não produtivo é somado ao tempo ocioso da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'triagem_alto': {
            const fmtTs = (raw: string | undefined): string => {
              if (!raw) return '—';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const val = ev.triagem_min ?? 0;
            const limit = getTriagemLimit(polo);
            const pct2 = Math.round((val - limit) / limit * 100);
            let trText = `${nfBr(val)} min entre o 1º Despacho (${fmtTs(ev.hora_despacho_anterior)}) e o Despacho (${fmtTs(ev.despachada)}) — ${pct2}% acima do limite (${limit} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvg = Math.round((val - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dir = pctAvg >= 0 ? 'acima' : 'abaixo';
              trText += ` | ${Math.abs(pctAvg)}% ${dir} da média geral (${nfBr(ev.triagem_global_avg_min)} min)`;
            }
            alertTexts[flag] = trText + '.' + getAvgText(team, globalAverages, 'triagem');
            break;
          }
          case 'primeiro_desloc_alto': {
            const val = ev.ocioso_min ?? 0;
            const limit = getPrimeiroDeslocLimit(polo);
            const pct = Math.round((val - limit) / limit * 100);
            alertTexts[flag] = `o tempo desde o Início Calendário até o primeiro registro de 'A Caminho' foi de ${nfBr(val)} min — ${pct}% acima do limite de ${limit} min. Esse tempo reflete o tempo total ocioso no início da jornada antes do primeiro deslocamento.${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          }
        }
      }

      const enrichedDetails = ev.sem_os_details?.map((d) => {
        const text = semOsDetailText({ ...d, polo } as any);
        const sep = text.indexOf(': ');
        return { ...d, label: sep > -1 ? text.slice(0, sep) : text, body: sep > -1 ? text.slice(sep + 2) : '' };
      });

      let entreOsAfterIntervalo: OsDiaOrderEvidence['entreOsAfterIntervalo'];
      if (ev.fim_intervalo && ev.despachada) {
        const fimTs  = parseDt(ev.fim_intervalo);
        const despTs = parseDt(ev.despachada);
        if (fimTs > 0 && despTs > 0 && despTs > fimTs) {
          const minDiff = Math.round((despTs - fimTs) / 60000);
          if (minDiff > 10) {
            const alreadyCovered = ev.sem_os_details?.some((d) => d.type === 'entre_ordens' && d.from === ev.fim_intervalo);
            if (!alreadyCovered) {
              entreOsAfterIntervalo = { min: minDiff, from: ev.fim_intervalo, to: ev.despachada };
            }
          }
        }
      }

      let enrichedRetornoExcedente: typeof ev.retorno_excedente_details | undefined;
      if (ev.retorno_excedente_details) {
        const text = semOsDetailText({ ...ev.retorno_excedente_details, polo } as any);
        const sep = text.indexOf(': ');
        enrichedRetornoExcedente = {
          ...ev.retorno_excedente_details,
          label: sep > -1 ? text.slice(0, sep) : text,
          body: sep > -1 ? text.slice(sep + 2) : ''
        };
      }

      return {
        ...ev,
        alertTexts,
        sem_os_details: enrichedDetails ?? ev.sem_os_details,
        retorno_excedente_details: enrichedRetornoExcedente ?? ev.retorno_excedente_details,
        ...(entreOsAfterIntervalo ? { entreOsAfterIntervalo } : {}),
      };
    });
  }

  /** Enriches Eficiencia evidence items with pre-computed alertTexts. */
export function enrichEficienciaEvidence(
    orders: EficienciaOrderEvidence[],
    analysis: { globalAvgExecucaoMin: number; globalAvgDeslocamentoMin: number; team?: string; globalAverages?: GlobalAveragesMap },
  ): EficienciaOrderEvidence[] {
    return orders.map((ev) => {
      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag) {
          case 'tr_muito_baixo':
            alertTexts[flag] = `${ev.tr_ordem_min} min de execução — ${analysis.globalAvgExecucaoMin > 0 ? nfBr((analysis.globalAvgExecucaoMin - ev.tr_ordem_min) / analysis.globalAvgExecucaoMin * 100, 0, 0) : '?'}% abaixo da média geral de ${nfBr(analysis.globalAvgExecucaoMin)} min. Deslocamento registrado (TL): ${ev.tl_ordem_min} min${ev.tl_ordem_min > analysis.globalAvgDeslocamentoMin ? ' — TL elevado indica erro no apontamento de "A Caminho" ou "No Local", comprimindo artificialmente o TR' : ' — grande possibilidade de erro de apontamento de "A Caminho" ou "No Local"'}.`;
            break;
          case 'deslocamento_curto':
            alertTexts[flag] = `o tempo de deslocamento desta OS foi de apenas ${ev.tl_ordem_min} min — inferior a 25% da média geral de ${nfBr(analysis.globalAvgDeslocamentoMin)} min. Pode indicar atendimento sem deslocamento real ou lançamento incorreto no sistema.`;
            break;
          case 'tr_excede_hd': {
            let trEfetivo = ev.tr_ordem_min;
            let intervalNote = '';
            if (ev.no_local && ev.inicio_intervalo && ev.fim_intervalo) {
              const parseDt2 = (s: string): number => {
                const parts = s.split(' ');
                if (parts.length < 2) return 0;
                const [day, mon, yr] = (parts[0] ?? '').split('/');
                const [hr, min, sec] = (parts[1] ?? '').split(':');
                return new Date(+(yr ?? 0), +(mon ?? 1) - 1, +(day ?? 1), +(hr ?? 0), +(min ?? 0), +(sec ?? 0)).getTime();
              };
              const noLocalTs  = parseDt2(ev.no_local);
              const iniIntTs   = parseDt2(ev.inicio_intervalo);
              const fimIntTs   = parseDt2(ev.fim_intervalo);
              const liberadaTs = parseDt2(ev.liberada);
              if (noLocalTs > 0 && iniIntTs > 0 && fimIntTs > 0 && liberadaTs > 0 &&
                  iniIntTs >= noLocalTs && fimIntTs <= liberadaTs) {
                trEfetivo = Math.round((liberadaTs - fimIntTs) / 60000);
                const totalDiscounted = ev.tr_ordem_min - trEfetivo;
                intervalNote = ` (efetivo: ${trEfetivo} min, descontados ${totalDiscounted} min)`;
              }
            }
            const hdPct = ev.hd_total_min > 0
              ? Math.round(trEfetivo / ev.hd_total_min * 10000) / 100
              : ev.hd_pct_tr;
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} — ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'não cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.`;
            break;
          }
          case 'tempo_padrao_vazio':
            alertTexts[flag] = `esta OS foi atendida em ${ev.tr_ordem_min} min, mas não tem tempo padrão definido no M300. Sem esse dado, a eficiência é calculada como zero, prejudicando o resultado da equipe mesmo que o atendimento tenha sido realizado.`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }

  /** Enriches Utilização evidence items with pre-computed alertTexts. */
export function enrichUtilizacaoEvidence(orders: UtilizacaoOrderEvidence[], team?: string, globalAverages?: GlobalAveragesMap): UtilizacaoOrderEvidence[] {
    const teamMap = team ? globalAverages?.teamAverages[team.toUpperCase()] : undefined;
    const polo = teamMap?.polo;
    const parseDt = (s: string): number => {
      const parts = s.split(' ');
      if (parts.length < 2) return 0;
      const [day, mon, yr] = (parts[0] ?? '').split('/');
      const [hr, min, sec] = (parts[1] ?? '').split(':');
      return new Date(+(yr ?? 0), +(mon ?? 1) - 1, +(day ?? 1), +(hr ?? 0), +(min ?? 0), +(sec ?? 0)).getTime();
    };

    return orders.map((ev) => {
      const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
      if (!ev.prev_liberada && ev.inicio_calendario && logInVal) {
        const icalTs = parseDt(ev.inicio_calendario);
        const linTs = parseDt(logInVal);
        if (icalTs > 0 && linTs > 0) {
          const earlyMin = Math.round((icalTs - linTs) / 60000);
          if (earlyMin > getCalendarioErradoLimit(polo)) {
            if (!ev.flags.includes('calendario_errado' as any)) {
              ev.flags.push('calendario_errado' as any);
            }
          } else if (earlyMin < -getLoginAtrasadoLimit(polo)) {
            if (!ev.flags.includes('login_atrasado' as any)) {
              ev.flags.push('login_atrasado' as any);
            }
          }
        }
      }

      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag) {
          case 'tr_excede_hd': {
            let trEfetivo = ev.tr_ordem_min;
            let intervalNote = '';
            if (ev.no_local && ev.inicio_intervalo && ev.fim_intervalo) {
              const noLocalTs  = parseDt(ev.no_local);
              const iniIntTs   = parseDt(ev.inicio_intervalo);
              const fimIntTs   = parseDt(ev.fim_intervalo);
              const liberadaTs = parseDt(ev.liberada);
              if (noLocalTs > 0 && iniIntTs > 0 && fimIntTs > 0 && liberadaTs > 0 &&
                  iniIntTs >= noLocalTs && fimIntTs <= liberadaTs) {
                trEfetivo = Math.round((liberadaTs - fimIntTs) / 60000);
                const totalDiscounted = ev.tr_ordem_min - trEfetivo;
                intervalNote = ` (efetivo: ${trEfetivo} min, descontados ${totalDiscounted} min)`;
              }
            }
            const hdPct = ev.hd_total_min > 0
              ? Math.round(trEfetivo / ev.hd_total_min * 10000) / 100
              : ev.hd_pct_tr;
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} — ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'não cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
            break;
          }
          case 'temp_prep_alto': {
            const tempPrepMin = ev.temp_prep_os_min ?? 0;
            const limit = getTempPrepLimit(polo);
            const pct = Math.round((tempPrepMin - limit) / limit * 100);
            const subject = ev.prev_liberada
              ? 'a Despachada e o registro de saída nesta OS'
              : 'a Despachada e o registro de saída desta 1ª OS';
            alertTexts[flag] = `o técnico levou ${tempPrepMin} min entre ${subject} — ${pct}% acima do limite de ${limit} min. Esse tempo representa espera antes de se deslocar para o próximo atendimento.${getAvgText(team, globalAverages, 'temp_prep')}`;
            break;
          }
          case 'sem_os_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'entre_ordens');
            const minVal = Math.round(detail?.min ?? ev.sem_os_total_min ?? getSemOsLimit(polo));
            alertTexts[flag] = `${minVal} min sem OS registrada — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa intervalos ociosos em que o técnico não estava atendendo nem a caminho de um chamado.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'inicio_jornada_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'inicio_jornada');
            const totalMin = Math.round(detail?.min ?? 0);
            if (ev.flags.includes('login_atrasado' as any)) {
              const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
              const icalTs = parseDt(ev.inicio_calendario || '');
              const linTs = parseDt(logInVal || '');
              const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
              const waitMin = Math.max(0, totalMin - delayMin);
              alertTexts[flag] = `a distribuição de OS ocorre apenas após o acesso ao sistema. Como a equipe iniciou com ${nfBr(delayMin)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado. No total, passaram-se ${nfBr(totalMin)} min entre o início da jornada programada e o recebimento da OS (sendo ${nfBr(waitMin)} min de espera após o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `${nfBr(totalMin)} min do Início Calendário até o primeiro despacho — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa espera ociosa no início da jornada.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          }
          case 'desloc_intervalo_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'intervalo_deslocamento');
            alertTexts[flag] = `${Math.round(detail?.min ?? 0)} min de Deslocamento de Intervalo — acima do limite de ${getSemOsLimit(polo)} min. Esse tempo ocioso ocorreu antes de iniciar o deslocamento ou durante a pausa.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'login_atrasado': {
            const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal || '');
            const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) com ${delayMin} min de atraso em relação ao Início Calendário (acima do limite de ${getLoginAtrasadoLimit(polo)} min). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          }
          case 'retorno_excedente':
            alertTexts[flag] = `${Math.round(ev.retorno_excedente_min ?? 0)} min excedentes de Retorno a Base no fim da jornada. Esse tempo não produtivo é somado ao tempo ocioso da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'triagem_alto': {
            const fmtTs2 = (raw: string | undefined): string => {
              if (!raw) return '—';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const val2 = ev.triagem_min ?? 0;
            const limit3 = getTriagemLimit(polo);
            const pct3 = Math.round((val2 - limit3) / limit3 * 100);
            let trText2 = `${nfBr(val2)} min entre o 1º Despacho (${fmtTs2(ev.hora_despacho_anterior)}) e o Despacho (${fmtTs2(ev.despachada)}) — ${pct3}% acima do limite (${limit3} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvg2 = Math.round((val2 - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dir2 = pctAvg2 >= 0 ? 'acima' : 'abaixo';
              trText2 += ` | ${Math.abs(pctAvg2)}% ${dir2} da média geral (${nfBr(ev.triagem_global_avg_min)} min)`;
            }
            alertTexts[flag] = trText2 + '.' + getAvgText(team, globalAverages, 'triagem');
            break;
          }
          case 'primeiro_desloc_alto': {
            const val2d = ev.ocioso_min ?? 0;
            const limit2d = getPrimeiroDeslocLimit();
            const pct2d = Math.round((val2d - limit2d) / limit2d * 100);
            alertTexts[flag] = `o tempo desde o Início Calendário até o primeiro registro de 'A Caminho' foi de ${nfBr(val2d)} min — ${pct2d}% acima do limite de ${limit2d} min. Esse tempo reflete o tempo total ocioso no início da jornada antes do primeiro deslocamento.${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          }
        }
      }

      const enrichedDetails = ev.sem_os_details?.map((d) => {
        const text = semOsDetailText(d);
        const sep = text.indexOf(': ');
        return { ...d, label: sep > -1 ? text.slice(0, sep) : text, body: sep > -1 ? text.slice(sep + 2) : '' };
      });

      let enrichedRetornoExcedente: typeof ev.retorno_excedente_details | undefined;
      if (ev.retorno_excedente_details) {
        const text = semOsDetailText(ev.retorno_excedente_details as any);
        const sep = text.indexOf(': ');
        enrichedRetornoExcedente = {
          ...ev.retorno_excedente_details,
          label: sep > -1 ? text.slice(0, sep) : text,
          body: sep > -1 ? text.slice(sep + 2) : ''
        };
      }

      return {
        ...ev,
        alertTexts,
        sem_os_details: enrichedDetails ?? ev.sem_os_details,
        retorno_excedente_details: enrichedRetornoExcedente ?? ev.retorno_excedente_details,
      };
    });
  }

  /** Enriches TME IMP evidence items with pre-computed alertTexts. */
export function enrichTmeImpEvidence(orders: TmeImpOrderEvidence[], team?: string, globalAverages?: GlobalAveragesMap): TmeImpOrderEvidence[] {
    return orders.map((ev) => {
      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag) {
          case 'tme_muito_alto':
            alertTexts[flag] = `esta OS acumulou ${nfBr(ev.tme_imp_min)} min de tempo improdutivo — acima da média da equipe (${nfBr(ev.team_avg_tme_min)} min) e da média geral (${nfBr(ev.global_avg_tme_min)} min). Esse é o tempo entre a chegada ao local (No Local) e a liberação da OS, sem execução produtiva registrada. Quanto maior esse tempo, mais prejudica a pontuação da equipe.${getAvgText(team, globalAverages, 'tme_imp')}`;
            break;
          case 'sem_deslocamento':
            alertTexts[flag] = `a OS tem ${nfBr(ev.tl_ordem_min)} min de deslocamento, mas não há horário de saída lançado no sistema. O técnico se deslocou mas não atualizou o aplicativo, impedindo o cálculo correto do tempo improdutivo.`;
            break;
          case 'sem_execucao':
            alertTexts[flag] = `esta OS não tem registro de execução, mas acumulou tempo improdutivo. Pode indicar uma OS encerrada sem atendimento real ou lançamento incorreto no sistema.`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }

  /** Enriches Primeiro Login evidence items with pre-computed alertTexts. */
export function enrichLoginEvidence(days: PrimeiroLoginDayEvidence[], metaTarget: number, team?: string, globalAverages?: GlobalAveragesMap): PrimeiroLoginDayEvidence[] {
    return days.map((ev) => {
      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag as string) {
          case 'login_muito_tardio':
            alertTexts[flag] = `o técnico levou ${nfBr(ev.primeiro_login_min)} min para entrar no sistema — mais do que o dobro da meta de ${metaTarget} min. Um atraso tão grande atrasa o primeiro despacho e reduz bastante o tempo disponível para atendimento no dia.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'login_tardio':
            alertTexts[flag] = `o técnico levou ${nfBr(ev.primeiro_login_min)} min para entrar no sistema — acima da meta de ${metaTarget} min (média da equipe: ${nfBr(ev.team_avg_login_min)} min). Quanto mais tarde o técnico acessa o sistema, mais tarde recebe o primeiro despacho e menos chamados consegue atender no dia.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'login_antes_inicio':
            alertTexts[flag] = `o técnico acessou o sistema com ${Math.abs(ev.primeiro_login_min)} min de antecedência em relação ao horário de Início Calendário. Verifique se o horário do calendário de trabalho da equipe está configurado corretamente.`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }

  /** Enriches Primeiro Desloc evidence items with pre-computed alertTexts. */
export function enrichDeslocEvidence(days: PrimeiroDeslocDayEvidence[], metaTarget: number, team?: string, globalAverages?: GlobalAveragesMap): PrimeiroDeslocDayEvidence[] {
    return days.map((ev) => {
      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag) {
          case 'despacho_tardio':
            if (ev.flags.includes('login_atrasado')) {
              alertTexts[flag] = `a distribuição de OS ocorre apenas após o acesso ao sistema. Como a equipe iniciou com ${nfBr(ev.login_atraso_min)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado pela regra de negócio. No total, passaram-se ${nfBr(ev.despacho_apos_inicio_min)} min entre o início da jornada programada e o recebimento da OS (sendo ${nfBr(ev.despacho_apos_inicio_min - ev.login_atraso_min)} min de espera após o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `a equipe recebeu a primeira OS com ${nfBr(ev.despacho_apos_inicio_min)} min de atraso em relação ao início da jornada - acima do limite de ${getSemOsLimit()} min. Esse atraso na fila inicial de distribuição reduz o tempo disponível para atendimentos no dia.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          case 'login_atrasado':
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) às ${ev.log_in_corrigido}, acumulando ${nfBr(ev.login_atraso_min)} min de ociosidade em relação ao início da jornada programada (${ev.inicio_calendario}). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'desloc_muito_lento':
            alertTexts[flag] = `a equipe acumulou ${nfBr(ev.primeiro_desloc_min)} min desde o início da jornada até registrar a saída para o primeiro atendimento — mais de 1,5× a meta de ${metaTarget} min.${ev.despacho_apos_inicio_min > 0 ? ` Lembre-se que este tempo inclui o atraso de ${nfBr(ev.despacho_apos_inicio_min)} min ocorrido até o recebimento da primeira OS.` : ' Uma demora tão grande indica que o técnico ficou parado por muito tempo antes de se deslocar.'}${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          case 'desloc_lento':
            alertTexts[flag] = `a equipe levou ${nfBr(ev.primeiro_desloc_min)} min entre o início da jornada e o primeiro registro 'A Caminho' — acima da meta de ${metaTarget} min e da média da equipe de ${nfBr(ev.team_avg_desloc_min)} min. Quanto mais demora o primeiro deslocamento, menor o tempo para atender o resto da fila.${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          case 'sem_desloc_registrado':
            alertTexts[flag] = `há registro de despacho, mas o técnico não atualizou o status de saída. Isso impede o cálculo real do 1º Desloc. e indica que o deslocamento pode ter ocorrido sem lançamento no sistema.`;
            break;
          case 'triagem_alto': {
            const fmtTsDesloc = (raw: string | undefined): string => {
              if (!raw) return '—';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const valDesloc = ev.triagem_min ?? 0;
            const limitDesloc = getTriagemLimit();
            const pctDesloc = Math.round((valDesloc - limitDesloc) / limitDesloc * 100);
            let trTextDesloc = `${nfBr(valDesloc)} min entre o 1º Despacho (${fmtTsDesloc(ev.hora_despacho_anterior)}) e o Despacho (${fmtTsDesloc(ev.despachada)}) — ${pctDesloc}% acima do limite (${limitDesloc} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvgD = Math.round((valDesloc - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dirD = pctAvgD >= 0 ? 'acima' : 'abaixo';
              trTextDesloc += ` | ${Math.abs(pctAvgD)}% ${dirD} da média geral (${nfBr(ev.triagem_global_avg_min)} min)`;
            }
            alertTexts[flag] = trTextDesloc + '.';
            break;
          }
        }
      }
      return { ...ev, alertTexts };
    });
  }

  /** Enriches Retorno Base evidence items with pre-computed alertTexts. */
export function enrichRetornoEvidence(days: RetornoBaseDayEvidence[], metaTarget: number, team?: string, globalAverages?: GlobalAveragesMap): RetornoBaseDayEvidence[] {
    return days.map((ev) => {
      const alertTexts: Record<string, string> = {};
      for (const flag of ev.flags) {
        switch (flag) {
          case 'retorno_muito_alto':
            alertTexts[flag] = `${nfBr(ev.retorno_base_min)} min — mais de 1,5× a meta de ${metaTarget} min. Pode indicar trajeto muito longo até a base, região de atuação distante, ou permanência no campo sem atendimento após a última OS. Retornos longos são descontados no cálculo de Utilização, prejudicando a nota da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'retorno_alto':
            alertTexts[flag] = `${nfBr(ev.retorno_base_min)} min — acima da meta de ${metaTarget} min (média da equipe: ${nfBr(ev.team_avg_retorno_min)} min, média geral: ${nfBr(ev.global_avg_retorno_min)} min). Esse tempo é descontado no cálculo de Utilização, impactando diretamente na nota da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'retorno_divergente':
            alertTexts[flag] = `Atenção: o tempo real de retorno (após o fim do intervalo) foi de ${nfBr(ev.true_retorno_min ?? 0)} min, mas o sistema apontou ${nfBr(ev.retorno_base_min)} min (desde a última Liberada).`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }


import type { 
  OsDiaOrderEvidence, EficienciaOrderEvidence, TmeImpOrderEvidence, 
  PrimeiroLoginDayEvidence, PrimeiroDeslocDayEvidence, RetornoBaseDayEvidence, 
  UtilizacaoOrderEvidence, GlobalAveragesMap 
} from '../types.js';
import { 
  nfBr, getAvgText, semOsDetailText, getTempPrepLimit, getSemOsLimit, 
  getPrimeiroDeslocLimit, getTriagemLimit, getCalendarioErradoLimit, getLoginAtrasadoLimit 
} from './formatters.js';

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
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} â€” ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'nÃ£o cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
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
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} â€” ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'nÃ£o cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
            break;
          }
          case 'tl_excede_hd':
            alertTexts[flag] = `o tÃ©cnico passou ${ev.tl_ordem_min} min em deslocamento nesta OS â€” ${ev.global_avg_tl_min > 0 ? nfBr((ev.tl_ordem_min - ev.global_avg_tl_min) / ev.global_avg_tl_min * 100, 0, 0) : '?'}% acima da mÃ©dia geral de ${nfBr(ev.global_avg_tl_min)} min, representando ${ev.hd_pct_tl}% da jornada de ${ev.hd_total_min} min. Deslocamentos muito longos consomem boa parte do dia e diminuem o nÃºmero de OS atendidas.${getAvgText(team, globalAverages, 'triagem')}`;
            break;
          case 'temp_prep_alto': {
            const tempPrepMin = ev.temp_prep_os_min ?? 0;
            const limit = getTempPrepLimit(polo);
            const pct = Math.round((tempPrepMin - limit) / limit * 100);
            const subject = ev.prev_liberada
              ? 'a Despachada e o registro de saÃ­da nesta OS'
              : 'a Despachada e o registro de saÃ­da desta 1Âª OS';
            alertTexts[flag] = `o tÃ©cnico levou ${tempPrepMin} min entre ${subject} â€” ${pct}% acima do limite de ${limit} min. Esse tempo representa espera antes de se deslocar para o prÃ³ximo atendimento.${getAvgText(team, globalAverages, 'temp_prep')}`;
            break;
          }
          case 'sem_os_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'entre_ordens');
            const minVal = Math.round(detail?.min ?? ev.sem_os_total_min ?? getSemOsLimit(polo));
            alertTexts[flag] = `${minVal} min sem OS registrada â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa intervalos ociosos em que o tÃ©cnico nÃ£o estava atendendo nem a caminho de um chamado.${getAvgText(team, globalAverages, 'sem_os')}`;
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
              alertTexts[flag] = `a distribuiÃ§Ã£o de OS ocorre apenas apÃ³s o acesso ao sistema. Como a equipe iniciou com ${nfBr(delayMin)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado. No total, passaram-se ${nfBr(totalMin)} min entre o inÃ­cio da jornada programada e o recebimento da OS (sendo ${nfBr(waitMin)} min de espera apÃ³s o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `${nfBr(totalMin)} min do InÃ­cio CalendÃ¡rio atÃ© o primeiro despacho â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa espera ociosa no inÃ­cio da jornada.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          }
          case 'desloc_intervalo_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'intervalo_deslocamento');
            alertTexts[flag] = `${Math.round(detail?.min ?? 0)} min de Deslocamento de Intervalo â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo ocioso ocorreu antes de iniciar o deslocamento ou durante a pausa.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'intervalo_por_ultimo':
            alertTexts[flag] = `o intervalo foi registrado ao fim do turno (imediatamente antes do Log Off). O intervalo deve ser tirado entre ordens de serviÃ§o, nÃ£o ao fim do turno, pois isso ocasiona erros na metrificaÃ§Ã£o do retorno a base, que fica vazio.`;
            break;
          case 'login_atrasado': {
            const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal || '');
            const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) com ${delayMin} min de atraso em relaÃ§Ã£o ao InÃ­cio CalendÃ¡rio (acima do limite de ${getLoginAtrasadoLimit(polo)} min). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          }
          case 'calendario_errado': {
            const logInVal2 = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal2 || '');
            const earlyMin = icalTs > 0 && linTs > 0 ? Math.round((icalTs - linTs) / 60000) : getCalendarioErradoLimit(polo);
            alertTexts[flag] = `o login foi realizado ${earlyMin} min antes do InÃ­cio CalendÃ¡rio (acima do limite de ${getCalendarioErradoLimit(polo)} min de antecedÃªncia). Verifique se o horÃ¡rio do calendÃ¡rio de trabalho da equipe estÃ¡ configurado corretamente.`;
            break;
          }
          case 'retorno_excedente':
            alertTexts[flag] = `${Math.round(ev.retorno_excedente_min ?? 0)} min excedentes de Retorno a Base no fim da jornada. Esse tempo nÃ£o produtivo Ã© somado ao tempo ocioso da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'triagem_alto': {
            const fmtTs = (raw: string | undefined): string => {
              if (!raw) return 'â€”';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const val = ev.triagem_min ?? 0;
            const limit = getTriagemLimit(polo);
            const pct2 = Math.round((val - limit) / limit * 100);
            let trText = `${nfBr(val)} min entre o 1Âº Despacho (${fmtTs(ev.hora_despacho_anterior)}) e o Despacho (${fmtTs(ev.despachada)}) â€” ${pct2}% acima do limite (${limit} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvg = Math.round((val - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dir = pctAvg >= 0 ? 'acima' : 'abaixo';
              trText += ` | ${Math.abs(pctAvg)}% ${dir} da mÃ©dia geral (${nfBr(ev.triagem_global_avg_min)} min)`;
            }
            alertTexts[flag] = trText + '.' + getAvgText(team, globalAverages, 'triagem');
            break;
          }
          case 'primeiro_desloc_alto': {
            const val = ev.ocioso_min ?? 0;
            const limit = getPrimeiroDeslocLimit(polo);
            const pct = Math.round((val - limit) / limit * 100);
            alertTexts[flag] = `o tempo desde o InÃ­cio CalendÃ¡rio atÃ© o primeiro registro de 'A Caminho' foi de ${nfBr(val)} min â€” ${pct}% acima do limite de ${limit} min. Esse tempo reflete o tempo total ocioso no inÃ­cio da jornada antes do primeiro deslocamento.${getAvgText(team, globalAverages, 'desloc')}`;
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
            alertTexts[flag] = `${ev.tr_ordem_min} min de execuÃ§Ã£o â€” ${analysis.globalAvgExecucaoMin > 0 ? nfBr((analysis.globalAvgExecucaoMin - ev.tr_ordem_min) / analysis.globalAvgExecucaoMin * 100, 0, 0) : '?'}% abaixo da mÃ©dia geral de ${nfBr(analysis.globalAvgExecucaoMin)} min. Deslocamento registrado (TL): ${ev.tl_ordem_min} min${ev.tl_ordem_min > analysis.globalAvgDeslocamentoMin ? ' â€” TL elevado indica erro no apontamento de "A Caminho" ou "No Local", comprimindo artificialmente o TR' : ' â€” grande possibilidade de erro de apontamento de "A Caminho" ou "No Local"'}.`;
            break;
          case 'deslocamento_curto':
            alertTexts[flag] = `o tempo de deslocamento desta OS foi de apenas ${ev.tl_ordem_min} min â€” inferior a 25% da mÃ©dia geral de ${nfBr(analysis.globalAvgDeslocamentoMin)} min. Pode indicar atendimento sem deslocamento real ou lanÃ§amento incorreto no sistema.`;
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
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} â€” ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'nÃ£o cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.`;
            break;
          }
          case 'tempo_padrao_vazio':
            alertTexts[flag] = `esta OS foi atendida em ${ev.tr_ordem_min} min, mas nÃ£o tem tempo padrÃ£o definido no M300. Sem esse dado, a eficiÃªncia Ã© calculada como zero, prejudicando o resultado da equipe mesmo que o atendimento tenha sido realizado.`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }

  /** Enriches UtilizaÃ§Ã£o evidence items with pre-computed alertTexts. */
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
            alertTexts[flag] = `esta OS apresentou TR Ordem: ${ev.tr_ordem_min} min${intervalNote} â€” ${hdPct}% da jornada de ${ev.hd_total_min} min, acima do limite de 20%. Tempo previsto no M300: ${ev.tempo_padrao_min !== undefined ? ev.tempo_padrao_min + ' min' : 'nÃ£o cadastrado'}. Uma OS com atendimento muito longo reduz a capacidade de realizar outros chamados no dia.${getAvgText(team, globalAverages, 'tr_ordem')}`;
            break;
          }
          case 'temp_prep_alto': {
            const tempPrepMin = ev.temp_prep_os_min ?? 0;
            const limit = getTempPrepLimit(polo);
            const pct = Math.round((tempPrepMin - limit) / limit * 100);
            const subject = ev.prev_liberada
              ? 'a Despachada e o registro de saÃ­da nesta OS'
              : 'a Despachada e o registro de saÃ­da desta 1Âª OS';
            alertTexts[flag] = `o tÃ©cnico levou ${tempPrepMin} min entre ${subject} â€” ${pct}% acima do limite de ${limit} min. Esse tempo representa espera antes de se deslocar para o prÃ³ximo atendimento.${getAvgText(team, globalAverages, 'temp_prep')}`;
            break;
          }
          case 'sem_os_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'entre_ordens');
            const minVal = Math.round(detail?.min ?? ev.sem_os_total_min ?? getSemOsLimit(polo));
            alertTexts[flag] = `${minVal} min sem OS registrada â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa intervalos ociosos em que o tÃ©cnico nÃ£o estava atendendo nem a caminho de um chamado.${getAvgText(team, globalAverages, 'sem_os')}`;
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
              alertTexts[flag] = `a distribuiÃ§Ã£o de OS ocorre apenas apÃ³s o acesso ao sistema. Como a equipe iniciou com ${nfBr(delayMin)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado. No total, passaram-se ${nfBr(totalMin)} min entre o inÃ­cio da jornada programada e o recebimento da OS (sendo ${nfBr(waitMin)} min de espera apÃ³s o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `${nfBr(totalMin)} min do InÃ­cio CalendÃ¡rio atÃ© o primeiro despacho â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo representa espera ociosa no inÃ­cio da jornada.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          }
          case 'desloc_intervalo_alto': {
            const detail = ev.sem_os_details?.find(d => d.type === 'intervalo_deslocamento');
            alertTexts[flag] = `${Math.round(detail?.min ?? 0)} min de Deslocamento de Intervalo â€” acima do limite de ${getSemOsLimit(polo)} min. Esse tempo ocioso ocorreu antes de iniciar o deslocamento ou durante a pausa.${getAvgText(team, globalAverages, 'sem_os')}`;
            break;
          }
          case 'login_atrasado': {
            const logInVal = (ev as any).log_in_corrigido || (ev as any).log_in;
            const icalTs = parseDt(ev.inicio_calendario || '');
            const linTs = parseDt(logInVal || '');
            const delayMin = icalTs > 0 && linTs > 0 ? Math.round((linTs - icalTs) / 60000) : getLoginAtrasadoLimit(polo);
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) com ${delayMin} min de atraso em relaÃ§Ã£o ao InÃ­cio CalendÃ¡rio (acima do limite de ${getLoginAtrasadoLimit(polo)} min). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          }
          case 'retorno_excedente':
            alertTexts[flag] = `${Math.round(ev.retorno_excedente_min ?? 0)} min excedentes de Retorno a Base no fim da jornada. Esse tempo nÃ£o produtivo Ã© somado ao tempo ocioso da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'triagem_alto': {
            const fmtTs2 = (raw: string | undefined): string => {
              if (!raw) return 'â€”';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const val2 = ev.triagem_min ?? 0;
            const limit3 = getTriagemLimit(polo);
            const pct3 = Math.round((val2 - limit3) / limit3 * 100);
            let trText2 = `${nfBr(val2)} min entre o 1Âº Despacho (${fmtTs2(ev.hora_despacho_anterior)}) e o Despacho (${fmtTs2(ev.despachada)}) â€” ${pct3}% acima do limite (${limit3} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvg2 = Math.round((val2 - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dir2 = pctAvg2 >= 0 ? 'acima' : 'abaixo';
              trText2 += ` | ${Math.abs(pctAvg2)}% ${dir2} da mÃ©dia geral (${nfBr(ev.triagem_global_avg_min)} min)`;
            }
            alertTexts[flag] = trText2 + '.' + getAvgText(team, globalAverages, 'triagem');
            break;
          }
          case 'primeiro_desloc_alto': {
            const val2d = ev.ocioso_min ?? 0;
            const limit2d = getPrimeiroDeslocLimit();
            const pct2d = Math.round((val2d - limit2d) / limit2d * 100);
            alertTexts[flag] = `o tempo desde o InÃ­cio CalendÃ¡rio atÃ© o primeiro registro de 'A Caminho' foi de ${nfBr(val2d)} min â€” ${pct2d}% acima do limite de ${limit2d} min. Esse tempo reflete o tempo total ocioso no inÃ­cio da jornada antes do primeiro deslocamento.${getAvgText(team, globalAverages, 'desloc')}`;
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
            alertTexts[flag] = `esta OS acumulou ${nfBr(ev.tme_imp_min)} min de tempo improdutivo â€” acima da mÃ©dia da equipe (${nfBr(ev.team_avg_tme_min)} min) e da mÃ©dia geral (${nfBr(ev.global_avg_tme_min)} min). Esse Ã© o tempo entre a chegada ao local (No Local) e a liberaÃ§Ã£o da OS, sem execuÃ§Ã£o produtiva registrada. Quanto maior esse tempo, mais prejudica a pontuaÃ§Ã£o da equipe.${getAvgText(team, globalAverages, 'tme_imp')}`;
            break;
          case 'sem_deslocamento':
            alertTexts[flag] = `a OS tem ${nfBr(ev.tl_ordem_min)} min de deslocamento, mas nÃ£o hÃ¡ horÃ¡rio de saÃ­da lanÃ§ado no sistema. O tÃ©cnico se deslocou mas nÃ£o atualizou o aplicativo, impedindo o cÃ¡lculo correto do tempo improdutivo.`;
            break;
          case 'sem_execucao':
            alertTexts[flag] = `esta OS nÃ£o tem registro de execuÃ§Ã£o, mas acumulou tempo improdutivo. Pode indicar uma OS encerrada sem atendimento real ou lanÃ§amento incorreto no sistema.`;
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
            alertTexts[flag] = `o tÃ©cnico levou ${nfBr(ev.primeiro_login_min)} min para entrar no sistema â€” mais do que o dobro da meta de ${metaTarget} min. Um atraso tÃ£o grande atrasa o primeiro despacho e reduz bastante o tempo disponÃ­vel para atendimento no dia.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'login_tardio':
            alertTexts[flag] = `o tÃ©cnico levou ${nfBr(ev.primeiro_login_min)} min para entrar no sistema â€” acima da meta de ${metaTarget} min (mÃ©dia da equipe: ${nfBr(ev.team_avg_login_min)} min). Quanto mais tarde o tÃ©cnico acessa o sistema, mais tarde recebe o primeiro despacho e menos chamados consegue atender no dia.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'login_antes_inicio':
            alertTexts[flag] = `o tÃ©cnico acessou o sistema com ${Math.abs(ev.primeiro_login_min)} min de antecedÃªncia em relaÃ§Ã£o ao horÃ¡rio de InÃ­cio CalendÃ¡rio. Verifique se o horÃ¡rio do calendÃ¡rio de trabalho da equipe estÃ¡ configurado corretamente.`;
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
              alertTexts[flag] = `a distribuiÃ§Ã£o de OS ocorre apenas apÃ³s o acesso ao sistema. Como a equipe iniciou com ${nfBr(ev.login_atraso_min)} min de atraso no Log In, o despacho da primeira OS foi naturalmente impactado pela regra de negÃ³cio. No total, passaram-se ${nfBr(ev.despacho_apos_inicio_min)} min entre o inÃ­cio da jornada programada e o recebimento da OS (sendo ${nfBr(ev.despacho_apos_inicio_min - ev.login_atraso_min)} min de espera apÃ³s o acesso).${getAvgText(team, globalAverages, 'sem_os')}`;
            } else {
              alertTexts[flag] = `a equipe recebeu a primeira OS com ${nfBr(ev.despacho_apos_inicio_min)} min de atraso em relaÃ§Ã£o ao inÃ­cio da jornada - acima do limite de ${getSemOsLimit()} min. Esse atraso na fila inicial de distribuiÃ§Ã£o reduz o tempo disponÃ­vel para atendimentos no dia.${getAvgText(team, globalAverages, 'sem_os')}`;
            }
            break;
          case 'login_atrasado':
            alertTexts[flag] = `a equipe registrou acesso ao sistema (Log In) Ã s ${ev.log_in_corrigido}, acumulando ${nfBr(ev.login_atraso_min)} min de ociosidade em relaÃ§Ã£o ao inÃ­cio da jornada programada (${ev.inicio_calendario}). O atraso compromete diretamente o tempo de deslocamento.${getAvgText(team, globalAverages, 'login')}`;
            break;
          case 'desloc_muito_lento':
            alertTexts[flag] = `a equipe acumulou ${nfBr(ev.primeiro_desloc_min)} min desde o inÃ­cio da jornada atÃ© registrar a saÃ­da para o primeiro atendimento â€” mais de 1,5Ã— a meta de ${metaTarget} min.${ev.despacho_apos_inicio_min > 0 ? ` Lembre-se que este tempo inclui o atraso de ${nfBr(ev.despacho_apos_inicio_min)} min ocorrido atÃ© o recebimento da primeira OS.` : ' Uma demora tÃ£o grande indica que o tÃ©cnico ficou parado por muito tempo antes de se deslocar.'}${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          case 'desloc_lento':
            alertTexts[flag] = `a equipe levou ${nfBr(ev.primeiro_desloc_min)} min entre o inÃ­cio da jornada e o primeiro registro 'A Caminho' â€” acima da meta de ${metaTarget} min e da mÃ©dia da equipe de ${nfBr(ev.team_avg_desloc_min)} min. Quanto mais demora o primeiro deslocamento, menor o tempo para atender o resto da fila.${getAvgText(team, globalAverages, 'desloc')}`;
            break;
          case 'sem_desloc_registrado':
            alertTexts[flag] = `hÃ¡ registro de despacho, mas o tÃ©cnico nÃ£o atualizou o status de saÃ­da. Isso impede o cÃ¡lculo real do 1Âº Desloc. e indica que o deslocamento pode ter ocorrido sem lanÃ§amento no sistema.`;
            break;
          case 'triagem_alto': {
            const fmtTsDesloc = (raw: string | undefined): string => {
              if (!raw) return 'â€”';
              const m = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
              return m ? m[1] : raw;
            };
            const valDesloc = ev.triagem_min ?? 0;
            const limitDesloc = getTriagemLimit();
            const pctDesloc = Math.round((valDesloc - limitDesloc) / limitDesloc * 100);
            let trTextDesloc = `${nfBr(valDesloc)} min entre o 1Âº Despacho (${fmtTsDesloc(ev.hora_despacho_anterior)}) e o Despacho (${fmtTsDesloc(ev.despachada)}) â€” ${pctDesloc}% acima do limite (${limitDesloc} min)`;
            if (ev.triagem_global_avg_min && ev.triagem_global_avg_min > 0) {
              const pctAvgD = Math.round((valDesloc - ev.triagem_global_avg_min) / ev.triagem_global_avg_min * 100);
              const dirD = pctAvgD >= 0 ? 'acima' : 'abaixo';
              trTextDesloc += ` | ${Math.abs(pctAvgD)}% ${dirD} da mÃ©dia geral (${nfBr(ev.triagem_global_avg_min)} min)`;
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
            alertTexts[flag] = `${nfBr(ev.retorno_base_min)} min â€” mais de 1,5Ã— a meta de ${metaTarget} min. Pode indicar trajeto muito longo atÃ© a base, regiÃ£o de atuaÃ§Ã£o distante, ou permanÃªncia no campo sem atendimento apÃ³s a Ãºltima OS. Retornos longos sÃ£o descontados no cÃ¡lculo de UtilizaÃ§Ã£o, prejudicando a nota da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'retorno_alto':
            alertTexts[flag] = `${nfBr(ev.retorno_base_min)} min â€” acima da meta de ${metaTarget} min (mÃ©dia da equipe: ${nfBr(ev.team_avg_retorno_min)} min, mÃ©dia geral: ${nfBr(ev.global_avg_retorno_min)} min). Esse tempo Ã© descontado no cÃ¡lculo de UtilizaÃ§Ã£o, impactando diretamente na nota da equipe.${getAvgText(team, globalAverages, 'retorno')}`;
            break;
          case 'retorno_divergente':
            alertTexts[flag] = `AtenÃ§Ã£o: o tempo real de retorno (apÃ³s o fim do intervalo) foi de ${nfBr(ev.true_retorno_min ?? 0)} min, mas o sistema apontou ${nfBr(ev.retorno_base_min)} min (desde a Ãºltima Liberada).`;
            break;
        }
      }
      return { ...ev, alertTexts };
    });
  }


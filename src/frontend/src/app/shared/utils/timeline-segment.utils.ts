/**
 * Utilitário compartilhado de construção de segmentos de timeline.
 * Fonte única de verdade — consumido pelo componente web e pelo serviço de PDF.
 * Qualquer mudança de regra de negócio deve ser feita APENAS aqui.
 */

export interface TimelineSegment {
  label: string;
  durationMin: number;
  /** Quando definido, sobrescreve a exibição de duração (ex.: diff assinado do Log In). */
  overrideDuration?: string;
  excessMin?: number;
  /** Informação adicional exibida após " | " dentro do mesmo segmento (ex.: "1º Desloc.: 93min"). */
  subtitle?: string;
  isInterval: boolean;
  startTime: string;
  endTime: string;
  startLabel: string;
  endLabel: string;
  flags: string[];
}

/** Parseia string 'DD/MM/YYYY HH:MM:SS' ou variações → timestamp ms. */
export function parseDt(dtStr: string): number {
  if (!dtStr) return 0;
  const match = dtStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    const [, dd, mm, yyyy, hh, min, sec] = match;
    const year = yyyy ? (yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy)) : 2026;
    const date = new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec || '0'));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  const fallback = new Date(dtStr);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
}

/** Extrai 'HH:MM DD/MM' de uma string de data/hora. */
export function extractTime(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(' ');
  if (parts.length < 2) return '';
  const tp = parts[1].split(':');
  const dp = parts[0].split('/');
  if (tp.length >= 2 && dp.length >= 2) return `${tp[0]}:${tp[1]} ${dp[0]}/${dp[1]}`;
  return '';
}

/** Escala logarítmica (mesma fórmula do flex-grow da web e do PDF). */
export function tlFlexGrow(durationMin: number): number {
  return durationMin <= 8 ? 8 : Math.sqrt(durationMin) * 3;
}

/** Constrói e mescla os segmentos de timeline a partir de um evento de evidência. */
export function buildTimelineSegments(ev: any, hidePartida: boolean, trimToACaminho = false): TimelineSegment[] {
  if (!ev) return [];

  const logIn = ev.log_in || ev.log_in_corrigido;
  const despachada = ev.despachada || ev.hora_primeiro_despacho;
  const aCaminho = ev.a_caminho || ev.hora_primeiro_deslocamento;

  const prevLibTs = ev.prev_liberada ? parseDt(ev.prev_liberada) : 0;
  const despTs = despachada ? parseDt(despachada) : 0;
  const despAfterPrevLib = prevLibTs > 0 && despTs > 0 && prevLibTs > despTs;

  const pts: { key: string; ts: number; label: string; raw: string }[] = [];
  const addPt = (key: string, val: string | undefined, label: string) => {
    if (val) { const ts = parseDt(val); if (ts > 0) pts.push({ key, ts, label, raw: val }); }
  };

  if (ev.prev_liberada) {
    addPt('prev_liberada', ev.prev_liberada, 'Lib. Anterior');
  } else {
    addPt('inicio_calendario', ev.inicio_calendario, 'Início Cal.');
    addPt('log_in', logIn, 'Log In');
  }
  if (!despAfterPrevLib) {
    if (ev.nr_ordem_despacho_anterior && ev.hora_despacho_anterior) {
      addPt('hora_despacho_anterior', ev.hora_despacho_anterior, '1º Desp.');
    }
    const despLabel = (ev.nr_ordem_despacho_anterior && ev.nr_ordem) ? '2º Desp.' : 'Despachada';
    addPt('despachada', despachada, despLabel);
  }
  addPt('a_caminho', aCaminho, 'A Caminho');
  addPt('no_local', ev.no_local, 'No Local');
  addPt('liberada', ev.liberada, 'Liberada');
  addPt('inicio_intervalo', ev.inicio_intervalo, 'Início Intervalo');
  addPt('fim_intervalo', ev.fim_intervalo, 'Fim Intervalo');
  const fimJornada = ev.retorno_excedente_details || ev.sem_os_details?.find((s: any) => s.type === 'fim_jornada');
  const logOffVal = ev.log_off || ev.log_off_corrigido || fimJornada?.to;
  if (logOffVal) addPt('log_off', logOffVal, 'Log Off');

  const seen = new Set<string>();
  const uniquePts = pts.filter(p => seen.has(p.key) ? false : (seen.add(p.key), true));
  uniquePts.sort((a, b) => a.ts - b.ts);

  if (trimToACaminho) {
    const aCaminhoPt = uniquePts.find(p => p.key === 'a_caminho');
    if (aCaminhoPt) {
      const idx = uniquePts.indexOf(aCaminhoPt);
      uniquePts.splice(0, idx);
    }
    // Also trim everything after 'liberada' so intervals/log-off don't appear
    const liberadaIdx = uniquePts.findIndex(p => p.key === 'liberada');
    if (liberadaIdx !== -1) {
      uniquePts.splice(liberadaIdx + 1);
    }
  }

  const isInInterval = (tsMain: number): boolean => {
    const iS = uniquePts.find(p => p.key === 'inicio_intervalo');
    const iE = uniquePts.find(p => p.key === 'fim_intervalo');
    return iS && iE ? tsMain >= iS.ts && tsMain < iE.ts : false;
  };

  const labelMap: Record<string, string> = {
    'inicio_calendario_log_in': 'Log In',
    'log_in_inicio_calendario': 'Log In',
    'inicio_calendario_despachada': '1º Desp.',
    'log_in_despachada': '1º Desp.',
    'hora_despacho_anterior_despachada': '2º Desp.',
    'prev_liberada_despachada': 'Sem OS',
    'liberada_despachada': 'Sem OS',
    'prev_liberada_inicio_intervalo': 'Desl. Intervalo | Sem OS',
    'liberada_inicio_intervalo': 'Desl. Intervalo | Sem OS',
    'despachada_inicio_intervalo': 'Desl. Intervalo | Sem OS',
    'no_local_inicio_intervalo': 'Desl. Intervalo | Sem OS',
    'fim_intervalo_despachada': 'Sem OS',
    'liberada_log_off': 'Retorno Vazio',
    'fim_intervalo_log_off': 'Retorno Vazio',
    'despachada_a_caminho': 'Partida',
    'fim_intervalo_a_caminho': 'Partida',
    'prev_liberada_a_caminho': 'Partida',
    'liberada_a_caminho': 'Partida',
    'a_caminho_no_local': 'Deslocamento p/OS',
    'no_local_liberada': 'Reparo',
    'fim_intervalo_liberada': 'Reparo',
  };

  const rawSegs: TimelineSegment[] = [];
  for (let i = 0; i < uniquePts.length - 1; i++) {
    const p1 = uniquePts[i], p2 = uniquePts[i + 1];
    let durationMin = Math.round((p2.ts - p1.ts) / 60000);
    if (durationMin < 0) continue;

    const isInterval = isInInterval(p1.ts + (p2.ts - p1.ts) / 2);
    let label = isInterval ? 'Intervalo' : (labelMap[`${p1.key}_${p2.key}`] ?? `${p1.label} → ${p2.label}`);
    
    // Anexa o número da OS no segmento se for 1º ou 2º Despacho
    if (label === '1º Desp.' || (p2.key === 'hora_despacho_anterior' && ev.nr_ordem_despacho_anterior)) {
      const nr = p2.key === 'hora_despacho_anterior' ? ev.nr_ordem_despacho_anterior : ev.nr_ordem;
      label = `1º Desp. ${nr || ''}`.trim();
    } else if (label === '2º Desp.') {
      label = `2º Desp. ${ev.nr_ordem || ''}`.trim();
    }

    const flags: string[] = [];
    let overrideDuration: string | undefined;
    let subtitle: string | undefined;
    let excessMinVal: number | undefined;

    if (label === 'Reparo') {
      if (p1.key === 'no_local' && p2.key === 'liberada' && ev.tr_ordem_min !== undefined) {
        durationMin = Math.max(ev.tr_ordem_min, 1);
      }
      if (ev.flags?.includes('tr_excede_hd')) flags.push('TR > 20% HD e M300');
    } else if (label === 'Deslocamento p/OS' && ev.tl_ordem_min !== undefined) {
      durationMin = Math.max(ev.tl_ordem_min, 1);
      if (ev.flags?.includes('tl_excede_hd')) flags.push('Temp. Deslocamento Alto');
    } else if (label === 'Partida') {
      if (ev.primeiro_desloc_min !== undefined && ev.temp_prep_os_min === undefined) {
        label = '1º Desloc.';
        durationMin = Math.max(ev.primeiro_desloc_min, 1);
        const realDuration = Math.round((p2.ts - p1.ts) / 60000);
        subtitle = `Partida pós Desp.: ${realDuration}m`;
        if (ev.flags?.includes('desloc_lento') || ev.flags?.includes('desloc_muito_lento')) {
          flags.push('1º Desloc. ≥25min');
        }
        if (ev.flags?.includes('login_atrasado')) flags.push('Atraso no Log In');
        if (ev.flags?.includes('despacho_tardio')) flags.push('Despacho Tardio');
      } else if (ev.temp_prep_os_min !== undefined) {
        durationMin = Math.max(ev.temp_prep_os_min, 1);
        if (ev.flags?.includes('temp_prep_alto')) flags.push('Temp. Partida ≥10min');
      }
    } else if (label === 'Sem OS' && ev.entre_ordens_min !== undefined && ev.entre_ordens_min > 0) {
      durationMin = Math.max(ev.entre_ordens_min, 1);
      if (ev.flags?.includes('entre_ordens_alto')) flags.push('Sem OS ≥15min');
    } else if (label === 'Log In') {
      if (p1.key === 'inicio_calendario') {
        const hdMin = ev.hd_total_min;
        if (hdMin && durationMin > hdMin * 0.1 && durationMin >= 10) {
          flags.push('Atraso Inicial');
        }
        if (ev.log_in_diff_min !== undefined && ev.log_in_diff_min !== durationMin) {
          overrideDuration = `${durationMin}min (diff: ${ev.log_in_diff_min > 0 ? '+' : ''}${ev.log_in_diff_min}m)`;
        }
      }
      const icalPt = uniquePts.find(p => p.key === 'inicio_calendario');
      const linPt  = uniquePts.find(p => p.key === 'log_in');
      if (icalPt && linPt) {
        if (ev.flags?.includes('calendario_errado')) {
          flags.push('Calendário errado');
        } else if (ev.flags?.includes('login_atrasado')) {
          flags.push('login_atrasado');
        }
      }
    } else if (label.startsWith('1º Desp.') && p2.key === 'hora_despacho_anterior') {
      const icalPt2 = uniquePts.find(p => p.key === 'inicio_calendario');
      if (icalPt2 && p2.ts > icalPt2.ts) {
        durationMin = Math.max(Math.round((p2.ts - icalPt2.ts) / 60000), 1);
      }
      if (ev.flags?.includes('triagem_alto')) {
        flags.push('Desp. Prioritário excessivo');
        const g = ev.desp_global_avg_min;
        if (g !== undefined && g > 0 && durationMin > g) flags.push('acima_media');
      }
    } else if (label.startsWith('2º Desp.') && p1.key === 'hora_despacho_anterior') {
      const dMin = Math.round((p2.ts - p1.ts) / 60000);
      if (ev.flags?.includes('triagem_alto')) {
        let fText = `2º Desp.: ${dMin} min entre o Início da Jornada e o Despacho`;
        const globalAvg = ev.triagem_global_avg_min;
        if (globalAvg && Number.isFinite(globalAvg) && globalAvg > 0) {
          const pctGlobal = Math.round(((dMin - globalAvg) / globalAvg) * 100);
          if (pctGlobal > 0) fText += ` | ${pctGlobal}% acima da média geral (${Math.round(globalAvg)} min)`;
        }
        flags.push(fText + '.');
      }
    } else if (label.startsWith('1º Desp.') || ['Sem OS', 'Desl. Intervalo | Sem OS', 'Retorno Vazio', 'Retorno a Base'].includes(label)) {
      let md: any = null;
      if (label === 'Retorno Vazio' || label === 'Retorno a Base') {
        const r = ev.retorno_excedente_details || ev.sem_os_details?.find((s: any) => s.type === 'fim_jornada');
        if (r && r.to === p2.raw) md = r;
      } else if (ev.sem_os_details) {
        const detType: Record<string, string> = { 'Desl. Intervalo | Sem OS': 'intervalo_deslocamento', 'Sem OS': 'entre_ordens' };
        md = ev.sem_os_details.find((s: any) => {
          const is1st = label.startsWith('1º Desp.');
          const lType = is1st ? 'inicio_jornada' : detType[label];
          if (s.type !== lType) return false;
          if (is1st) return s.to === p2.raw;
          return s.from === p1.raw && s.to === p2.raw;
        });
      }
      if ((label === 'Retorno Vazio' || label === 'Retorno a Base') && md) durationMin = Math.max(md.min, 1);
      
      if (label.startsWith('1º Desp.')) {
        const icalPt = uniquePts.find(p => p.key === 'inicio_calendario');
        if (icalPt && p2.ts > icalPt.ts) {
          const totalDuration = Math.max(Math.round((p2.ts - icalPt.ts) / 60000), 1);
          const postLoginDuration = Math.round((p2.ts - p1.ts) / 60000);
          durationMin = totalDuration;
          subtitle = `1º Desp. pós login: ${postLoginDuration}m`;
        } else if (md) {
          durationMin = Math.max(md.min, 1);
        }
      }

      if (isInterval) {
        const libTs = ev.liberada ? parseDt(ev.liberada) : 0;
        const isEndInterval = Boolean(
          ev.flags?.includes('intervalo_por_ultimo') ||
          (libTs > 0 && p1.ts >= libTs) ||
          (p2.key === 'fim_intervalo' && (
            uniquePts[i + 2]?.key === 'log_off' ||
            ev.retorno_excedente_details?.from === ev.fim_intervalo ||
            (i + 2 >= uniquePts.length)
          ))
        );
        if (isEndInterval) {
          label = 'Intervalo por último';
          if (!flags.includes('Intervalo por último')) {
            flags.push('Intervalo por último');
          }
        }
      }

      if (md) {
        if (label === 'Retorno Vazio' || label === 'Retorno a Base') {
          if (md.retorno_base_discounted != null) {
            label = 'Retorno a base';
          }
          const excessM: number | undefined = md.excess_min ?? ev.retorno_excedente_min ?? (ev.flags?.includes('retorno_excedente') ? 37 : undefined);
          if (excessM != null && excessM > 0) {
            excessMinVal = excessM;
            subtitle = `Retorno Excedente: ${Math.round(excessM)}min`;
            if (!flags.includes('acima_media')) flags.push('acima_media');
          }
        } else {
          const g: number | undefined = md.global_avg_min;
          if (md.above_avg_pct > 0) {
            flags.push(`${label} elevado: ${md.min} min | ${md.above_avg_pct}% acima da média geral (${g} min).`);
          }
        }
      } else if (label === 'Retorno Vazio' || label === 'Retorno a Base') {
        const excessM: number | undefined = ev.retorno_excedente_min ?? (ev.flags?.includes('retorno_excedente') ? 37 : undefined);
        if (excessM != null && excessM > 0) {
          excessMinVal = excessM;
          subtitle = `Retorno Excedente: ${Math.round(excessM)}min`;
          if (!flags.includes('acima_media')) flags.push('acima_media');
        }
      }

      if (label === 'Sem OS' && ev.flags?.includes('sem_os_alto')) {
        flags.push('Sem Ordem excessivo');
      } else if (label === 'Desl. Intervalo | Sem OS' && ev.flags?.includes('desloc_intervalo_alto')) {
        flags.push('Desloc. Int. excessivo');
      } else if (label.startsWith('1º Desp.') && ev.flags?.includes('inicio_jornada_alto')) {
        flags.push('1º Desp. excessivo');
      }
    }

    rawSegs.push({
      label, durationMin, overrideDuration, subtitle, isInterval,
      startTime: extractTime(p1.raw), endTime: extractTime(p2.raw),
      startLabel: p1.label, endLabel: p2.label, flags, excessMin: excessMinVal,
    });
  }

  const filtered = hidePartida ? rawSegs.filter(s => s.label !== 'Partida') : rawSegs;
  const merged: TimelineSegment[] = [];
  if (filtered.length > 0) {
    let cur = { ...filtered[0] };
    for (let i = 1; i < filtered.length; i++) {
      const s = filtered[i];
      if (s.label === cur.label && s.isInterval === cur.isInterval && JSON.stringify(s.flags) === JSON.stringify(cur.flags)) {
        cur = { ...cur, durationMin: cur.durationMin + s.durationMin, endTime: s.endTime, endLabel: s.endLabel };
      } else {
        merged.push(cur);
        cur = { ...s };
      }
    }
    merged.push(cur);
  }
  return merged;
}

/**
 * Determina a cor da OS com base em suas flags e segmentos de timeline.
 * Retorna 'red' (flags ativas), 'yellow' (mais segmentos ociosos que produtivos) ou 'green'.
 */
export function getEvidenceColor(ev: any): 'red' | 'yellow' | 'green' {
  if (ev.flags && ev.flags.length > 0) return 'red';

  const segments = buildTimelineSegments(ev, false, false);
  let yellowCount = 0;
  let greenCount = 0;
  
  const idleLabels = new Set(['Sem OS', 'Desl. Intervalo | Sem OS', 'Partida', '1º Desloc.', 'Antes Log Off']);

  for (const seg of segments) {
    if (seg.isInterval) {
      greenCount++;
    } else {
      const isIdle = idleLabels.has(seg.label) || seg.label.startsWith('1º Desp.') || seg.label.startsWith('2º Desp.');
      if (isIdle) {
        yellowCount++;
      } else {
        greenCount++;
      }
    }
  }

  return yellowCount > greenCount ? 'yellow' : 'green';
}

export interface DashboardChip {
  label: string;
  value: string;
}

export interface DashboardAlert {
  title: string;
  bodyHtml: string;
  isWarn?: boolean;
}

/**
 * Returns a generic set of chips for a given KPI analysis object.
 * Format numerical values properly (decimals, percentages, etc).
 */
export function getDashboardChips(kpi: string, analysis: any): DashboardChip[] {
  const chips: DashboardChip[] = [];
  const add = (label: string, value: any) => chips.push({ label, value: String(value) });
  const fmtMin = (val: number | undefined | null) => (val != null ? Number(val).toFixed(0) : '0');
  const fmtDec = (val: number | undefined | null) => (val != null ? Number(val).toFixed(1) : '0.0');

  switch (kpi) {
    case 'OS Dia':
      if (analysis.osDiaValue !== undefined) add('OS/Dia', fmtDec(analysis.osDiaValue));
      if (analysis.totalOrders) add('Total OS', `${analysis.totalOrders} em ${analysis.totalJornadas} dias`);
      if (analysis.idleDays > 0) add('Ocioso', `${fmtMin(analysis.idleAvgMin * analysis.idleDays)} min - ${analysis.idleDays} dias`);
      if (analysis.summary?.countTrExceeds > 0) add('Temp. Reparo>20% HD', analysis.summary.countTrExceeds);
      if (analysis.summary?.countTlExceeds > 0) add('Temp. Desloc.', analysis.summary.countTlExceeds);
      if (analysis.summary?.countTempPrepAlto > 0) add('Temp. Partida≥10min', analysis.summary.countTempPrepAlto);
      if (analysis.summary?.countSemOsAlto > 0) add('SemOS≥10min', analysis.summary.countSemOsAlto);
      if (analysis.avgTempoPadraoMin > 0) add('T. Padrão Médio', `${fmtMin(analysis.avgTempoPadraoMin)} min`);
      if (analysis.summary?.countDeslocamentoCurto > 0) add('Desloc. Curto', analysis.summary.countDeslocamentoCurto);
      break;

    case 'Eficiência':
      add('Utilização', `${analysis.utilizacaoValue}%`);
      add('Meta', `${analysis.metaTarget}%`);
      if (analysis.summary?.countTempPrepAlto > 0) add('Temp. Partida≥10min', analysis.summary.countTempPrepAlto);
      if (analysis.summary?.countSemOsAlto > 0) add('SemOS≥10min', analysis.summary.countSemOsAlto);
      if (analysis.jornadasAbaixoMeta > 0) add('Abaixo da meta', `${analysis.jornadasAbaixoMeta} dias`);
      add('Total OS', `${analysis.totalOrders} em ${analysis.totalJornadas} dias`);
      add('Ocioso', `${fmtMin(analysis.idleAvgMin * analysis.idleDays)} min - ${analysis.idleDays} dias`);
      break;

    case 'TME Improdutivo':
      add('TME IMP', `${fmtDec(analysis.tmeImpValue)} min`);
      add('Meta', `${analysis.metaTarget} min`);
      add('Média equipe', `${fmtDec(analysis.avgTmeImpMin)} min`);
      add('Média global', `${fmtDec(analysis.globalAvgTmeImpMin)} min`);
      add('Total OS', analysis.totalOrders);
      if (analysis.summary?.countTmeMuitoAlto > 0) add('TME=1.5×avg', analysis.summary.countTmeMuitoAlto);
      if (analysis.summary?.countSemDeslocamento > 0) add('Sem desloc.', analysis.summary.countSemDeslocamento);
      break;

    case '1º Login':
      add('1º Login', `${fmtDec(analysis.primeiroLoginValue)} min`);
      add('Meta', `${analysis.metaTarget} min`);
      add('Média equipe', `${fmtDec(analysis.avgLoginMin)} min`);
      add('Média global', `${fmtDec(analysis.globalAvgLoginMin)} min`);
      add('Dias com atraso', `${analysis.diasAcimaMetaCount}/${analysis.totalDays}`);
      if (analysis.summary?.countLoginMuitoTardio > 0) add('Login>16min', analysis.summary.countLoginMuitoTardio);
      break;

    case '1º Desloc.':
      add('1º Desloc.', `${fmtDec(analysis.primeiroDeslocValue)} min`);
      add('Meta', `${analysis.metaTarget} min`);
      add('Média equipe', `${fmtDec(analysis.avgDeslocMin)} min`);
      add('Média global', `${fmtDec(analysis.globalAvgDeslocMin)} min`);
      add('Dias c/ atraso', `${analysis.diasAcimaMetaCount}/${analysis.totalDays}`);
      if (analysis.summary?.countDeslocMuitoLento > 0) add('Desloc.>37min', analysis.summary.countDeslocMuitoLento);
      if (analysis.summary?.countSemDeslocRegistrado > 0) add('Sem registro', analysis.summary.countSemDeslocRegistrado);
      if (analysis.summary?.countDespachoTardio > 0) add('Despacho tardio', analysis.summary.countDespachoTardio);
      if (analysis.summary?.countLoginAtrasado > 0) add('Log In atrasado', analysis.summary.countLoginAtrasado);
      break;

    case 'Retorno Base':
      add('Retorno Base', `${fmtDec(analysis.retornoBaseValue)} min`);
      add('Meta', `${analysis.metaTarget} min`);
      add('Média equipe', `${fmtDec(analysis.avgRetornoMin)} min`);
      add('Média global', `${fmtDec(analysis.globalAvgRetornoMin)} min`);
      add('Dias c/ atraso', `${analysis.diasAcimaMetaCount}/${analysis.totalDays}`);
      if (analysis.summary?.countRetornoMuitoAlto > 0) add('Retorno>60min', analysis.summary.countRetornoMuitoAlto);
      break;
  }
  return chips;
}

/**
 * Returns a generic set of alerts for a given KPI evidence object.
 * Reads the 'flags' array and the 'alertTexts' provided by the backend.
 */
export function getDashboardAlerts(kpi: string, ev: any): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const alertTexts = ev.alertTexts || {};

  const addFlag = (flag: string, title: string, isWarn = false) => {
    if (ev.flags?.includes(flag) && alertTexts[flag]) {
      alerts.push({ title, bodyHtml: alertTexts[flag], isWarn });
    }
  };

  switch (kpi) {
    case 'OS Dia':
      addFlag('tr_excede_hd', 'Tempo de Reparo alto:');
      addFlag('tl_excede_hd', 'Tempo de Deslocamento alto:');
      addFlag('temp_prep_alto', 'Tempo de Partida elevado:');
      addFlag('sem_os_alto', 'Tempo Sem OS elevado:');
      addFlag('desloc_curto', 'Deslocamento Curto (<5min):', true);
      break;
    
    case 'Eficiência':
      addFlag('baixa_eficiencia', 'Baixa Eficiência:');
      break;
    
    case 'TME Improdutivo':
      addFlag('tme_muito_alto', 'TME Muito Alto:');
      addFlag('sem_desloc_tme', 'Sem deslocamento registrado:');
      addFlag('entre_os_alto', 'Tempo Entre OS elevado:');
      addFlag('desloc_intervalo_alto', 'Desloc. Intervalo elevado:');
      addFlag('retorno_vazio_alto', 'Retorno Vazio elevado:');
      break;
    
    case '1º Login':
      addFlag('login_muito_tardio', 'Log In muito tardio:');
      break;

    case '1º Desloc.':
      if (ev.flags?.includes('despacho_tardio')) {
        const title = ev.flags.includes('login_atrasado') ? 'Despacho tardio após login atrasado:' : 'Despacho tardio:';
        alerts.push({ title, bodyHtml: alertTexts['despacho_tardio'] });
      }
      addFlag('login_atrasado', 'Log In atrasado:');
      
      if (ev.flags?.includes('desloc_muito_lento')) {
        addFlag('desloc_muito_lento', '1º Desloc.:');
      } else if (ev.flags?.includes('desloc_lento')) {
        addFlag('desloc_lento', '1º Desloc.:');
      }
      
      addFlag('triagem_alto', '2º Desp.:');
      addFlag('sem_desloc_registrado', 'Sem deslocamento registrado:');

      // Special non-flag item for 1º Desloc
      if (ev.nr_ordem_despacho_anterior) {
        const horaFmt = (ev.hora_despacho_anterior || '').replace(/^(\d{2}\/\d{2})\/\d{4}\s+(\d{2}:\d{2}).*$/, '$1 $2');
        alerts.push({
          title: 'Despacho anterior da 1ªOS:',
          bodyHtml: `a OS <strong>${ev.nr_ordem_despacho_anterior}</strong>${horaFmt ? ' foi despachada em ' + horaFmt : ''} antes do deslocamento da 1ª OS desta equipe, provavelmente por motivo de prioridade, dessa forma o despacho da 1ªOS pode ficar elevado.`,
          isWarn: true
        });
      }
      break;
    
    case 'Retorno Base':
      addFlag('retorno_muito_alto', 'Retorno à Base muito alto:');
      break;
  }

  return alerts;
}

import type {
  TeamMetricSummary,
  KpiInsight,
  DeviationByTeam,
  OsDiaTeamAnalysis,
  UtilizacaoTeamAnalysis,
  EficienciaTeamAnalysis,
  TmeImpTeamAnalysis,
  PrimeiroLoginTeamAnalysis,
  PrimeiroDeslocTeamAnalysis,
  RetornoBaseTeamAnalysis,
  TeamActionPlan
} from '../types.js';
import { normalizeToken, round2 } from '../csv-utils.js';

export function buildActionPlans(
  teamMetrics: TeamMetricSummary[],
  kpis: KpiInsight[],
  teamDeviations: DeviationByTeam[],
  osDiaAnalysis: OsDiaTeamAnalysis[] = [],
  utilizacaoAnalysis: UtilizacaoTeamAnalysis[] = [],
  eficienciaAnalysis: EficienciaTeamAnalysis[] = [],
  tmeImpAnalysis: TmeImpTeamAnalysis[] = [],
  primeiroLoginAnalysis: PrimeiroLoginTeamAnalysis[] = [],
  primeiroDeslocAnalysis: PrimeiroDeslocTeamAnalysis[] = [],
  retornoBaseAnalysis: RetornoBaseTeamAnalysis[] = [],
): TeamActionPlan[] {
  const deviationMap = new Map(teamDeviations.map((item) => [item.team, item.deviations]));
  const osDiaMap = new Map(osDiaAnalysis.map((a) => [a.team, a]));
  const utilizacaoMap = new Map(utilizacaoAnalysis.map((a) => [a.team, a]));
  const eficienciaMap = new Map(
    eficienciaAnalysis
      .filter((a) => a.analysisType === 'underperformer')
      .map((a) => [a.team, a]),
  );
  const tmeImpMap = new Map(tmeImpAnalysis.map((a) => [a.team, a]));
  const loginMap = new Map(primeiroLoginAnalysis.map((a) => [a.team, a]));
  const deslocMap = new Map(primeiroDeslocAnalysis.map((a) => [a.team, a]));
  const retornoMap = new Map(retornoBaseAnalysis.map((a) => [a.team, a]));

  const opportunityTeams = new Set<string>();
  for (const insight of kpis) {
    for (const t of insight.opportunityTeams) {
      opportunityTeams.add(t.team);
    }
  }

  const plans: TeamActionPlan[] = [];

  for (const tm of teamMetrics) {
    if (!opportunityTeams.has(tm.team)) {
      continue;
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    const deviations = deviationMap.get(tm.team) ?? [];
    const osDia = osDiaMap.get(tm.team);
    const util = utilizacaoMap.get(tm.team);
    const efic = eficienciaMap.get(tm.team);

    // Determine which KPI categories this team is failing
    const teamInOsDia = kpis.find((k) => k.kpi === 'OS Dia')?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInUtil = kpis.find((k) => normalizeToken(k.kpi) === normalizeToken('Utilização'))?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInEfic = kpis.find((k) => normalizeToken(k.kpi) === normalizeToken('Eficiência'))?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInTme = kpis.find((k) => k.kpi === 'TME IMP')?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInLogin = kpis.find((k) => k.kpi === '1º Login')?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInDesloc = kpis.find((k) => k.kpi === '1º Desloc.')?.opportunityTeams.some((t) => t.team === tm.team) ?? false;
    const teamInRetorno = kpis.find((k) => k.kpi === 'Retorno Base')?.opportunityTeams.some((t) => t.team === tm.team) ?? false;

    // Helper: KPI impact label to append as context at the end of each issue
    const kpiCtx = (kpiName: string): string => ` → impacta ${kpiName} abaixo da meta.`;

    // ── OS Dia / Utilização — flag-first analysis ──────────────────────────
    if (teamInOsDia || teamInUtil) {
      const idleAnalysis = osDia ?? util;
      if (idleAnalysis) {
        type SharedEv = {
          flags: string[];
          nr_ordem?: string;
          prev_liberada?: string;
          temp_prep_os_min?: number;
          sem_os_details?: Array<{ type: string; min: number }>;
          sem_os_total_min?: number;
          tl_ordem_min: number;
          hd_pct_tr?: number;
          hd_total_min?: number;
          tr_ordem_min?: number;
          tempo_padrao_min?: number;
        };
        const orders = idleAnalysis.flaggedOrders as unknown as SharedEv[];
        const kpiLabel = teamInOsDia && teamInUtil ? 'OS Dia e Utilização' : teamInOsDia ? 'OS Dia' : 'Utilização';

        // TR and TL only affect OS Dia and Eficiência — Utilização is driven by idle time (TempPrep, SemOrdem)
        const trTlParts: string[] = [];
        if (teamInOsDia) trTlParts.push('OS Dia');
        if (teamInEfic) trTlParts.push('Eficiência');
        const kpiLabelTrTl = trTlParts.length > 0 ? trTlParts.join(' e ') : 'OS Dia';

        // Flag: TR>20%HD — OS com tempo de reparo acima de 20% da jornada
        const trExcede = orders.filter((o) => o.flags.includes('tr_excede_hd'));
        if (trExcede.length > 0) {
          const worst = trExcede.slice().sort((a, b) => (b.tr_ordem_min ?? 0) - (a.tr_ordem_min ?? 0))[0];
          issues.push(
            `Temp. Reparo>20%HD: ${trExcede.length} OS com tempo de reparo acima de 20% da jornada — caso crítico OS ${worst.nr_ordem ?? '—'}` +
            ` (${worst.tr_ordem_min ?? '?'} min, ${worst.hd_pct_tr ?? '?'}% da HD de ${worst.hd_total_min ?? '?'} min).` +
            kpiCtx(kpiLabelTrTl),
          );
          recommendations.push(
            `Temp. Reparo>20%HD — Comparar as OS mais longas com o Tempo Padrão M300` +
            (worst.tempo_padrao_min !== undefined ? ` (${worst.tempo_padrao_min} min cadastrado para essa classe/causa)` : ' (sem tempo padrão cadastrado para esse tipo — solicitar ao time de engenharia)') +
            `. Se o TR real superar o padrão de forma sistemática, levantar a causa raiz (complexidade, falta de material, erro de diagnóstico) e escalar para o supervisor.`,
          );
        }

        // Flag: TL>25%médG — OS com deslocamento acima de 25% da média global
        const tlExcede = orders.filter((o) => o.flags.includes('tl_excede_hd'));
        if (tlExcede.length > 0) {
          issues.push(
            `TL>25%médG: ${tlExcede.length} OS com tempo de deslocamento acima de 25% da média global — cada OS com TL longo retira tempo produtivo da jornada.` +
            kpiCtx(kpiLabelTrTl),
          );
          recommendations.push(
            `TL>25%médG — Avaliar com o planejamento a distribuição geográfica das ordens desta equipe; se o padrão for recorrente, identificar OS sistematicamente distantes e propor ajuste no roteiro de despacho.`,
          );
        }

        // Flag: login_atrasado
        const loginAtrasado = orders.filter((o) => o.flags.includes('login_atrasado' as any));
        if (loginAtrasado.length > 0) {
          issues.push(
            `Log In atrasado: ${loginAtrasado.length} OS/dias com acesso ao sistema registrado com atraso em relação ao Início Calendário da jornada.` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `Log In atrasado — O supervisor deve orientar a equipe a priorizar o Log In imediato no Início Calendário, antes mesmo de separar materiais na base. Atrasar o Log In oculta a disponibilidade da equipe, empurra o primeiro atendimento para mais tarde e camufla a ociosidade matinal real.`,
          );
        }

        // Flag: calendario_errado
        const calErrado = orders.filter((o) => o.flags.includes('calendario_errado' as any));
        if (calErrado.length > 0) {
          issues.push(
            `Calendário incorreto: ${calErrado.length} OS/dias com acesso ao sistema muito antes do Início Calendário estipulado.` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `Calendário incorreto — Verificar se a equipe está chegando mais cedo ou se o Início Calendário está defasado no sistema. O supervisor deve solicitar ao backoffice o ajuste da parametrização do turno no M300 para refletir a realidade operacional.`,
          );
        }

        // Flag: primeiro_desloc_alto
        const primDeslocAlto = orders.filter((o) => o.flags.includes('primeiro_desloc_alto' as any));
        if (primDeslocAlto.length > 0) {
          issues.push(
            `1º Deslocamento lento: ${primDeslocAlto.length} OS/dias com demora elevada desde o Início Calendário (ou Log In) até acionar o primeiro "A Caminho".` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `1º Deslocamento lento — Demora crônica no primeiro 'A Caminho' indica retenção excessiva na base (reuniões longas, organização de material). O supervisor deve reestruturar a rotina matinal para garantir que o deslocamento para a primeira OS não seja sacrificado, evitando tempo ocioso logo no início do dia.`,
          );
        }

        // Flag: TempPrep≥10min — demora entre despacho e saída
        const tempPrepOrders = orders.filter((o) => o.flags.includes('temp_prep_alto'));
        if (tempPrepOrders.length > 0) {
          const avgTp = round2(tempPrepOrders.reduce((s, o) => s + (o.temp_prep_os_min ?? 0), 0) / tempPrepOrders.length);
          issues.push(
            `Temp. Partida elevado: ${tempPrepOrders.length} OS com demora na saída após receber o despacho (média de ${avgTp} min aguardando para acionar "A Caminho").` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `Temp. Partida elevado — O supervisor deve investigar por que a equipe está retida após o despacho. Orientar que ao receber a ordem, o status "A Caminho" deve ser acionado assim que o veículo entrar em movimento. Omissão ou esquecimento gera ociosidade forçada nos indicadores.`,
          );
        }

        // Flag: SemOrdem≥10min — intervalos sem atendimento
        if (idleAnalysis.summary.countSemOsAlto > 0) {
          const semOsOrders = orders.filter((o) => o.flags.includes('sem_os_alto'));
          const avgMin = semOsOrders.length > 0
            ? round2(semOsOrders.reduce((s, o) => s + (o.sem_os_total_min ?? 0), 0) / semOsOrders.length)
            : round2(idleAnalysis.semOrdemTotalMin);

          // Dynamic from_label extraction
          const fromLabels = new Set<string>();
          semOsOrders.forEach((o) => {
            o.sem_os_details?.forEach((d) => {
              if ((d as any).from_label) fromLabels.add((d as any).from_label);
              else if (d.type === 'inicio_jornada') fromLabels.add('Início Cal.');
              else if (d.type === 'entre_ordens') fromLabels.add('Lib. Anterior');
            });
          });
          const labelsArray = Array.from(fromLabels);
          const semOsCtx = labelsArray.length > 0 ? `frequentemente após: ${labelsArray.join(', ')}` : `ocasionando vácuos na jornada`;

          issues.push(
            `SemOrdem≥10min (Espera Passiva): ${idleAnalysis.summary.countSemOsAlto} ocorrências com tempo ocioso sem OS na tela acima de 10 min (média ${avgMin} min — ${semOsCtx}).` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `SemOrdem≥10min — O supervisor deve cobrar a equipe para comunicar a central imediatamente após a liberação da ordem anterior, exigindo o próximo despacho. Uma espera prolongada após "${labelsArray[0] ?? 'a última ação'}" indica falta de proatividade do técnico ou gargalo na distribuição da central.`,
          );

          // Intervalo de almoço suspeito
          const intervaloDesl = semOsOrders.filter((o) => o.sem_os_details?.some((d) => d.type === 'intervalo_deslocamento'));
          if (intervaloDesl.length > 0) {
            const avgItvMin = round2(intervaloDesl.reduce((s, o) => {
              const d = o.sem_os_details?.find((x) => x.type === 'intervalo_deslocamento');
              return s + (d?.min ?? 0);
            }, 0) / intervaloDesl.length);
            issues.push(
              `Desl. longo pré-intervalo: ${intervaloDesl.length} OS com deslocamento médio de ${avgItvMin} min antes da pausa de almoço — possível abandono de setor para almoçar na base ou residência.`,
            );
            recommendations.push(
              `Desl. longo pré-intervalo — O supervisor deve orientar a equipe a realizar a pausa para o almoço nas imediações do último ponto de atendimento. Deslocamentos longos e não produtivos antes do intervalo geram ociosidade severa e consumo desnecessário de combustível.`,
            );
          }
        }
        
        // Flag: intervalo_por_ultimo
        const intUltimo = orders.filter((o) => o.flags.includes('intervalo_por_ultimo' as any));
        if (intUltimo.length > 0) {
          issues.push(
            `Intervalo no fim da jornada: ${intUltimo.length} ocorrências com o intervalo de almoço lançado na última OS do dia.` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `Intervalo no fim da jornada — Registrar o intervalo no fim do expediente mascara a produtividade do meio do dia e pode gerar horas extras fantasmas. O supervisor deve exigir o lançamento da pausa em tempo real no aplicativo, no momento em que ela de fato ocorre.`,
          );
        }

        // Flag: antes_log_off_alto
        const antesLogOff = orders.filter((o) => o.flags.includes('antes_log_off_alto' as any));
        if (antesLogOff.length > 0) {
          issues.push(
            `Ociosidade antes do Log Off: ${antesLogOff.length} ocorrências com tempo ocioso elevado entre a última OS e o encerramento do aplicativo.` +
            kpiCtx('Utilização'),
          );
          recommendations.push(
            `Ociosidade antes do Log Off — Permanecer logado sem produzir no final do dia derruba a Utilização. O supervisor deve cobrar o encerramento da jornada (Log Off) no sistema imediatamente após o retorno à base e a devolução dos materiais.`,
          );
        }

        // Horas extras + ociosidade elevada
        const ia = idleAnalysis.idleAnalysis;
        if (ia && ia.horasExtras > 0 && ia.idlePct >= 15) {
          issues.push(
            `Horas extras com ociosidade elevada: ${round2(ia.horasExtras)} min/dia de horas extras registradas com ${ia.idlePct.toFixed(1)}% de ociosidade simultânea — possível janela improdutiva não declarada.`,
          );
          recommendations.push(
            `Horas extras + ociosidade — Revisar os apontamentos do período: identificar se as horas extras coincidem com SemOrdem ou TempPrep elevado; se sim, solicitar justificativa do técnico e corrigir os registros.`,
          );
        }
      }
    }

    // ── Eficiência — flag-first analysis ──────────────────────────────────
    const eficAny = eficienciaAnalysis.find((a) => a.team === tm.team);

    // Flag: TR muito baixo (any analysisType — indica erro de apontamento)
    const trBaixoOrders = eficAny?.flaggedOrders.filter((o) => o.flags.includes('tr_muito_baixo')) ?? [];
    if (trBaixoOrders.length > 0) {
      const globalAvgExec = eficAny!.globalAvgExecucaoMin;
      const globalAvgTl   = eficAny!.globalAvgDeslocamentoMin;
      const avgTl = round2(trBaixoOrders.reduce((s, o) => s + o.tl_ordem_min, 0) / trBaixoOrders.length);
      const tlAlto = globalAvgTl > 0 && avgTl > globalAvgTl;
      const worst = trBaixoOrders.slice().sort((a, b) => a.tr_ordem_min - b.tr_ordem_min)[0];
      issues.push(
        `Temp. Reparo muito baixo: ${trBaixoOrders.length} OS com tempo de execução muito abaixo da média global (${round2(globalAvgExec)} min) — caso crítico OS ${worst.nr_ordem} com ${worst.tr_ordem_min} min.` +
        (tlAlto ? ` TL médio dessas OS (${avgTl} min) acima da média global (${round2(globalAvgTl)} min) — reforça hipótese de erro de apontamento.` : '') +
        kpiCtx('Eficiência'),
      );
      recommendations.push(
        `Temp. Reparo muito baixo — Cobrar que cada etapa do atendimento seja registrada no momento exato: "A Caminho" ao sair, "No Local" ao chegar e liberação da OS ao concluir.` +
        (tlAlto ? ` O TL elevado dessas OS indica que "A Caminho" foi acionado tarde ou "No Local" foi acionado cedo, comprimindo artificialmente o TR registrado.` : ` Apontamentos fora de ordem ou com atraso distorcem o TR real e prejudicam o resultado de Eficiência de toda a equipe.`),
      );
    }

    if (teamInEfic && efic) {
      // Flag: TL muito curto — possível técnico já no local ou erro de A Caminho
      const deslocCurto = efic.flaggedOrders.filter((o) => o.flags.includes('deslocamento_curto'));
      if (deslocCurto.length > 0) {
        issues.push(
          `TL muito curto: ${deslocCurto.length} OS com deslocamento inferior a 25% da média global — possível atendimento sem deslocamento real ou erro de apontamento de "A Caminho".` +
          kpiCtx('Eficiência'),
        );
        recommendations.push(
          `TL muito curto — Verificar se o status "A Caminho" está sendo acionado no local correto e no momento certo; se o técnico já estava no local ao receber o despacho, orientar que isso deve ser comunicado à central para ajuste de roteiro.`,
        );
      }

      // Flag: Tempo Padrão ausente — OS executadas sem referência no M300
      const countTp = Math.max(
        efic.flaggedOrders.filter((o) => o.flags.includes('tempo_padrao_vazio')).length,
        efic.summary.countTempoPadraoVazio,
      );
      if (countTp > 0) {
        issues.push(
          `Tempo Padrão ausente: ${countTp} OS executadas sem Tempo Padrão cadastrado no M300 — eficiência contada como zero nessas OS independentemente do tempo real de execução.` +
          kpiCtx('Eficiência'),
        );
        recommendations.push(
          `Tempo Padrão ausente — Levantar as classes/causas dessas ${countTp} OS e solicitar formalmente ao time de engenharia o cadastro do Tempo Padrão correspondente. Enquanto não cadastrado, a equipe é penalizada mesmo executando o atendimento corretamente.`,
        );
      }

      // Flag: TR>20%HD (Eficiência — deslocamento muito curto somado ao TR longo)
      const trExcedeEfic = efic.flaggedOrders.filter((o) => o.flags.includes('tr_excede_hd'));
      if (trExcedeEfic.length > 0) {
        const hasDeslocCurto = trExcedeEfic.some((o) => o.tl_ordem_min < 5);
        issues.push(
          `Temp. Reparo>20%HD (Eficiência): ${trExcedeEfic.length} OS com tempo de reparo acima de 20% da jornada` +
          (hasDeslocCurto ? ` — ${trExcedeEfic.filter((o) => o.tl_ordem_min < 5).length} delas com TL <5 min, sugerindo técnico já no local ou erro de "A Caminho".` : '.') +
          kpiCtx('Eficiência'),
        );
        recommendations.push(
          `Temp. Reparo>20%HD (Eficiência) — ${hasDeslocCurto ? 'Verificar se o botão "A Caminho" está sendo acionado no endereço correto e no momento certo; ' : ''}` +
          `investigar as OS mais longas: comparar com o Tempo Padrão M300 e identificar se a causa raiz é complexidade real ou apontamento incorreto.`,
        );
      }
    }

    // ── TME IMP — flag-first analysis ──────────────────────────────────────
    if (teamInTme) {
      const tme = tmeImpMap.get(tm.team);
      if (tme) {
        if (tme.summary.countTmeMuitoAlto > 0) {
          const worst = tme.flaggedOrders
            .filter((o) => o.flags.includes('tme_muito_alto'))
            .sort((a, b) => b.tme_imp_min - a.tme_imp_min)[0];
          issues.push(
            `TME IMP elevado: ${tme.summary.countTmeMuitoAlto} OS com tempo improdutivo (No Local → Liberada) acima de 1,5× a média — caso crítico OS ${worst.nr_ordem}` +
            ` com ${round2(worst.tme_imp_min)} min (vs. média da equipe ${round2(worst.team_avg_tme_min)} min).` +
            kpiCtx('TME IMP'),
          );
          recommendations.push(
            `TME IMP elevado — Verificar se havia impedimento de acesso, aguardo de material/apoio técnico ou se a OS ficou aberta após o atendimento. Cobrar que "Liberada" seja acionada imediatamente ao concluir o serviço no local.`,
          );
        }
        if (tme.summary.countSemDeslocamento > 0) {
          issues.push(
            `Sem "A Caminho" registrado: ${tme.summary.countSemDeslocamento} OS sem status de deslocamento — sem esse dado o TME IMP é inflado artificialmente, pois o tempo começa a contar desde o último status anterior.` +
            kpiCtx('TME IMP'),
          );
          recommendations.push(
            `Sem "A Caminho" — Reforçar uso correto do aplicativo: acionar "A Caminho" no momento exato da saída para cada atendimento. A ausência desse registro impede o cálculo correto do TME IMP e prejudica o KPI de toda a equipe.`,
          );
        }
        if (tme.summary.countSemExecucao > 0) {
          issues.push(
            `Sem TR registrado: ${tme.summary.countSemExecucao} OS com tempo improdutivo mas sem execução — OS encerrada sem atendimento real ou lançamento incorreto no sistema.` +
            kpiCtx('TME IMP'),
          );
          recommendations.push(
            `Sem TR registrado — Verificar junto ao técnico o que ocorreu nessas OS; se foram encerradas incorretamente, solicitar correção no sistema para que a execução seja contabilizada corretamente.`,
          );
        }
        if (!tme.summary.countTmeMuitoAlto && !tme.summary.countSemDeslocamento && !tme.summary.countSemExecucao) {
          issues.push(
            `TME IMP médio de ${round2(tme.tmeImpValue)} min — acima da meta de ${tme.metaTarget} min; tempo improdutivo entre chegada ao local e liberação da OS está elevado.` +
            kpiCtx('TME IMP'),
          );
          recommendations.push(
            `TME IMP — Cobrar que ao chegar ao local o técnico inicie imediatamente os procedimentos de atendimento e acione "Liberada" assim que concluir, sem deixar a OS aberta.`,
          );
        }
      }
    }

    // ── 1º Login — flag-first analysis ────────────────────────────────────
    if (teamInLogin) {
      const login = loginMap.get(tm.team);
      if (login) {
        if (login.summary.countLoginMuitoTardio > 0) {
          const worst = login.flaggedDays
            .filter((d) => d.flags.includes('login_muito_tardio'))
            .sort((a, b) => b.primeiro_login_min - a.primeiro_login_min)[0];
          issues.push(
            `Furo de Jornada (Log In Extremo): ${login.summary.countLoginMuitoTardio} dia(s) com acesso ao sistema absurdamente tarde. Caso mais grave: dia ${worst.date_ref} com ${round2(worst.primeiro_login_min)} min de atraso após o horário oficial.` +
            kpiCtx('1º Login'),
          );
          recommendations.push(
            `Furo de Jornada (Log In Extremo) — O supervisor deve confrontar o técnico sobre as datas específicas. Atrasos extremos no sistema indicam que a equipe iniciou o turno "às cegas" ou chegou muito atrasada na base. Exigir o Log In no horário exato do contrato.`,
          );
        } else if (login.summary.countLoginTardio > 0) {
          const lateOnes = login.flaggedDays.filter((d) => d.flags.includes('login_tardio'));
          const avgLate = lateOnes.length > 0 ? round2(lateOnes.reduce((s, d) => s + d.primeiro_login_min, 0) / lateOnes.length) : 0;
          issues.push(
            `Indisciplina Matinal (Log In Atrasado): ${login.summary.countLoginTardio} dia(s) com o primeiro acesso ao sistema fora do horário padrão (média de ${avgLate} min de atraso).` +
            kpiCtx('1º Login'),
          );
          recommendations.push(
            `Indisciplina Matinal (Log In Atrasado) — O supervisor deve alertar que o início do trabalho só é computado após o login. Atrasar o login bloqueia a visualização da equipe pelo despachador e atrasa a saída para o campo. Cobrar mudança imediata de rotina.`,
          );
        }
      }
    }

    // ── 1º Desloc. — flag-first analysis ──────────────────────────────────
    if (teamInDesloc) {
      const desloc = deslocMap.get(tm.team);
      if (desloc) {
        if (desloc.summary.countDeslocMuitoLento > 0) {
          const worst = desloc.flaggedDays
            .filter((d) => d.flags.includes('desloc_muito_lento'))
            .sort((a, b) => b.primeiro_desloc_min - a.primeiro_desloc_min)[0];
          issues.push(
            `Retenção Crítica na Base (1º Deslocamento): ${desloc.summary.countDeslocMuitoLento} dia(s) com demora inaceitável para sair após o 1º despacho. Pior caso: dia ${worst.date_ref} com ${round2(worst.primeiro_desloc_min)} min de imobilidade.` +
            kpiCtx('1º Desloc.'),
          );
          recommendations.push(
            `Retenção Crítica na Base — O supervisor deve exigir justificativa para esse tempo perdido na base. Se for excesso de burocracia (entrega de material, reuniões diárias prolongadas), a gestão deve rever o formato para não sangrar o horário produtivo da equipe.`,
          );
        } else if (desloc.summary.countDeslocLento > 0) {
          issues.push(
            `Saída Matinal Lenta: ${desloc.summary.countDeslocLento} dia(s) com letargia entre o recebimento da primeira OS e a saída efetiva para a rua ("A Caminho").` +
            kpiCtx('1º Desloc.'),
          );
          recommendations.push(
            `Saída Matinal Lenta — O supervisor deve estabelecer um teto de tempo para a saída matinal. Ao pingar a primeira OS na tela, o veículo precisa entrar em movimento rapidamente. A rotina de carregamento do carro deve ser antecipada.`,
          );
        }
        if (desloc.summary.countSemDeslocRegistrado > 0) {
          issues.push(
            `Vício de Apontamento (1ª OS sem "A Caminho"): ${desloc.summary.countSemDeslocRegistrado} dia(s) onde a equipe saiu para a 1ª OS sem bater o status de deslocamento no celular.` +
            kpiCtx('1º Desloc.'),
          );
          recommendations.push(
            `Vício de Apontamento (1ª OS sem "A Caminho") — O supervisor deve cobrar a obrigatoriedade da marcação correta. Sem o "A Caminho", o sistema presume que o técnico não se deslocou, distorcendo as métricas de tempo produtivo do dia inteiro.`,
          );
        }
        if (desloc.summary.countDespachoTardio > 0) {
          const tardioOnes = desloc.flaggedDays.filter((d) => d.flags.includes('despacho_tardio'));
          const avgTardio  = tardioOnes.length > 0 ? round2(tardioOnes.reduce((s, d) => s + d.despacho_apos_inicio_min, 0) / tardioOnes.length) : 0;
          const loginDelay = tardioOnes.length > 0 ? round2(tardioOnes.reduce((s, d) => s + d.login_atraso_min, 0) / tardioOnes.length) : 0;
          issues.push(
            `Ociosidade por Falta de Serviço: ${desloc.summary.countDespachoTardio} dia(s) com "vácuo" matinal — a 1ª OS demorou mais de 10 min para cair na tela (média ${avgTardio} min retidos).` +
            (loginDelay > 0 ? ` Atenção: parte desse tempo foi auto-infligido pelo Log In atrasado da própria equipe (${loginDelay} min de atraso).` : '') +
            kpiCtx('1º Desloc.'),
          );
          recommendations.push(
            `Ociosidade por Falta de Serviço — O supervisor deve intervir junto ao Despacho (Central). Não é aceitável que a equipe inicie o turno e fique ociosa esperando ordens. ${loginDelay > 0 ? 'Contudo, cobrar primeiro que a equipe realize o Log In no horário certo para ficar visível à central.' : ''}`,
          );
        }
      }
    }

    // ── Retorno Base — flag-first analysis ────────────────────────────────
    if (teamInRetorno) {
      const retorno = retornoMap.get(tm.team);
      if (retorno) {
        if (retorno.summary.countRetornoMuitoAlto > 0) {
          const worst = retorno.flaggedDays
            .filter((d) => d.flags.includes('retorno_muito_alto'))
            .sort((a, b) => (b.true_retorno_min ?? b.retorno_base_min) - (a.true_retorno_min ?? a.retorno_base_min))[0];
          issues.push(
            `Fuga de Produtividade no Retorno: ${retorno.summary.countRetornoMuitoAlto} dia(s) com demora exorbitante entre a última OS e o encerramento da jornada (dia ${worst.date_ref} com ${round2(worst.true_retorno_min ?? worst.retorno_base_min)} min ociosos).` +
            kpiCtx('Retorno Base'),
          );
          recommendations.push(
            `Fuga de Produtividade no Retorno — O supervisor deve mapear o roteiro da equipe no fim do dia. Pode estar ocorrendo desvio de rota, paradas não autorizadas ou falha grave de roteirização do despacho (mandar a equipe para longe no final do turno).`,
          );
        } else if (retorno.summary.countRetornoAlto > 0) {
          issues.push(
            `Deslocamento Final Improdutivo: ${retorno.summary.countRetornoAlto} dia(s) com trânsito de retorno para a base consumindo mais tempo que o aceitável.` +
            kpiCtx('Retorno Base'),
          );
          recommendations.push(
            `Deslocamento Final Improdutivo — O supervisor deve alinhar estrategicamente com o Despacho para que a última OS do dia seja sempre direcionada para perto da Base/Residência da equipe, minimizando a Utilização perdida no final da tarde.`,
          );
        }
      }
    }

    // Phase 4: Deviation-based recommendations (existing logic)
    const deviationIssues: Array<{ token: string; message: string; rec: string }> = [
      {
        token: 'util < 40%',
        message: 'Desvio: Utilização abaixo de 40%',
        rec: 'Aumentar número de OS executadas no período ou revisar apontamentos de ociosidade.',
      },
      {
        token: 'sem intervalo',
        message: 'Desvio: Sem registro de intervalo',
        rec: 'Orientar registro obrigatório do intervalo de almoço no sistema.',
      },
      {
        token: 'logoff antecipado',
        message: 'Desvio: LogOff antecipado',
        rec: 'Orientar equipe a registrar o fim de turno apenas após completar a jornada.',
      },
      {
        token: 'sem fim turno',
        message: 'Desvio: Sem registro de fim de turno',
        rec: 'Cobrar registro obrigatório do Log Off ao término da jornada.',
      },
      {
        token: 'calendario errado',
        message: 'Desvio: Calendário com apontamento incorreto',
        rec: 'Verificar horários de Log In em relação ao Início Calendário estipulado.',
      },
      {
        token: 'retorno a base < 8 min',
        message: 'Desvio: Retorno a base suspeito (<8 min)',
        rec: 'Verificar se a equipe está liberando ordens dentro ou nas imediações da base antes de retornar.',
      },
      {
        token: '1o deslocamento 2 horas',
        message: 'Desvio: 1º deslocamento com atraso ≥2h',
        rec: 'Cobrar apontamento do primeiro deslocamento no início do turno.',
      },
      {
        token: 'inicio turno > 2 horas',
        message: 'Desvio: Início de turno com atraso >2h',
        rec: 'Verificar e regularizar o horário de início do turno junto ao supervisor.',
      },
      {
        token: 'intervalo < 30 ou > 70 min',
        message: 'Desvio: Intervalo com duração irregular',
        rec: 'Garantir que o intervalo seja apontado dentro do intervalo regulamentar (30–70 min).',
      },
      {
        token: 'intervalo por ultimo',
        message: 'Desvio: Intervalo registrado por último (fim do turno)',
        rec: 'Orientar que o intervalo deve ser realizado e apontado durante o turno, não ao final.',
      },
    ];

    for (const { token, message, rec } of deviationIssues) {
      const matched = deviations.some((d) => normalizeToken(d).includes(normalizeToken(token)));
      if (matched) {
        issues.push(message);
        recommendations.push(rec);
      }
    }

    if (issues.length > 0) {
      plans.push({ team: tm.team, issues, recommendations });
    }
  }

  return plans.slice(0, 25);
}

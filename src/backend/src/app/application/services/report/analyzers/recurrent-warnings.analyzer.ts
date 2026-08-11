import { 
  TeamKpiScorecard, 
  TeamRecurrentWarning, 
  UtilizacaoTeamAnalysis, 
  RetornoBaseTeamAnalysis, 
  TmeImpTeamAnalysis, 
  PrimeiroDeslocTeamAnalysis, 
  PrimeiroLoginTeamAnalysis 
} from '../types.js';
import { getLimit } from '../../../../infrastructure/config/env.js';

export function buildRecurrentWarnings(
  teamScorecard: TeamKpiScorecard[],
  utilizacaoAnalysis: UtilizacaoTeamAnalysis[],
  retornoBaseAnalysis: RetornoBaseTeamAnalysis[],
  tmeImpAnalysis: TmeImpTeamAnalysis[],
  primeiroDeslocAnalysis: PrimeiroDeslocTeamAnalysis[],
  primeiroLoginAnalysis: PrimeiroLoginTeamAnalysis[]
): TeamRecurrentWarning[] {
  const warnings: TeamRecurrentWarning[] = [];

  const getSemOsLimit = (polo?: string) => getLimit('LIMIT_SEM_OS_MIN', polo, 10);
  const getCciSemOsLimit = (polo?: string) => getLimit('LIMIT_CCI_SEM_OS_MIN', polo, 15);

  for (const sc of teamScorecard) {
    const teamDesvios: { name: string; priority: number; avgMin: number; count: number; globalAvg: number; limitMin?: number }[] = [];
    const util = utilizacaoAnalysis.find((u) => u.team === sc.team);
    const diasTrab = util?.totalJornadas || retornoBaseAnalysis.find(a => a.team === sc.team)?.totalDays || primeiroDeslocAnalysis.find(a => a.team === sc.team)?.totalDays || 1;
    const totalOrders = util?.totalOrders || tmeImpAnalysis.find(a => a.team === sc.team)?.totalOrders || 0;
    const polo = util?.polo;

    let entreOsData: TeamRecurrentWarning['entreOs'] = undefined;

    if (util && util.flaggedOrders) {
      // 1. Partida (temp_prep_alto)
      const partidasOverLimit = util.flaggedOrders.filter(o => o.flags?.includes('temp_prep_alto'));
      if (partidasOverLimit.length > 0) {
        const avg = Math.round(partidasOverLimit.reduce((acc, val) => acc + (val.temp_prep_os_min || 0), 0) / (partidasOverLimit.length || 1));
        teamDesvios.push({ name: 'Partida', priority: 1, avgMin: avg, count: partidasOverLimit.length, globalAvg: 0 });
      }

      // 2. Desl. Intervalo (desloc_intervalo_alto)
      const intervalosOverLimit = util.flaggedOrders.filter(o => o.flags?.includes('desloc_intervalo_alto'));
      if (intervalosOverLimit.length > 0) {
        const SEM_OS_LIMIT = getSemOsLimit(polo);
        const badIntervalos = intervalosOverLimit.flatMap(o => o.sem_os_details?.filter(d => d.type === 'intervalo_deslocamento' && d.min >= SEM_OS_LIMIT) || []);
        const avg = Math.round(badIntervalos.reduce((acc, val) => acc + val.min, 0) / (badIntervalos.length || 1));
        const globalAvg = Math.round(badIntervalos.reduce((acc, val) => acc + (val.global_avg_min || 0), 0) / (badIntervalos.length || 1));
        teamDesvios.push({ name: 'Desl. Intervalo', priority: 2, avgMin: avg, count: intervalosOverLimit.length, globalAvg });
      }

      // 3. Sem OS (entre_ordens) -> Apenas para CCI
      const entreOsAll = util.flaggedOrders.flatMap(o => o.sem_os_details?.filter(d => d.type === 'entre_ordens' && d.min > 0) || []);
      const CCI_SEM_OS_LIMIT = getCciSemOsLimit(polo);
      const entreOsOverCCI = entreOsAll.filter(d => d.min > CCI_SEM_OS_LIMIT);
      
      if (entreOsOverCCI.length > 0) {
        const avg = Math.round(entreOsAll.reduce((acc, val) => acc + val.min, 0) / (entreOsAll.length || 1));
        const globalAvg = Math.round(entreOsAll.reduce((acc, val) => acc + (val.global_avg_min || 0), 0) / (entreOsAll.length || 1));
        const sumOver15Min = entreOsOverCCI.reduce((acc, val) => acc + val.min, 0);

        const entreOsOrders = util.flaggedOrders.filter(o =>
          o.sem_os_details?.some(d => d.type === 'entre_ordens' && d.min > CCI_SEM_OS_LIMIT)
        );
        const distinctDates = new Set(entreOsOrders.map(o => o.date_ref).filter(Boolean));
        const distinctDaysCount = distinctDates.size > 0 ? distinctDates.size : entreOsOverCCI.length;

        entreOsData = {
          count: entreOsOverCCI.length,
          distinctDaysCount,
          avgMin: avg,
          globalAvg,
          sumOver15Min
        };
      }
      
      // 4. Calendário Errado (calendario_errado)
      const calendarioErradoOverLimit = util.flaggedOrders.filter(o => o.flags?.includes('calendario_errado'));
      if (calendarioErradoOverLimit.length > 0) {
        teamDesvios.push({ name: 'Calendário Errado', priority: 1.9, avgMin: 0, count: calendarioErradoOverLimit.length, globalAvg: 0 });
      }
    }

    if (sc.kpiStatus.retornoBase === 'below' && sc.kpis.retornoBase !== undefined) {
      const ana = retornoBaseAnalysis.find(a => a.team === sc.team);
      if (ana && ana.flaggedDays && ana.flaggedDays.length > 0) {
        teamDesvios.push({ name: 'Retorno a Base', priority: 4, avgMin: Math.round(ana.avgRetornoMin || 0), count: ana.flaggedDays.length, globalAvg: Math.round(ana.globalAvgRetornoMin || 0), limitMin: ana.limitMin });
      }
    }
    if (sc.kpiStatus.tmeImp === 'below' && sc.kpis.tmeImp !== undefined) {
      const ana = tmeImpAnalysis.find(a => a.team === sc.team);
      if (ana && ana.flaggedOrders && ana.flaggedOrders.length > 0) {
        teamDesvios.push({ name: 'TME IMP', priority: 5, avgMin: Math.round(sc.kpis.tmeImp), count: ana.flaggedOrders.length, globalAvg: Math.round(ana.globalAvgTmeImpMin || 0) });
      }
    }
    if (sc.kpiStatus.primeiroDesloc === 'below' && sc.kpis.primeiroDesloc !== undefined) {
      const ana = primeiroDeslocAnalysis.find(a => a.team === sc.team);
      if (ana && ana.flaggedDays && ana.flaggedDays.length > 0) {
        teamDesvios.push({ name: '1º Desloc.', priority: 6, avgMin: Math.round(sc.kpis.primeiroDesloc), count: ana.flaggedDays.length, globalAvg: Math.round(ana.globalAvgDeslocMin || 0) });
      }
    }
    if (sc.kpiStatus.primeiroLogin === 'below' && sc.kpis.primeiroLogin !== undefined) {
      const ana = primeiroLoginAnalysis.find(a => a.team === sc.team);
      if (ana && ana.flaggedDays && ana.flaggedDays.length > 0) {
        teamDesvios.push({ name: '1º Login', priority: 7, avgMin: Math.round(sc.kpis.primeiroLogin), count: ana.flaggedDays.length, globalAvg: Math.round(ana.globalAvgLoginMin || 0) });
      }
    }

    // Filter recurrent desvios
    const recurrentDesvios = teamDesvios.filter(d => {
      const isOSBased = ['Partida', 'TME IMP'].includes(d.name);
      const baseCount = isOSBased ? totalOrders : diasTrab;
      if (baseCount === 0) return false;
      return (d.count / baseCount) >= 0.20;
    });

    if (recurrentDesvios.length > 0 || entreOsData) {
      warnings.push({
        team: sc.team,
        diasTrab,
        totalOrders,
        desvios: recurrentDesvios,
        entreOs: entreOsData
      });
    }
  }

  return warnings;
}

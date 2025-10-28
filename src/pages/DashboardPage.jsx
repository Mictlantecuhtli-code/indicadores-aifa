
import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  BarChartHorizontal,
  Calendar,
  ChevronDown,
  LineChart as LineChartIcon,
  Loader2,
  Package,
  Plane,
  ShieldCheck,
  PlaneTakeoff,
  Target,
  Users,
  Weight
} from 'lucide-react';

import { getAreas, getIndicatorHistory, getIndicatorTargets } from '../lib/supabaseClient.js';
import { useIndicatorAssignments } from '../hooks/useIndicatorAssignments.js';
import { formatMonth, formatNumber, formatPercentage, monthName } from '../utils/formatters.js';
import { isFaunaImpactRateIndicator, normalizeScenarioKey } from '../utils/smsIndicators.js';
import {
  Bar as RechartsBar,
  CartesianGrid,
  ComposedChart as RechartsComposedChart,
  Legend,
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const TEMPLATE_META = {
  mensual_vs_anterior: { type: 'monthly', icon: LineChartIcon },
  trimestral_vs_anterior: { type: 'quarterly', icon: BarChart3 },
  anual_vs_anterior: { type: 'annual', icon: Calendar },
  escenario_bajo: { type: 'scenario', scenario: 'BAJO', icon: Target },
  escenario_medio: { type: 'scenario', scenario: 'MEDIO', icon: Target },
  escenario_alto: { type: 'scenario', scenario: 'ALTO', icon: Target }
};

const CATEGORY_ICON_MAP = {
  'plane-operations': PlaneTakeoff,
  'plane-passengers': Users,
  'cargo-operations': Package,
  'cargo-weight': Weight,
  'fbo-operations': Plane,
  'fbo-passengers': Users
};

const MONTH_SHORT_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumValues(values = []) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function computeTotals(rows = [], { type, strategy = 'sum' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const extractValues = key =>
    rows
      .map(row => {
        const value = row?.[key];
        return Number.isFinite(value) ? Number(value) : null;
      })
      .filter(value => value !== null);

  const currentValues = extractValues('currentValue');
  const comparisonValues = extractValues('comparisonValue');
  const referenceValues = extractValues('referenceValue');

  if (!currentValues.length && !comparisonValues.length && !referenceValues.length) {
    return null;
  }

  const aggregate = values => {
    if (!values.length) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    return strategy === 'average' ? total / values.length : total;
  };

  const currentTotal = aggregate(currentValues);
  const comparisonTotal = aggregate(comparisonValues);
  const referenceTotal = aggregate(referenceValues);

  const diffBase = referenceTotal ?? comparisonTotal;
  const diff =
    currentTotal !== null && diffBase !== null ? currentTotal - diffBase : null;

  let pct = null;
  if (referenceTotal !== null) {
    pct = referenceTotal !== 0 ? diff / referenceTotal : null;
  } else if (comparisonTotal !== null) {
    if (type === 'scenario') {
      pct = comparisonTotal !== 0 ? currentTotal / comparisonTotal : null;
    } else {
      pct = comparisonTotal !== 0 ? diff / comparisonTotal : null;
    }
  }

  return {
    currentValue: currentTotal,
    comparisonValue: comparisonTotal,
    referenceValue: referenceTotal,
    diff,
    pct
  };
}

function forecastWithHoltLinear(series, steps, alpha = 0.5, beta = 0.3) {
  if (series.length === 0 || steps <= 0) {
    return [];
  }

  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;

  if (!Number.isFinite(level)) level = 0;
  if (!Number.isFinite(trend)) trend = 0;

  const fallbackValue = Number.isFinite(series[series.length - 1])
    ? series[series.length - 1]
    : level;

  for (let index = 1; index < series.length; index += 1) {
    const value = series[index];
    if (!Number.isFinite(value)) {
      continue;
    }
    const previousLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }

  const predictions = [];
  for (let step = 1; step <= steps; step += 1) {
    const value = level + step * trend;
    predictions.push(Number.isFinite(value) ? value : fallbackValue);
  }
  return predictions;
}

function forecastWithHoltWinters(series, steps, {
  alpha = 0.4,
  beta = 0.3,
  gamma = 0.3,
  seasonLength = 12
} = {}) {
  if (series.length < 2 || steps <= 0) {
    return [];
  }

  const maxSeason = Math.min(seasonLength, Math.floor(series.length / 2));
  if (!Number.isFinite(maxSeason) || maxSeason < 2) {
    return forecastWithHoltLinear(series, steps, alpha, beta);
  }

  const effectiveSeasonLength = maxSeason;
  const seasonCount = Math.floor(series.length / effectiveSeasonLength);
  if (seasonCount < 2) {
    return forecastWithHoltLinear(series, steps, alpha, beta);
  }

  const seasonals = new Array(effectiveSeasonLength).fill(0);
  const seasonAverages = [];
  for (let seasonIndex = 0; seasonIndex < seasonCount; seasonIndex += 1) {
    const start = seasonIndex * effectiveSeasonLength;
    let sum = 0;
    for (let offset = 0; offset < effectiveSeasonLength; offset += 1) {
      sum += series[start + offset];
    }
    seasonAverages.push(sum / effectiveSeasonLength);
  }

  for (let position = 0; position < effectiveSeasonLength; position += 1) {
    let sum = 0;
    for (let seasonIndex = 0; seasonIndex < seasonCount; seasonIndex += 1) {
      const value = series[seasonIndex * effectiveSeasonLength + position];
      sum += value - seasonAverages[seasonIndex];
    }
    seasonals[position] = sum / seasonCount;
  }

  let level = seasonAverages[0];
  if (!Number.isFinite(level)) {
    level = series[0];
  }
  let trendSum = 0;
  for (let i = 0; i < effectiveSeasonLength; i += 1) {
    const first = series[i];
    const second = series[i + effectiveSeasonLength];
    if (Number.isFinite(first) && Number.isFinite(second)) {
      trendSum += (second - first) / effectiveSeasonLength;
    }
  }
  let trend = trendSum / effectiveSeasonLength;
  if (!Number.isFinite(trend)) {
    trend = 0;
  }

  const fallbackValue = Number.isFinite(series[series.length - 1])
    ? series[series.length - 1]
    : level;

  for (let index = 0; index < series.length; index += 1) {
    const value = series[index];
    if (!Number.isFinite(value)) {
      continue;
    }
    const seasonIndex = index % effectiveSeasonLength;
    const previousLevel = level;
    const seasonal = seasonals[seasonIndex];
    level = alpha * (value - seasonal) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonals[seasonIndex] = gamma * (value - level) + (1 - gamma) * seasonal;
  }

  const predictions = [];
  for (let step = 1; step <= steps; step += 1) {
    const seasonIndex = (series.length + step - 1) % effectiveSeasonLength;
    const value = level + step * trend + seasonals[seasonIndex];
    predictions.push(Number.isFinite(value) ? value : fallbackValue);
  }

  return predictions;
}

function forecastExponentialSmoothing(values = [], steps = 6, options = {}) {
  const series = values.map(value => Number(value)).filter(value => Number.isFinite(value));

  if (series.length < 3 || steps <= 0) {
    return [];
  }

  return forecastWithHoltWinters(series, steps, options);
}

function addMonths(year, month, offset) {
  const date = new Date(Number(year) || 2000, (Number(month) || 1) - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function formatTrendLabel(year, month) {
  const short = MONTH_SHORT_LABELS[(month - 1 + 12) % 12] ?? monthName(month);
  const shortYear = `${year}`.slice(-2);
  return `${short} '${shortYear} · T`;
}

function computeForecast({ type, history = [], latestRecord, periods = 6, totalsStrategy = 'sum' }) {
  if (type !== 'monthly' && type !== 'scenario') {
    return null;
  }

  const series = history
    .map(item => toNumber(item?.valor))
    .filter(value => Number.isFinite(value));

  if (series.length < 4) {
    return null;
  }

  const predictions = forecastExponentialSmoothing(series, periods, { seasonLength: 12 });
  if (!predictions.length) {
    return null;
  }

  const baseYear = Number(latestRecord?.anio) || new Date().getFullYear();
  const baseMonth = Number(latestRecord?.mes ?? 12) || 12;

  const rows = predictions.map((value, index) => {
    const { year, month } = addMonths(baseYear, baseMonth, index + 1);
    return {
      period: formatMonth(year, month),
      label: formatTrendLabel(year, month),
      currentValue: value,
      comparisonValue: null,
      diff: null,
      pct: null,
      isForecast: true
    };
  });

  const totals = computeTotals(rows, { type, strategy: totalsStrategy });

  return {
    rows,
    totals,
    chartPoints: rows.map(item => ({
      period: item.label,
      current: null,
      comparison: null,
      trend: item.currentValue,
      fullPeriod: item.period,
      isForecast: true
    })),
    series: {
      key: 'trend',
      name: 'Tendencia',
      color: '#7c3aed',
      renderer: 'line',
      strokeDasharray: '6 4',
      strokeWidth: 2,
      dot: false
    }
  };
}

function buildYearMonthIndex(history = []) {
  const index = new Map();
  history.forEach(item => {
    const year = Number(item?.anio);
    const month = Number(item?.mes ?? 0);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;
    if (!index.has(year)) {
      index.set(year, new Map());
    }
    const value = toNumber(item?.valor);
    if (value === null) return;
    index.get(year).set(month, value);
  });
  return index;
}

function sortHistory(records = []) {
  return [...records]
    .filter(Boolean)
    .sort((a, b) => {
      if (a.anio === b.anio) {
        return (a.mes ?? 0) - (b.mes ?? 0);
      }
      return a.anio - b.anio;
    });
}

function formatSignedNumber(value) {
  if (value === null || value === undefined) return '—';
  const absolute = Math.abs(value);
  const formatted = formatNumber(absolute, { decimals: 0 });
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function getTrendTextClass(value) {
  if (value === null || value === undefined) return 'text-slate-500';
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-500';
}

function buildScenarioTargetsIndex(targets = []) {
  const map = new Map();
  targets.forEach(item => {
    const scenarioKey = normalizeScenarioKey(item?.escenario);
    if (!scenarioKey) return;
    if (!map.has(scenarioKey)) {
      map.set(scenarioKey, new Map());
    }
    const year = Number(item?.anio);
    if (!Number.isFinite(year)) return;
    const rawMonth = Number(item?.mes);
    const month = Number.isFinite(rawMonth) ? rawMonth : 0;
    const key = `${year}-${month}`;
    const value = toNumber(item?.valor);
    if (value === null) return;
    map.get(scenarioKey).set(key, value);
  });
  return map;
}

function getScenarioTargetValue(targetsMap, year, month) {
  if (!(targetsMap instanceof Map)) return null;
  const directKey = `${year}-${month}`;
  if (targetsMap.has(directKey)) {
    return targetsMap.get(directKey);
  }
  const fallbackKey = `${year}-0`;
  if (targetsMap.has(fallbackKey)) {
    return targetsMap.get(fallbackKey);
  }
  return null;
}

function formatScenarioLabel(scenario) {
  if (!scenario) return 'Meta';
  switch (scenario.toUpperCase()) {
    case 'BAJO':
      return 'Meta Escenario Bajo';
    case 'MEDIO':
      return 'Meta Escenario Medio';
    case 'ALTO':
      return 'Meta Escenario Alto';
    default:
      return `Meta Escenario ${scenario}`;
  }
}

function computeMonthlyRows({
  currentYear,
  previousYear,
  latestMonth,
  currentYearMonths,
  previousYearMonths,
  diffReferenceTargets = null
}) {
  const rows = [];
  for (let month = 1; month <= latestMonth; month += 1) {
    const currentValue = currentYearMonths.get(month) ?? null;
    if (currentValue === null) continue;

    const comparisonValue = previousYear ? previousYearMonths.get(month) ?? null : null;
    const referenceValue = getScenarioTargetValue(diffReferenceTargets, currentYear, month);

    const effectiveComparison =
      referenceValue !== null && Number.isFinite(referenceValue) ? referenceValue : comparisonValue;

    let diff = null;
    let pct = null;
    if (currentValue !== null && effectiveComparison !== null) {
      diff = currentValue - effectiveComparison;
      if (effectiveComparison !== 0) {
        pct = diff / effectiveComparison;
      }
    }
    rows.push({
      period: formatMonth(currentYear, month),
      comparisonPeriod: previousYear ? formatMonth(previousYear, month) : null,
      label: MONTH_SHORT_LABELS[month - 1] ?? String(month),
      currentValue,
      comparisonValue,
      referenceValue: referenceValue !== null && Number.isFinite(referenceValue) ? referenceValue : null,
      diff,
      pct
    });
  }
  return rows;
}

function computeQuarterRows({ currentYear, latestMonth, currentYearMonths, previousYearMonths, previousYear }) {
  const rows = [];
  const latestQuarter = Math.ceil(latestMonth / 3);
  for (let quarter = 1; quarter <= latestQuarter; quarter += 1) {
    const monthsInQuarter = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
    const currentValues = monthsInQuarter.map(month => currentYearMonths.get(month)).filter(v => v !== null);
    const previousValues = monthsInQuarter
      .map(month => previousYearMonths.get(month))
      .filter(v => v !== null);
    if (!currentValues.length && !previousValues.length) continue;
    const currentSum = sumValues(currentValues);
    const previousSum = sumValues(previousValues);
    const diff = currentSum - previousSum;
    const pct = previousSum ? diff / previousSum : null;
    rows.push({
      period: `Trimestre ${quarter} ${currentYear}`,
      comparisonPeriod: previousYear ? `Trimestre ${quarter} ${previousYear}` : null,
      currentValue: currentSum,
      comparisonValue: previousSum,
      diff,
      pct
    });
  }
  return rows;
}

function computeAnnualRow({ currentYear, latestMonth, currentYearMonths, previousYearMonths, previousYear }) {
  const monthsRange = Array.from({ length: latestMonth }, (_, index) => index + 1);
  const currentValues = monthsRange.map(month => currentYearMonths.get(month)).filter(v => v !== null);
  const previousValues = monthsRange.map(month => previousYearMonths.get(month)).filter(v => v !== null);
  if (!currentValues.length && !previousValues.length) {
    return [];
  }
  const currentSum = sumValues(currentValues);
  const previousSum = sumValues(previousValues);
  const diff = currentSum - previousSum;
  const pct = previousSum ? diff / previousSum : null;
  return [
    {
      period: `Año ${currentYear}`,
      comparisonPeriod: previousYear ? `Año ${previousYear}` : null,
      currentValue: currentSum,
      comparisonValue: previousSum,
      diff,
      pct
    }
  ];
}

function computeScenarioRows({ currentYear, latestMonth, currentYearMonths, scenarioTargets }) {
  const rows = [];
  for (let month = 1; month <= latestMonth; month += 1) {
    const real = currentYearMonths.get(month) ?? null;
    const target = getScenarioTargetValue(scenarioTargets, currentYear, month);
    if (real === null && target === null) continue;
    const diff = real !== null && target !== null ? real - target : null;
    const pct = target ? (real ?? 0) / target : null;
    rows.push({
      period: formatMonth(currentYear, month),
      currentValue: real,
      comparisonValue: target,
      diff,
      pct
    });
  }
  return rows;
}

function buildChartData({ rows }) {
  return rows.map((item, index) => ({
    period: item.label ?? monthName(index + 1) ?? item.period,
    current: item.currentValue ?? null,
    comparison: item.comparisonValue ?? null,
    reference: item.referenceValue ?? null,
    fullPeriod: item.period,
    comparisonPeriod: item.comparisonPeriod,
    monthLabel: item.label ?? item.period
  }));
}

function buildScenarioChartData(rows) {
  return rows.map((item, index) => ({
    period: MONTH_SHORT_LABELS[index] ?? item.period,
    current: item.currentValue ?? null,
    comparison: item.comparisonValue ?? null,
    fullPeriod: item.period
  }));
}

function computeAnalytics({
  type,
  scenario,
  history,
  targets,
  totalsStrategy = 'sum',
  diffScenario = null
}) {
  const sortedHistory = sortHistory(history);
  if (!sortedHistory.length) {
    return null;
  }

  const latestRecord = sortedHistory[sortedHistory.length - 1];
  const currentYear = Number(latestRecord.anio);
  const latestMonth = Number(latestRecord.mes ?? 12) || 12;
  const previousYear = Number.isFinite(currentYear) ? currentYear - 1 : null;

  const index = buildYearMonthIndex(sortedHistory);
  const currentYearMonths = index.get(currentYear) ?? new Map();
  const previousYearMonths = previousYear ? index.get(previousYear) ?? new Map() : new Map();
  if (!currentYearMonths.size) {
    return null;
  }

    // CAMBIO: Detectar indicador de fauna e implementar lógica especial
  const indicator = arguments[0]?.indicator;
  const isFaunaImpact = isFaunaImpactRateIndicator(indicator);
  
  // CAMBIO: Para SMS-01, usar escenario BAJO y estrategia de promedio
  const effectiveScenario = isFaunaImpact && type === 'scenario' ? 'BAJO' : scenario;
  const effectiveTotalsStrategy = isFaunaImpact ? 'average' : totalsStrategy;
  const effectiveDiffScenario = isFaunaImpact ? 'BAJO' : diffScenario;

  const normalizedDiffScenario = diffScenario ? normalizeScenarioKey(diffScenario) : null;
  const scenarioTargetsIndex =
    type === 'scenario' || normalizedDiffScenario
      ? buildScenarioTargetsIndex(targets)
      : null;

  if (type === 'scenario') {
    const scenarioTargets = scenarioTargetsIndex?.get(normalizeScenarioKey(scenario)) ?? new Map();
    const rows = computeScenarioRows({ currentYear, latestMonth, currentYearMonths, scenarioTargets });
    const totals = computeTotals(rows, { type, strategy: totalsStrategy });
    const forecast = computeForecast({
      type,
      history: sortedHistory,
      latestRecord,
      periods: 6,
      totalsStrategy
    });
    if (!rows.length) {
      return {
        type,
        scenario,
        currentYear,
        previousYear,
        latestMonth,
        latestRecord,
        rows,
        totals,
        totalsStrategy,
        forecast,
        comparisonLabel: formatScenarioLabel(scenario)
      };
    }
    const lastRow = rows[rows.length - 1];
    return {
      type,
      scenario,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows,
      totals,
      totalsStrategy,
      forecast,
      comparisonLabel: formatScenarioLabel(scenario),
      summary: {
        title: `Comparativo Real vs Meta – ${formatScenarioLabel(scenario).replace('Meta ', '')}`,
        currentLabel: lastRow.period,
        comparisonLabel: formatScenarioLabel(scenario),
        currentValue: lastRow.currentValue,
        comparisonValue: lastRow.comparisonValue,
        diff: lastRow.diff,
        pct: lastRow.pct
      },
      chartData: buildScenarioChartData(rows),
      chartSeries: [
        { key: 'current', name: 'Real', color: '#2563eb' },
        { key: 'comparison', name: formatScenarioLabel(scenario), color: '#f97316' }
      ]
    };
  }

  const diffReferenceTargets =
    normalizedDiffScenario && scenarioTargetsIndex
      ? scenarioTargetsIndex.get(normalizedDiffScenario) ?? null
      : null;

  // CAMBIO: Para indicadores de fauna, usar comparación contra meta en lugar de año anterior
  if (isFaunaImpact && diffReferenceTargets) {
    // Para fauna, comparar siempre contra la meta de escenario bajo
    const rows = computeMonthlyRows({
      currentYear,
      previousYear: null, // No usar año anterior
      latestMonth,
      currentYearMonths,
      previousYearMonths: new Map(), // Vacío para no usar comparación YoY
      diffReferenceTargets
    });
    
    const totals = computeTotals(rows, { type: 'scenario', strategy: effectiveTotalsStrategy });
    const forecast = computeForecast({
      type,
      history: sortedHistory,
      latestRecord,
      periods: 6,
      totalsStrategy: effectiveTotalsStrategy
    });

    return {
      type,
      scenario: effectiveScenario,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows,
      totals,
      totalsStrategy: effectiveTotalsStrategy,
      forecast,
      comparisonLabel: `Meta ${formatScenarioLabel(effectiveDiffScenario)}`,
      summary: buildMonthlySummary(rows, currentYear, `Meta ${formatScenarioLabel(effectiveDiffScenario)}`),
      chartData: buildMonthlyChartData(rows),
      chartSeries: [
        { key: 'current', name: 'Real', color: '#2563eb' },
        { key: 'comparison', name: `Meta ${formatScenarioLabel(effectiveDiffScenario)}`, color: '#f97316' }
      ]
    };
  }


  
  const monthlyRows = computeMonthlyRows({
    currentYear,
    previousYear,
    latestMonth,
    currentYearMonths,
    previousYearMonths,
    diffReferenceTargets
  });

  if (!monthlyRows.length) {
    return null;
  }

  const lastMonthlyRow = monthlyRows[monthlyRows.length - 1];

  const chartData = buildChartData({ rows: monthlyRows });
  const chartSeries = [{ key: 'current', name: `${currentYear}`, color: '#2563eb' }];
  const hasComparisonSeries = monthlyRows.some(row => row.comparisonValue !== null);
  const hasReferenceSeries = monthlyRows.some(row => row.referenceValue !== null);
  const comparisonSeriesLabel = previousYear ? `${previousYear}` : 'Año anterior';
  const referenceSeriesLabel = normalizedDiffScenario ? formatScenarioLabel(diffScenario) : null;

  if (hasComparisonSeries) {
    chartSeries.push({
      key: 'comparison',
      name: comparisonSeriesLabel,
      color: '#10b981'
    });
  }

  const effectiveReferenceLabel =
    hasReferenceSeries && referenceSeriesLabel ? referenceSeriesLabel : null;

  if (effectiveReferenceLabel) {
    chartSeries.push({
      key: 'reference',
      name: effectiveReferenceLabel,
      color: '#f97316',
      strokeDasharray: '6 4',
      dot: false,
      variant: 'reference',
      renderer: 'line'
    });
  }

  if (type === 'monthly') {
    const totals = computeTotals(monthlyRows, { type, strategy: totalsStrategy });
    const forecast = computeForecast({
      type,
      history: sortedHistory,
      latestRecord,
      periods: 6,
      totalsStrategy
    });
    const summaryReferenceValue = hasReferenceSeries ? lastMonthlyRow.referenceValue : null;
    const summaryReferenceLabel =
      summaryReferenceValue !== null ? effectiveReferenceLabel ?? 'Meta' : null;
    const summaryComparisonLabel =
      summaryReferenceLabel ?? lastMonthlyRow.comparisonPeriod ?? 'Mismo mes año anterior';
    const summaryComparisonValue =
      summaryReferenceValue !== null ? summaryReferenceValue : lastMonthlyRow.comparisonValue;

    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: monthlyRows,
      totals,
      totalsStrategy,
      forecast,
      comparisonLabel: comparisonSeriesLabel,
      referenceLabel: effectiveReferenceLabel,
      summary: {
        title: `Variación mensual ${currentYear}`,
        currentLabel: lastMonthlyRow.period,
        comparisonLabel: summaryComparisonLabel,
        currentValue: lastMonthlyRow.currentValue,
        comparisonValue: summaryComparisonValue,
        referenceLabel: summaryReferenceLabel,
        referenceValue: summaryReferenceValue,
        previousLabel: lastMonthlyRow.comparisonPeriod ?? comparisonSeriesLabel,
        previousValue: lastMonthlyRow.comparisonValue,
        diff: lastMonthlyRow.diff,
        pct: lastMonthlyRow.pct
      },
      chartData,
      chartSeries
    };
  }

  if (type === 'quarterly') {
    const quarterRows = computeQuarterRows({
      currentYear,
      latestMonth,
      currentYearMonths,
      previousYearMonths,
      previousYear
    });
    if (!quarterRows.length) {
      return null;
    }
    const lastQuarterRow = quarterRows[quarterRows.length - 1];
    const totals = computeTotals(quarterRows, { type });
    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: quarterRows,
      totals,
      totalsStrategy,
      forecast: null,
      comparisonLabel: previousYear ? `${previousYear}` : 'Año anterior',
      summary: {
        title: `Comparación Trimestral ${currentYear} vs ${previousYear ?? 'año anterior'}`,
        currentLabel: lastQuarterRow?.period ?? '',
        comparisonLabel: lastQuarterRow?.comparisonPeriod ?? 'Mismo trimestre año anterior',
        currentValue: lastQuarterRow?.currentValue ?? null,
        comparisonValue: lastQuarterRow?.comparisonValue ?? null,
        diff: lastQuarterRow?.diff ?? null,
        pct: lastQuarterRow?.pct ?? null
      },
      chartData,
      chartSeries
    };
  }

  if (type === 'annual') {
    const annualRows = computeAnnualRow({
      currentYear,
      latestMonth,
      currentYearMonths,
      previousYearMonths,
      previousYear
    });
    const annualRow = annualRows[0];
    const totals = computeTotals(annualRows, { type });
    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: annualRows,
      totals,
      totalsStrategy,
      forecast: null,
      comparisonLabel: previousYear ? `${previousYear}` : 'Año anterior',
      summary: {
        title: `Comparación Anual Acumulada ${currentYear} vs ${previousYear ?? 'año anterior'}`,
        currentLabel: annualRow?.period ?? '',
        comparisonLabel: annualRow?.comparisonPeriod ?? 'Año anterior',
        currentValue: annualRow?.currentValue ?? null,
        comparisonValue: annualRow?.comparisonValue ?? null,
        diff: annualRow?.diff ?? null,
        pct: annualRow?.pct ?? null
      },
      chartData,
      chartSeries
    };
  }

  return null;
}

function AccordionSection({ id, title, description, isOpen, onToggle, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        <ChevronDown
          className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {isOpen && <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5">{children}</div>}
    </section>
  );
}

function IndicatorCategoriesList({ categories, onSelectOption }) {
  const [openCategory, setOpenCategory] = useState(null);

  if (!categories?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay indicadores asignados a esta categoría.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map(category => (
        <IndicatorCategoryItem
          key={category.id}
          category={category}
          isOpen={openCategory === category.id}
          onToggle={() => setOpenCategory(prev => (prev === category.id ? null : category.id))}
          onSelectOption={onSelectOption}

        />
      ))}
    </div>
  );
}

function IndicatorCategoryItem({ category, isOpen, onToggle, onSelectOption }) {
  const IconComponent = CATEGORY_ICON_MAP[category.icon] ?? BarChart3;


  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <IconComponent className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-slate-800">{category.label}</span>

        </span>
        <ChevronDown
          className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <ul className="space-y-2">
            {category.options.map(option => {
              const templateMeta = TEMPLATE_META[option.templateId] ?? {};
              const OptionIcon = templateMeta.icon ?? LineChartIcon;
              return (
                <li key={option.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => onSelectOption(option.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
                  >
                    <span className="mt-0.5 text-slate-500">
                      <OptionIcon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-medium text-slate-800">{option.templateLabel}</span>
                      {option.indicator ? (
                        <span className="mt-1 block text-xs text-slate-500">
                          Indicador: {option.indicator.nombre}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalizeHex(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(prefixed)) {
    return prefixed.length === 4
      ? `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`
      : prefixed;
  }
  return null;
}

function getBadgeStyles(color) {
  const normalized = normalizeHex(color) ?? '#1e293b';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.65 ? '#0f172a' : '#ffffff';
  return {
    backgroundColor: normalized,
    color: textColor
  };
}

function normalizeAreaName(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const EXCLUDED_AREA_NAMES = new Set(
  [
    // Ocultamos estas direcciones temporalmente del Panel Directivos.
    'SMS',
    'Dirección Comercial y de Servicios',
    'Dirección de Administración',
    'Dirección de Operación',
    'Dirección de Planeación Estratégica',
    'Dirección Jurídica'
  ].map(normalizeAreaName)
);

function buildAreaTree(areas) {
  const byParent = new Map();

  const filteredAreas = (areas ?? []).filter(area => {
    const normalizedName = normalizeAreaName(area?.nombre);

    if (!normalizedName) {
      return false;
    }

    if (normalizedName.includes('sin asignar')) {
      return false;
    }

    if (EXCLUDED_AREA_NAMES.has(normalizedName)) {
      return false;
    }

    return true;
  });
  
  filteredAreas.forEach(area => {
    const parentId = area?.parent_area_id ?? null;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId).push(area);
  });
  
  const sortAreas = list =>
    (list ?? []).slice().sort((a, b) => (a?.nombre ?? '').localeCompare(b?.nombre ?? '', 'es', { sensitivity: 'base' }));
  
  const buildBranch = parentId => {
    const children = sortAreas(byParent.get(parentId));
    return children.map(child => ({
      ...child,
      children: buildBranch(child.id)
    }));
  };
  
  return buildBranch(null);
}

function DirectionChildrenList({ areas }) {
  if (!areas?.length) return null;

  return (
    <ul className="space-y-2">
      {areas.map(area => (
        <li key={area.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>{area.nombre}</span>
            <span
              className="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
              style={getBadgeStyles(area.color_hex)}
            >
              {area.clave ?? '—'}
            </span>
          </div>
          {area.children?.length ? (
            <div className="ml-4 border-l border-slate-200 pl-4">
              <DirectionChildrenList areas={area.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DirectionsSection({ areas, isLoading, error }) {
  const [openDirectionId, setOpenDirectionId] = useState(null);
  const hasDirections = areas?.length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando direcciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudieron cargar las direcciones.
      </div>
    );
  }

  if (!hasDirections) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay direcciones registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {areas.map(area => {
        const hasChildren = area.children?.length;
        const isOpen = openDirectionId === area.id;
        return (
          <div key={area.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => (hasChildren ? setOpenDirectionId(prev => (prev === area.id ? null : area.id)) : null)}
              aria-expanded={hasChildren ? isOpen : undefined}
              className={classNames(
                'flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2',
                hasChildren ? 'hover:bg-slate-50' : 'cursor-default'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">{area.nombre}</span>
                <span
                  className="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
                  style={getBadgeStyles(area.color_hex)}
                >
                  {area.clave ?? '—'}
                </span>
              </div>
              {hasChildren && (
                <ChevronDown
                  className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
                />
              )}
            </button>
            {hasChildren && isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                <DirectionChildrenList areas={area.children} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChartTypeToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-500">
      <button
        type="button"
        onClick={() => onChange('line')}
        className={classNames(
          'flex items-center gap-1 rounded-full px-3 py-1 transition',
          value === 'line' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-700'
        )}
      >
        <LineChartIcon className="h-3.5 w-3.5" /> Línea
      </button>
      <button
        type="button"
        onClick={() => onChange('bar')}
        className={classNames(
          'flex items-center gap-1 rounded-full px-3 py-1 transition',
          value === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-700'
        )}
      >
        <BarChartHorizontal className="h-3.5 w-3.5" /> Barras
      </button>
    </div>
  );
}

function IndicatorAnalyticsModal({ entry, onClose }) {
  const option = entry?.option;
  const indicator = option?.indicator;
  const templateMeta = option ? TEMPLATE_META[option.templateId] ?? null : null;
  const type = templateMeta?.type;
  const scenario = templateMeta?.scenario ?? null;
  const isFaunaImpactIndicator = useMemo(
    () => isFaunaImpactRateIndicator(indicator),
    [indicator]
  );
  const diffScenario = isFaunaImpactIndicator && type === 'monthly' ? 'BAJO' : null;
  const isSMS01 = indicator?.clave?.toString().trim().toUpperCase() === 'SMS-01';
  const totalsStrategy = isSMS01 || isFaunaImpactIndicator ? 'average' : 'sum';

  const historyQuery = useQuery({
    queryKey: ['indicator-history', indicator?.id],
    queryFn: () => getIndicatorHistory(indicator.id, { limit: 60 }),
    enabled: Boolean(indicator?.id)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', indicator?.id],
    queryFn: () => getIndicatorTargets(indicator.id),
    enabled: shouldFetchTargets
  });

  const analytics = useMemo(() => {
    if (!type) return null;
    return computeAnalytics({
      type,
      scenario,
      history: historyQuery.data ?? [],
      targets: targetsQuery.data ?? [],
      totalsStrategy,
      diffScenario
    });
  }, [historyQuery.data, targetsQuery.data, type, scenario, totalsStrategy, diffScenario]);

  const [chartType, setChartType] = useState('line');
  const [showTrend, setShowTrend] = useState(false);

  const hasForecast = Boolean(analytics?.forecast?.rows?.length);

  useEffect(() => {
    setShowTrend(false);
  }, [indicator?.id]);

  useEffect(() => {
    if (!hasForecast) {
      setShowTrend(false);
    }
  }, [hasForecast]);

  const detailRows = useMemo(() => {
    if (!analytics?.rows?.length) {
      return [];
    }

    const rows = analytics.rows.map(row => ({
      ...row,
      referenceValue: row.referenceValue ?? null,
      rowType: 'history'
    }));

    if (analytics?.totals) {
      const totalLabel = analytics?.totalsStrategy === 'average' ? 'Promedio' : 'Total';
      rows.push({
        period: totalLabel,
        currentValue: analytics.totals.currentValue,
        comparisonValue: analytics.totals.comparisonValue,
        referenceValue: analytics.totals.referenceValue,
        diff: analytics.totals.diff,
        pct: analytics.totals.pct,
        rowType: 'history-total'
      });
    }

    if (showTrend && analytics.forecast?.rows?.length) {
      const forecastRows = analytics.forecast.rows.map(row => ({
        ...row,
        rowType: 'forecast'
      }));
      rows.push(...forecastRows);

      if (analytics.forecast?.totals) {
        const forecastTotalLabel =
          analytics?.totalsStrategy === 'average' ? 'Promedio tendencia' : 'Total tendencia';
        rows.push({
          period: forecastTotalLabel,
          currentValue: analytics.forecast.totals.currentValue,
          comparisonValue: analytics.forecast.totals.comparisonValue,
          referenceValue: analytics.forecast.totals.referenceValue,
          diff: analytics.forecast.totals.diff,
          pct: analytics.forecast.totals.pct,
          rowType: 'forecast-total'
        });
      }
    }

    return rows;
  }, [analytics, showTrend]);

  const chartDataForDisplay = useMemo(() => {
    if (!analytics?.chartData) {
      return [];
    }
    if (showTrend && analytics.forecast?.chartPoints?.length) {
      const baseData = analytics.chartData.map((item, index, array) => {
        if (index === array.length - 1) {
          return { ...item, trend: item.current ?? null };
        }
        return { ...item };
      });
      return [...baseData, ...analytics.forecast.chartPoints];
    }
    return analytics.chartData;
  }, [analytics, showTrend]);

  const chartSeriesForDisplay = useMemo(() => {
    if (!analytics?.chartSeries) {
      return [];
    }
    if (showTrend && analytics.forecast?.series) {
      return [...analytics.chartSeries, analytics.forecast.series];
    }
    return analytics.chartSeries;
  }, [analytics, showTrend]);

  const formatPctValue = value => {
    if (analytics?.type === 'scenario') {
      return value !== null && value !== undefined
        ? `${formatNumber(value * 100, { decimals: 1 })}%`
        : '—';
    }
    if (analytics?.referenceLabel) {
      return value !== null && value !== undefined
        ? `${formatNumber(value * 100, { decimals: 1 })}%`
        : '—';
    }
    return formatPercentage(value);
  };

  const hasComparisonColumn = useMemo(
    () => detailRows.some(row => row.comparisonValue !== null),
    [detailRows]
  );

  const hasReferenceColumn = useMemo(
    () => detailRows.some(row => row.referenceValue !== null),
    [detailRows]
  );

  const comparisonHeaderLabel = analytics?.comparisonLabel ?? 'Comparativo';
  const referenceHeaderLabel = analytics?.referenceLabel ?? (hasReferenceColumn ? 'Meta' : null);
  const variationHeaderLabel = analytics?.referenceLabel
    ? `Var. vs ${analytics.referenceLabel}`
    : 'Variación';
  const pctHeaderLabel =
    analytics?.type === 'scenario'
      ? '% Cumplimiento'
      : analytics?.referenceLabel
        ? '% vs Meta'
        : '% Variación';

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      onClick={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="max-h-[90vh] overflow-y-auto p-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
            <h2 className="text-2xl font-semibold text-slate-900">{indicator?.nombre ?? option?.templateLabel}</h2>
            <p className="text-sm text-slate-500">{option?.templateLabel}</p>
            {indicator?.descripcion ? (
              <p className="text-sm text-slate-500">{indicator.descripcion}</p>
            ) : null}
          </header>

          {historyQuery.isLoading || targetsQuery.isLoading ? (
            <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando información del indicador…
            </div>
          ) : null}

          {historyQuery.error ? (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              No se pudo obtener el histórico del indicador.
            </div>
          ) : null}

          {type === 'scenario' && targetsQuery.error ? (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4" />
              No se pudo obtener la meta configurada para este escenario.
            </div>
          ) : null}

          {!historyQuery.isLoading && !historyQuery.error ? (
            analytics?.rows?.length ? (
              <div className="mt-6 space-y-6">
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Último mes con datos</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {formatMonth(analytics.currentYear, analytics.latestMonth)}
                      </p>
                    </div>
                  </div>
                </section>

                {analytics.summary ? (
                  <section className="space-y-3">
                    <header>
                      <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                        {analytics.summary.title}
                      </h3>
                    </header>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400">{analytics.summary.currentLabel}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatNumber(analytics.summary.currentValue, { decimals: 0 })}
                      </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {analytics.summary.comparisonLabel}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatNumber(analytics.summary.comparisonValue, { decimals: 0 })}
                      </p>
                      {analytics.summary.referenceLabel && analytics.summary.previousValue !== null ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {analytics.summary.previousLabel}:{' '}
                          {formatNumber(analytics.summary.previousValue, { decimals: 0 })}
                        </p>
                      ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {analytics.summary.referenceLabel
                          ? `Variación vs ${analytics.summary.referenceLabel}`
                          : 'Variación'}
                      </p>
                      <p className={`mt-2 text-2xl font-semibold ${getTrendTextClass(analytics.summary.diff)}`}>
                        {formatSignedNumber(analytics.summary.diff)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPctValue(analytics.summary.pct)}</p>
                      {analytics.summary.referenceLabel && analytics.summary.referenceValue !== null ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {analytics.summary.referenceLabel}:{' '}
                          {formatNumber(analytics.summary.referenceValue, { decimals: 0 })}
                        </p>
                      ) : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Gráfica comparativa mensual</h3>
                      <p className="text-xs text-slate-500">
                        Visualice el comportamiento mensual de {analytics.currentYear} comparado con {analytics.comparisonLabel}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={classNames(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                          showTrend && hasForecast
                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600',
                          hasForecast ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 hover:border-slate-200 hover:text-slate-500'
                        )}
                        title={hasForecast ? 'Mostrar tendencia proyectada' : 'Sin datos suficientes para proyectar'}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          checked={showTrend}
                          disabled={!hasForecast}
                          onChange={event => {
                            if (hasForecast) {
                              setShowTrend(event.target.checked);
                            }
                          }}
                        />
                        Tendencia
                      </label>
                      {!hasForecast ? (
                        <span className="text-xs font-medium text-slate-400">Sin datos suficientes</span>
                      ) : null}
                      <ChartTypeToggle value={chartType} onChange={setChartType} />
                    </div>
                  </header>
                  <div className="h-72 w-full">
                    <ChartRenderer chartType={chartType} data={chartDataForDisplay} series={chartSeriesForDisplay} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <header className="border-b border-slate-100 px-5 py-3">
                    <h3 className="text-sm font-semibold text-slate-800">Detalle del periodo</h3>
                  </header>
                  <div className="max-h-72 overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Periodo</th>
                          <th className="px-4 py-2 text-right">Real</th>
                          {hasComparisonColumn ? (
                            <th className="px-4 py-2 text-right">{comparisonHeaderLabel}</th>
                          ) : null}
                          {referenceHeaderLabel ? (
                            <th className="px-4 py-2 text-right">{referenceHeaderLabel}</th>
                          ) : null}
                          <th className="px-4 py-2 text-right">{variationHeaderLabel}</th>
                          <th className="px-4 py-2 text-right">{pctHeaderLabel}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailRows.map((row, index) => {
                          const isForecastRow = row.rowType === 'forecast' || row.rowType === 'forecast-total';
                          const isTotalRow = row.rowType === 'history-total' || row.rowType === 'forecast-total';
                          const key = `${row.rowType ?? 'history'}-${row.period ?? index}-${index}`;
                          return (
                            <tr
                              key={key}
                              className={classNames(
                                'hover:bg-slate-50/60',
                                isForecastRow ? 'bg-violet-50/40' : '',
                                isTotalRow ? 'bg-slate-50/80 font-semibold' : ''
                              )}
                            >
                              <td
                                className={classNames(
                                  'px-4 py-2 text-left text-slate-700',
                                  isForecastRow ? 'text-violet-800' : '',
                                  isTotalRow && !isForecastRow ? 'text-slate-900' : ''
                                )}
                              >
                                {row.period}
                                {isForecastRow ? (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 text-xs font-semibold text-violet-700">
                                    Tendencia
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className={classNames(
                                  'px-4 py-2 text-right',
                                  isForecastRow ? 'text-violet-800' : 'text-slate-900'
                                )}
                              >
                                {formatNumber(row.currentValue, { decimals: 0 })}
                              </td>
                              {hasComparisonColumn ? (
                                <td
                                  className={classNames(
                                    'px-4 py-2 text-right',
                                    isForecastRow ? 'text-violet-700' : 'text-slate-900'
                                  )}
                                >
                                  {formatNumber(row.comparisonValue, { decimals: 0 })}
                                </td>
                              ) : null}
                              {referenceHeaderLabel ? (
                                <td
                                  className={classNames(
                                    'px-4 py-2 text-right',
                                    isForecastRow ? 'text-violet-700' : 'text-slate-900'
                                  )}
                                >
                                  {formatNumber(row.referenceValue, { decimals: 0 })}
                                </td>
                              ) : null}
                              <td
                                className={classNames(
                                  'px-4 py-2 text-right',
                                  isForecastRow ? 'text-violet-700' : getTrendTextClass(row.diff)
                                )}
                              >
                                {formatSignedNumber(row.diff)}
                              </td>
                              <td
                                className={classNames(
                                  'px-4 py-2 text-right',
                                  isForecastRow ? 'text-violet-700' : 'text-slate-500'
                                )}
                              >
                                {formatPctValue(row.pct)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                No hay información suficiente para mostrar este indicador.
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ChartRenderer({ chartType, data, series }) {
  const resolvedSeries = Array.isArray(series) ? series : [];

  if (!data?.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Sin datos suficientes para la gráfica.
      </div>
    );
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RechartsComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" stroke="#1e293b" />
          <YAxis stroke="#1e293b" tickFormatter={value => formatNumber(value, { decimals: 0 })} />
          <Tooltip
            formatter={value => formatNumber(value, { decimals: 0 })}
            labelFormatter={label => label}
          />
          <Legend />
          {resolvedSeries.map(item => {
            const renderer = item.renderer ?? 'bar';
            if (renderer === 'line') {
              const strokeWidth = item.strokeWidth ?? 2;
              const strokeOpacity = item.strokeOpacity ?? 1;
              const dot = item.dot ?? false;
              const activeDot = item.activeDot ?? false;
              return (
                <RechartsLine
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.name}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={item.strokeDasharray}
                  strokeOpacity={strokeOpacity}
                  dot={dot}
                  activeDot={activeDot}
                  connectNulls
                />
              );
            }
            return (
              <RechartsBar
                key={item.key}
                dataKey={item.key}
                name={item.name}
                fill={item.color}
                radius={[4, 4, 0, 0]}
              />
            );
          })}
        </RechartsComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" stroke="#1e293b" />
        <YAxis stroke="#1e293b" tickFormatter={value => formatNumber(value, { decimals: 0 })} />
        <Tooltip
          formatter={value => formatNumber(value, { decimals: 0 })}
          labelFormatter={label => label}
        />
        <Legend />
        {resolvedSeries.map(item => {
          const strokeWidth = item.strokeWidth ?? 2;
          const strokeOpacity = item.strokeOpacity ?? 1;
          const dot = item.dot === undefined ? { r: 3 } : item.dot;
          const activeDot =
            item.activeDot === undefined
              ? dot === false
                ? false
                : { r: 5 }
              : item.activeDot;
          return (
            <RechartsLine
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={item.strokeDasharray}
              strokeOpacity={strokeOpacity}
              dot={dot}
              activeDot={activeDot}
              fill="none"
              connectNulls
            />
          );
        })}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const [openSection, setOpenSection] = useState('operativos');
  const [activeOptionId, setActiveOptionId] = useState(null);


  const areasQuery = useQuery({
    queryKey: ['areas'],
    queryFn: getAreas
  });

  const { sections, optionIndex, indicatorsQuery } = useIndicatorAssignments();

  const directions = useMemo(() => buildAreaTree(areasQuery.data ?? []), [areasQuery.data]);
  const operativeSection = sections.find(section => section.id === 'operativos');
  const fboSection = sections.find(section => section.id === 'fbo');

  const activeEntry = activeOptionId ? optionIndex.get(activeOptionId) ?? null : null;

  const handleCloseModal = () => setActiveOptionId(null);

  return (
    <Fragment>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Panel directivos</h1>
          <p className="text-sm text-slate-500">
            Seleccione una categoría para explorar las opciones de indicadores y direcciones disponibles.
          </p>
        </header>

        <div className="space-y-5">
          <AccordionSection
            id="operativos"
            title="Indicadores Operativos"
            isOpen={openSection === 'operativos'}
            onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
            icon={BarChart3}
          >
            {indicatorsQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando indicadores…
              </div>
            ) : indicatorsQuery.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                No se pudieron cargar los indicadores operativos.
              </div>
            ) : (
              <IndicatorCategoriesList
                categories={operativeSection?.categories}
                onSelectOption={setActiveOptionId}
              />
            )}
          </AccordionSection>

          <AccordionSection
            id="sms"
            title="Indicadores SMS"
            isOpen={openSection === 'sms'}
            onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
            icon={ShieldCheck}
          >
            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <svg
                      className="h-8 w-8 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500"></span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">🚧 Módulo en Reconstrucción</h3>
                  <p className="max-w-md text-base text-slate-700">
                    Los indicadores SMS están siendo reconstruidos con <strong>mejoras significativas</strong>
                  </p>
                </div>

                <div className="mt-4 w-full max-w-2xl">
                  <div className="grid grid-cols-1 gap-3 text-left md:grid-cols-2">
                    {[
                      'Nuevo diseño UI/UX',
                      'Gráficos mejorados',
                      'Filtros avanzados',
                      'Export mejorado (PDF + Excel)',
                      'Comparativas mejoradas',
                      'Performance optimizado'
                    ].map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 w-full max-w-md">
                  <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">Tiempo estimado</p>
                        <p className="mt-0.5 text-xs text-slate-600">En desarrollo activo</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 max-w-lg text-sm italic text-slate-500">
                  Estamos trabajando para ofrecerte la mejor experiencia en el análisis de indicadores de seguridad
                  operacional.
                </p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            id="fbo"
            title="Indicadores FBO (Aviación General)"
            isOpen={openSection === 'fbo'}
            onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
            icon={Plane}
          >
            {indicatorsQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando indicadores…
              </div>
            ) : indicatorsQuery.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                No se pudieron cargar los indicadores FBO.
              </div>
            ) : (
              <IndicatorCategoriesList categories={fboSection?.categories} onSelectOption={setActiveOptionId} />
            )}
          </AccordionSection>

          <AccordionSection
            id="direcciones"
            title="Direcciones"
            isOpen={openSection === 'direcciones'}
            onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
            icon={Users}
          >
            <DirectionsSection areas={directions} isLoading={areasQuery.isLoading} error={areasQuery.error} />
          </AccordionSection>
        </div>
      </div>

      {activeEntry ? <IndicatorAnalyticsModal entry={activeEntry} onClose={handleCloseModal} /> : null}
    </Fragment>
  );
}

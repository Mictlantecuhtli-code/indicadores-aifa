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
  PlaneTakeoff,
  Target,
  Users,
  Weight
} from 'lucide-react';

import { getAreas, getIndicatorHistory, getIndicatorTargets } from '../lib/supabaseClient.js';
import { useIndicatorAssignments } from '../hooks/useIndicatorAssignments.js';
import { formatMonth, formatNumber, formatPercentage, monthName } from '../utils/formatters.js';
import {
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  CartesianGrid,
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
    const scenario = (item?.escenario ?? '').toUpperCase();
    if (!scenario) return;
    if (!map.has(scenario)) {
      map.set(scenario, new Map());
    }
    const year = Number(item?.anio);
    const month = Number(item?.mes ?? 0);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;
    const key = `${year}-${month}`;
    map.get(scenario).set(key, toNumber(item?.valor));
  });
  return map;
}

function formatScenarioLabel(scenario) {
  if (!scenario) return 'Meta';
  switch (scenario.toUpperCase()) {
    case 'BAJO':
      return 'Meta Escenario Bajo';
    case 'MEDIO':
      return 'Meta Escenario Mediano';
    case 'ALTO':
      return 'Meta Escenario Alto';
    default:
      return `Meta Escenario ${scenario}`;
  }
}

function computeMonthlyRows({
  currentYear,
  latestMonth,
  currentYearMonths,
  previousYearMonths,
  previousYear
}) {
  const rows = [];
  for (let month = 1; month <= latestMonth; month += 1) {
    const currentValue = currentYearMonths.get(month) ?? null;
    const previousValue = previousYearMonths.get(month) ?? null;
    if (currentValue === null && previousValue === null) continue;
    const diff =
      currentValue !== null && previousValue !== null ? currentValue - previousValue : null;
    const pct = diff !== null && previousValue ? diff / previousValue : null;
    rows.push({
      period: formatMonth(currentYear, month),
      comparisonPeriod: previousYear ? formatMonth(previousYear, month) : null,
      label: MONTH_SHORT_LABELS[month - 1] ?? String(month),
      currentValue,
      comparisonValue: previousValue,
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
      period: `Trimestre ${quarter}`,
      comparisonPeriod: previousYear ? `Trimestre ${quarter}` : null,
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
    const target = scenarioTargets.get(`${currentYear}-${month}`) ?? null;
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

function computeAnalytics({ type, scenario, history, targets }) {
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

  if (type === 'scenario') {
    const targetsIndex = buildScenarioTargetsIndex(targets);
    const scenarioTargets = targetsIndex.get(scenario) ?? new Map();
    const rows = computeScenarioRows({ currentYear, latestMonth, currentYearMonths, scenarioTargets });
    if (!rows.length) {
      return {
        type,
        scenario,
        currentYear,
        previousYear,
        latestMonth,
        latestRecord,
        rows,
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

  const monthlyRows = computeMonthlyRows({
    currentYear,
    latestMonth,
    currentYearMonths,
    previousYearMonths,
    previousYear
  });

  if (!monthlyRows.length) {
    return null;
  }

  const lastMonthlyRow = monthlyRows[monthlyRows.length - 1];

  const chartData = buildChartData({ rows: monthlyRows, comparisonLabel: previousYear });
  const chartSeries = [
    { key: 'current', name: `${currentYear}`, color: '#2563eb' }
  ];
  if (previousYear) {
    chartSeries.push({ key: 'comparison', name: `${previousYear}`, color: '#10b981' });
  }

  if (type === 'monthly') {
    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: monthlyRows,
      comparisonLabel: previousYear ? `${previousYear}` : 'Periodo anterior',
      summary: {
        title: `Comparación Mensual ${currentYear} vs ${previousYear ?? 'anterior'}`,
        currentLabel: lastMonthlyRow.period,
        comparisonLabel: lastMonthlyRow.comparisonPeriod ?? '',
        currentValue: lastMonthlyRow.currentValue,
        comparisonValue: lastMonthlyRow.comparisonValue,
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
    const lastQuarterRow = quarterRows[quarterRows.length - 1];
    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: quarterRows,
      comparisonLabel: previousYear ? `${previousYear}` : 'Periodo anterior',
      summary: {
        title: `Comparación Trimestral ${currentYear} vs ${previousYear ?? 'anterior'}`,
        currentLabel: lastQuarterRow?.period ?? '',
        comparisonLabel: lastQuarterRow?.comparisonPeriod ?? '',
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
    return {
      type,
      currentYear,
      previousYear,
      latestMonth,
      latestRecord,
      rows: annualRows,
      comparisonLabel: previousYear ? `${previousYear}` : 'Periodo anterior',
      summary: {
        title: `Comparación Anual Acumulada ${currentYear} vs ${previousYear ?? 'anterior'}`,
        currentLabel: annualRow?.period ?? '',
        comparisonLabel: annualRow?.comparisonPeriod ?? '',
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

function buildAreaTree(areas) {
  const byParent = new Map();

  (areas ?? []).forEach(area => {
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

  const historyQuery = useQuery({
    queryKey: ['indicator-history', indicator?.id],
    queryFn: () => getIndicatorHistory(indicator.id, { limit: 60 }),
    enabled: Boolean(indicator?.id)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', indicator?.id],
    queryFn: () => getIndicatorTargets(indicator.id),
    enabled: Boolean(indicator?.id) && type === 'scenario'
  });

  const analytics = useMemo(() => {
    if (!type) return null;
    return computeAnalytics({
      type,
      scenario,
      history: historyQuery.data ?? [],
      targets: targetsQuery.data ?? []
    });
  }, [historyQuery.data, targetsQuery.data, type, scenario]);

  const [chartType, setChartType] = useState('line');

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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Último mes con datos</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {formatMonth(analytics.currentYear, analytics.latestMonth)}
                      </p>
                    </div>
                    <ChartTypeToggle value={chartType} onChange={setChartType} />
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
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Variación</p>
                      <p className={`mt-2 text-2xl font-semibold ${getTrendTextClass(analytics.summary.diff)}`}>
                        {formatSignedNumber(analytics.summary.diff)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPercentage(analytics.summary.pct)}</p>
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
                  </header>
                  <div className="h-72 w-full">
                    <ChartRenderer chartType={chartType} data={analytics.chartData} series={analytics.chartSeries} />
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
                          <th className="px-4 py-2 text-right">
                            {analytics.type === 'scenario' ? analytics.comparisonLabel : analytics.comparisonLabel}
                          </th>
                          <th className="px-4 py-2 text-right">Variación</th>
                          <th className="px-4 py-2 text-right">
                            {analytics.type === 'scenario' ? '% Cumplimiento' : '% Variación'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.rows.map((row, index) => (
                          <tr key={`${row.period}-${index}`} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2 text-left text-slate-700">{row.period}</td>
                            <td className="px-4 py-2 text-right text-slate-900">
                              {formatNumber(row.currentValue, { decimals: 0 })}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-900">
                              {formatNumber(row.comparisonValue, { decimals: 0 })}
                            </td>
                            <td className={`px-4 py-2 text-right text-slate-900 ${getTrendTextClass(row.diff)}`}>
                              {formatSignedNumber(row.diff)}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">
                              {analytics.type === 'scenario'
                                ? row.pct != null
                                  ? `${formatNumber(row.pct * 100, { decimals: 1 })}%`
                                  : '—'
                                : formatPercentage(row.pct)}
                            </td>
                          </tr>
                        ))}
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
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" stroke="#1e293b" />
          <YAxis stroke="#1e293b" tickFormatter={value => formatNumber(value, { decimals: 0 })} />
          <Tooltip
            formatter={value => formatNumber(value, { decimals: 0 })}
            labelFormatter={label => label}
          />
          <Legend />
          {series.map(item => (
            <RechartsBar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[4, 4, 0, 0]} />
          ))}
        </RechartsBarChart>
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
        {series.map(item => (
          <RechartsLine
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.name}
            stroke={item.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            fill="none"
          />
        ))}
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

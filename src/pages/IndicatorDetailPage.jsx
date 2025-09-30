import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  LineChart as LineChartIcon,
  BarChartHorizontal,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { useIndicatorAssignments } from '../hooks/useIndicatorAssignments.js';
import { getIndicatorHistory, getIndicatorTargets } from '../lib/supabaseClient.js';
import { useQuery } from '@tanstack/react-query';
import { formatMonth, formatNumber, formatPercentage } from '../utils/formatters.js';

const VIEW_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'comparativo', label: 'Comparativo real vs meta' },
  { id: 'tendencias', label: 'Tendencias' }
];

const SCENARIOS = [
  { id: 'BAJO', label: 'Escenario bajo' },
  { id: 'MEDIO', label: 'Escenario medio' },
  { id: 'ALTO', label: 'Escenario alto' }
];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SERIES_COLORS = ['#1E3A8A', '#10B981', '#F97316', '#0EA5E9', '#9333EA', '#DC2626'];

function sortHistory(records = []) {
  return [...records]
    .filter(item => item != null)
    .sort((a, b) => {
      if (a.anio === b.anio) {
        return (a.mes ?? 0) - (b.mes ?? 0);
      }
      return a.anio - b.anio;
    });
}

function buildKey(year, month = 0) {
  return `${year}-${String(month ?? 0).padStart(2, '0')}`;
}

function calculateQuarter(month = 1) {
  return Math.max(1, Math.min(4, Math.ceil(month / 3)));
}

function sumByYear(history, year) {
  return history
    .filter(item => item.anio === year)
    .reduce((total, item) => total + (Number(item.valor) || 0), 0);
}

function aggregateQuarterly(history, currentYear, previousYear) {
  const quarters = [1, 2, 3, 4];
  return quarters.map(quarter => {
    const current = history
      .filter(item => item.anio === currentYear && calculateQuarter(item.mes) === quarter)
      .reduce((total, item) => total + (Number(item.valor) || 0), 0);
    const previous = history
      .filter(item => item.anio === previousYear && calculateQuarter(item.mes) === quarter)
      .reduce((total, item) => total + (Number(item.valor) || 0), 0);
    const diff = current - previous;
    const percent = previous ? diff / previous : null;
    return {
      label: `Trimestre ${quarter}`,
      current,
      previous,
      diff,
      percent
    };
  });
}

function buildDashboardChart(history) {
  const years = Array.from(new Set(history.map(item => item.anio))).sort((a, b) => a - b);
  const selectedYears = years.slice(-4);
  if (!selectedYears.length) {
    return { chartData: [], series: [] };
  }
  const chartData = Array.from({ length: 12 }).map((_, index) => {
    const month = index + 1;
    const entry = {
      month,
      label: MONTH_LABELS[index]
    };
    selectedYears.forEach(year => {
      const record = history.find(item => item.anio === year && (item.mes ?? 0) === month);
      entry[year] = record ? Number(record.valor) || null : null;
    });
    return entry;
  });

  const series = selectedYears.map((year, index) => ({
    dataKey: String(year),
    label: `${year}`,
    color: SERIES_COLORS[index % SERIES_COLORS.length]
  }));

  return { chartData, series };
}

function buildComparativoData(history, targetsByScenario, scenario) {
  const lastRecords = history.slice(-12);
  const targetMap = targetsByScenario.get(scenario) ?? new Map();
  return lastRecords.map(item => {
    const key = buildKey(item.anio, item.mes ?? 0);
    const meta = targetMap.get(key) ?? null;
    const real = Number(item.valor) || null;
    const diff = meta != null && real != null ? real - meta : null;
    const compliance = meta ? real / meta : null;
    return {
      period: formatMonth(item.anio, item.mes ?? 1),
      real,
      meta,
      diff,
      compliance
    };
  });
}

function buildTrendData(history) {
  return history.map(item => ({
    period: formatMonth(item.anio, item.mes ?? 1),
    real: Number(item.valor) || null
  }));
}

function buildTargetsIndex(targets = []) {
  const map = new Map();
  targets.forEach(item => {
    const scenario = (item.escenario ?? '').toUpperCase();
    if (!scenario) return;
    if (!map.has(scenario)) {
      map.set(scenario, new Map());
    }
    const key = buildKey(item.anio, item.mes ?? 0);
    map.get(scenario).set(key, Number(item.valor) || null);
  });
  return map;
}

function calculateProjection(history, months = 6) {
  const numericHistory = history
    .filter(item => typeof item.valor === 'number')
    .map((item, index) => ({ ...item, index, valor: Number(item.valor) }));

  if (numericHistory.length < 2) return [];

  const n = numericHistory.length;
  const sumX = numericHistory.reduce((acc, item) => acc + item.index, 0);
  const sumY = numericHistory.reduce((acc, item) => acc + item.valor, 0);
  const sumXY = numericHistory.reduce((acc, item) => acc + item.index * item.valor, 0);
  const sumX2 = numericHistory.reduce((acc, item) => acc + item.index * item.index, 0);
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) return [];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const last = numericHistory[numericHistory.length - 1];
  let year = last.anio;
  let month = last.mes ?? 1;

  const projection = [];
  for (let i = 1; i <= months; i += 1) {
    const nextIndex = last.index + i;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const value = slope * nextIndex + intercept;
    projection.push({
      period: formatMonth(year, month),
      projected: value
    });
  }

  return projection;
}

function ChartTypeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('line')}
        className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          value === 'line' ? 'bg-aifa-blue text-white shadow' : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        <LineChartIcon className="h-4 w-4" />
        Líneas
      </button>
      <button
        type="button"
        onClick={() => onChange('bar')}
        className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          value === 'bar' ? 'bg-aifa-blue text-white shadow' : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        <BarChartHorizontal className="h-4 w-4" />
        Barras
      </button>
    </div>
  );
}

function MultiSeriesChart({ data, series, chartType, xKey = 'label' }) {
  if (!data.length || !series.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60">
        <div className="text-center text-sm text-slate-500">
          <BarChart3 className="mx-auto mb-2 h-6 w-6" />
          No hay información suficiente para graficar.
        </div>
      </div>
    );
  }

  const tooltipFormatter = (value, name) => [formatNumber(value), name];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        {chartType === 'bar' ? (
          <BarChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ borderRadius: '0.75rem', borderColor: '#CBD5F5' }} />
            <Legend />
            {series.map((serie, index) => (
              <Bar
                key={serie.dataKey}
                dataKey={serie.dataKey}
                name={serie.label}
                fill={serie.color ?? SERIES_COLORS[index % SERIES_COLORS.length]}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ borderRadius: '0.75rem', borderColor: '#CBD5F5' }} />
            <Legend />
            {series.map((serie, index) => (
              <Line
                key={serie.dataKey}
                type="monotone"
                dataKey={serie.dataKey}
                name={serie.label}
                stroke={serie.color ?? SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={3}
                dot
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ScenarioToggle({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCENARIOS.map(option => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            value === option.id
              ? 'border-aifa-blue bg-aifa-blue text-white shadow'
              : 'border-slate-200 bg-white text-slate-600 hover:border-aifa-light'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function IndicatorDetailPage() {
  const navigate = useNavigate();
  const { optionId } = useParams();
  const { optionIndex, indicatorsQuery } = useIndicatorAssignments();
  const assignment = optionIndex.get(optionId);
  const indicator = assignment?.option.indicator ?? null;

  const [activeView, setActiveView] = useState('dashboard');
  const [chartType, setChartType] = useState('line');
  const [scenario, setScenario] = useState('BAJO');
  const [showProjection, setShowProjection] = useState(false);

  useEffect(() => {
    if (indicator?.meta_vigente_escenario) {
      const normalized = indicator.meta_vigente_escenario.toUpperCase();
      if (SCENARIOS.some(item => item.id === normalized)) {
        setScenario(normalized);
      }
    }
  }, [indicator?.meta_vigente_escenario]);

  const indicatorId = indicator?.id ?? null;

  const historyQuery = useQuery({
    queryKey: ['indicator-history', indicatorId, { scope: 'detail' }],
    queryFn: () => getIndicatorHistory(indicatorId, { limit: 120 }),
    enabled: Boolean(indicatorId)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', indicatorId, { scope: 'detail' }],
    queryFn: () => getIndicatorTargets(indicatorId),
    enabled: Boolean(indicatorId)
  });

  const history = useMemo(() => sortHistory(historyQuery.data ?? []), [historyQuery.data]);
  const targetsIndex = useMemo(() => buildTargetsIndex(targetsQuery.data ?? []), [targetsQuery.data]);
  const lastMeasurement = history[history.length - 1] ?? null;
  const previousYearMeasurement = lastMeasurement
    ? history.find(
        item =>
          item.anio === lastMeasurement.anio - 1 && (item.mes ?? 0) === (lastMeasurement.mes ?? 0)
      )
    : null;

  const currentYearTotal = lastMeasurement ? sumByYear(history, lastMeasurement.anio) : 0;
  const previousYearTotal = lastMeasurement ? sumByYear(history, lastMeasurement.anio - 1) : 0;
  const quarterlyComparison = lastMeasurement
    ? aggregateQuarterly(history, lastMeasurement.anio, lastMeasurement.anio - 1)
    : [];

  const dashboardChart = useMemo(() => buildDashboardChart(history), [history]);
  const comparativoData = useMemo(
    () => buildComparativoData(history, targetsIndex, scenario),
    [history, targetsIndex, scenario]
  );
  const trendData = useMemo(() => buildTrendData(history), [history]);
  const projectionData = useMemo(() => calculateProjection(history), [history]);

  const comparativoSeries = useMemo(
    () => [
      { dataKey: 'real', label: 'Valor real', color: SERIES_COLORS[0] },
      { dataKey: 'meta', label: 'Meta', color: SERIES_COLORS[2] }
    ],
    []
  );

  const trendSeries = useMemo(() => {
    const base = [{ dataKey: 'real', label: 'Valor real', color: SERIES_COLORS[0] }];
    if (showProjection && projectionData.length) {
      base.push({ dataKey: 'projected', label: 'Proyección', color: SERIES_COLORS[3] });
    }
    return base;
  }, [showProjection, projectionData.length]);

  const trendChartData = useMemo(() => {
    if (!showProjection || !projectionData.length) return trendData;
    return [...trendData, ...projectionData];
  }, [trendData, projectionData, showProjection]);

  const comparativoSummary = comparativoData[comparativoData.length - 1] ?? null;

  const loading = historyQuery.isLoading || targetsQuery.isLoading;

  if (indicatorsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/panel-directivos')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </button>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-80 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/panel-directivos')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </button>
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            No se encontró la opción solicitada. Seleccione un indicador desde el panel.
          </p>
        </div>
      </div>
    );
  }

  if (!indicator) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/panel-directivos')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </button>
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-10 text-center text-amber-700">
          <AlertCircle className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm font-medium">
            La opción seleccionada no tiene un indicador asignado actualmente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/panel-directivos')}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-aifa-light hover:text-aifa-blue"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </button>
        <ChartTypeToggle value={chartType} onChange={setChartType} />
      </div>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-400">Indicador</p>
            <h1 className="text-2xl font-bold text-slate-900">{indicator.nombre}</h1>
            <p className="text-sm text-slate-500">
              {assignment.option.subtitle ?? assignment.option.templateLabel}
            </p>
            {indicator.descripcion && (
              <p className="max-w-2xl text-sm text-slate-500">{indicator.descripcion}</p>
            )}

          </div>
          <div className="rounded-2xl bg-aifa-blue/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-widest text-aifa-blue">Unidad</p>
            <p className="text-sm font-semibold text-aifa-blue">{indicator.unidad_medida ?? '—'}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                activeView === tab.id
                  ? 'bg-aifa-blue text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-aifa-blue/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : (
          <>
            {activeView === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      Último periodo con datos
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-800">
                      {lastMeasurement ? formatMonth(lastMeasurement.anio, lastMeasurement.mes ?? 1) : 'Sin datos'}
                    </p>
                    <div className="mt-4 space-y-1 text-sm text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>Valor actual</span>
                        <span className="font-semibold text-slate-800">
                          {formatNumber(lastMeasurement?.valor)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Valor año anterior</span>
                        <span className="font-semibold text-slate-800">
                          {previousYearMeasurement ? formatNumber(previousYearMeasurement.valor) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Diferencia</span>
                        <span className="font-semibold text-aifa-blue">
                          {lastMeasurement && previousYearMeasurement
                            ? formatNumber(lastMeasurement.valor - previousYearMeasurement.valor)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Total acumulado</p>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-xs text-slate-500">{lastMeasurement?.anio ?? '—'}</p>
                        <p className="text-xl font-semibold text-slate-800">
                          {formatNumber(currentYearTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{lastMeasurement ? lastMeasurement.anio - 1 : '—'}</p>
                        <p className="text-xl font-semibold text-slate-800">
                          {formatNumber(previousYearTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Variación anual</p>
                    <div className="mt-3 flex items-center gap-3">
                      <TrendingUp className="h-8 w-8 text-aifa-blue" />
                      <div>
                        <p className="text-2xl font-semibold text-aifa-blue">
                          {previousYearTotal
                            ? formatPercentage((currentYearTotal - previousYearTotal) / previousYearTotal)
                            : '—'}
                        </p>
                        <p className="text-xs text-slate-500">Respecto al año anterior</p>
                      </div>
                    </div>
                  </div>
                </div>

                {quarterlyComparison.length && (
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Periodo</th>
                          <th className="px-4 py-2 text-right">{lastMeasurement?.anio ?? 'Actual'}</th>
                          <th className="px-4 py-2 text-right">{lastMeasurement ? lastMeasurement.anio - 1 : 'Previo'}</th>
                          <th className="px-4 py-2 text-right">Diferencia</th>
                          <th className="px-4 py-2 text-right">% Variación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quarterlyComparison.map(row => (
                          <tr key={row.label} className="hover:bg-slate-50/80">
                            <td className="px-4 py-2 font-medium text-slate-600">{row.label}</td>
                            <td className="px-4 py-2 text-right text-slate-800">
                              {formatNumber(row.current)}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-800">
                              {formatNumber(row.previous)}
                            </td>
                            <td className="px-4 py-2 text-right text-aifa-blue">
                              {formatNumber(row.diff)}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">
                          {row.percent != null ? formatPercentage(row.percent) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <MultiSeriesChart
                  data={dashboardChart.chartData}
                  series={dashboardChart.series}
                  chartType={chartType}
                />
              </div>
            )}

            {activeView === 'comparativo' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ScenarioToggle value={scenario} onChange={setScenario} />
                  {comparativoSummary && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Último periodo</p>
                      <p className="text-sm font-semibold text-slate-700">{comparativoSummary.period}</p>
                      <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500">Real</p>
                          <p className="font-semibold text-slate-800">
                            {formatNumber(comparativoSummary.real)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Meta</p>
                          <p className="font-semibold text-slate-800">
                            {formatNumber(comparativoSummary.meta)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">% Cumplimiento</p>
                          <p className="font-semibold text-aifa-blue">
                            {comparativoSummary.compliance
                              ? formatPercentage(comparativoSummary.compliance)
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Periodo</th>
                        <th className="px-4 py-2 text-right">Real</th>
                        <th className="px-4 py-2 text-right">Meta</th>
                        <th className="px-4 py-2 text-right">Diferencia</th>
                        <th className="px-4 py-2 text-right">% Cumplimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparativoData.map(row => (
                        <tr key={row.period} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2 text-slate-600">{row.period}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-800">
                            {formatNumber(row.real)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-800">
                            {formatNumber(row.meta)}
                          </td>
                          <td className="px-4 py-2 text-right text-aifa-blue">{formatNumber(row.diff)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">
                            {row.compliance ? formatPercentage(row.compliance) : '—'}
                          </td>
                        </tr>
                      ))}
                      {!comparativoData.length && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            No hay datos suficientes para calcular el comparativo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <MultiSeriesChart
                  data={comparativoData}
                  series={comparativoSeries}
                  chartType={chartType}
                  xKey="period"
                />
              </div>
            )}

            {activeView === 'tendencias' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Consulta el comportamiento histórico completo y proyecta los próximos meses según la tendencia actual.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowProjection(prev => !prev)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      showProjection
                        ? 'border-aifa-blue bg-aifa-blue text-white shadow'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-aifa-light'
                    }`}
                  >
                    {showProjection ? 'Ocultar proyección' : 'Mostrar proyección'}
                  </button>
                </div>

                <MultiSeriesChart
                  data={trendChartData}
                  series={trendSeries}
                  chartType={chartType}
                  xKey="period"
                />

                {showProjection && projectionData.length ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Periodo proyectado</th>
                          <th className="px-4 py-2 text-right">Valor esperado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {projectionData.map(item => (
                          <tr key={item.period} className="hover:bg-slate-50/80">
                            <td className="px-4 py-2 text-slate-600">{item.period}</td>
                            <td className="px-4 py-2 text-right font-medium text-aifa-blue">
                              {formatNumber(item.projected)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

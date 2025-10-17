import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  supabase,
  getIndicatorHistory
} from '../../lib/supabaseClient.js';
import { formatMonth, formatValueByUnit, monthName } from '../../utils/formatters.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

const RUNWAY_COLORS = ['#2563EB', '#F97316', '#059669', '#7C3AED'];

const DEFAULT_THRESHOLDS = {
  confiabilidad: [
    { key: 'objective', label: 'Objetivo', value: 90, color: '#0EA5E9' },
    { key: 'alert-1', label: 'Nivel de alerta 1', value: 87, color: '#FACC15' },
    { key: 'alert-2', label: 'Nivel de alerta 2', value: 83, color: '#FB923C' },
    { key: 'alert-3', label: 'Nivel de alerta 3', value: 80, color: '#F87171' }
  ],
  disponibilidad: [
    { key: 'objective', label: 'Objetivo', value: 90, color: '#0EA5E9' },
    { key: 'alert-1', label: 'Nivel de alerta 1', value: 87, color: '#FACC15' },
    { key: 'alert-2', label: 'Nivel de alerta 2', value: 83, color: '#FB923C' },
    { key: 'alert-3', label: 'Nivel de alerta 3', value: 80, color: '#F87171' }
  ]
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObservaciones(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  return {};
}

function buildSeries(indicator) {
  const runways = Array.isArray(indicator?._runwayMetricRunways) && indicator._runwayMetricRunways.length
    ? indicator._runwayMetricRunways
    : ['04C-22C', '04L-22R'];

  return runways.map((runway, index) => ({
    runway,
    dataKey: `runway_${index}`,
    color: RUNWAY_COLORS[index % RUNWAY_COLORS.length],
    name: `Pista ${runway}`
  }));
}

function buildRunwayDataset(history = [], series = []) {
  if (!history?.length || !series.length) {
    return {
      latestYear: null,
      latestLabel: null,
      latestValues: {},
      chartData: []
    };
  }

  const normalized = history
    .map(item => ({
      anio: Number(item.anio),
      mes: Number(item.mes ?? 0),
      observaciones: parseObservaciones(item.observaciones),
      valor: toNumber(item.valor)
    }))
    .filter(item => Number.isFinite(item.anio) && Number.isFinite(item.mes) && item.mes > 0)
    .sort((a, b) => {
      if (a.anio === b.anio) {
        return a.mes - b.mes;
      }
      return a.anio - b.anio;
    });

  if (!normalized.length) {
    return {
      latestYear: null,
      latestLabel: null,
      latestValues: {},
      chartData: []
    };
  }

  const latest = normalized[normalized.length - 1];
  const latestValues = {};

  series.forEach(serie => {
    const runwayValue = toNumber(latest.observaciones?.[serie.runway]);
    latestValues[serie.runway] = runwayValue != null ? runwayValue : null;
  });

  const latestYear = latest.anio;

  const chartData = normalized
    .filter(item => item.anio === latestYear)
    .map(item => {
      const row = {
        key: `${item.anio}-${item.mes}`,
        month: item.mes,
        label: monthName(item.mes),
        fullLabel: formatMonth(item.anio, item.mes)
      };

      series.forEach(serie => {
        const runwayValue = toNumber(item.observaciones?.[serie.runway]);
        row[serie.dataKey] = runwayValue != null ? runwayValue : null;
      });

      return row;
    });

  return {
    latestYear,
    latestLabel: formatMonth(latest.anio, latest.mes),
    latestValues,
    chartData
  };
}

function RunwayTooltip({ active, payload, unit, series }) {
  if (!active || !payload?.length) {
    return null;
  }

  const { fullLabel } = payload[0]?.payload ?? {};

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-700">{fullLabel}</p>
      <ul className="mt-2 space-y-1">
        {series.map(serie => {
          const match = payload.find(item => item.dataKey === serie.dataKey);
          const value = match?.value;
          return (
            <li key={serie.dataKey} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: serie.color }}
                />
                {serie.name}
              </span>
              <span className="font-semibold text-slate-800">
                {value != null
                  ? formatValueByUnit(value, unit, {
                      numberDecimals: 2,
                      percentageDecimals: 2,
                      percentageScale: 'percentage'
                    })
                  : 'Sin dato'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SMSRunwayMetricModal({
  indicator,
  unit,
  onClose,
  series,
  chartData,
  thresholds,
  latestYear,
  yDomain
}) {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
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
            <h2 className="text-2xl font-semibold text-slate-900">{indicator?.nombre}</h2>
            {indicator?.descripcion ? (
              <p className="text-sm text-slate-500">{indicator.descripcion}</p>
            ) : null}
            {latestYear ? (
              <p className="text-sm text-slate-500">Datos del año {latestYear}</p>
            ) : null}
          </header>

          {chartData.length ? (
            <div className="mt-6 space-y-6">
              <section className="space-y-4">
                <div className="h-80 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="label"
                        stroke="#1E293B"
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        tickMargin={8}
                      />
                      <YAxis
                        stroke="#1E293B"
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        tickFormatter={value =>
                          formatValueByUnit(value, unit, {
                            numberDecimals: 0,
                            percentageDecimals: 2,
                            percentageScale: 'percentage'
                          })
                        }
                        width={70}
                        domain={yDomain}
                      />
                      <Tooltip content={<RunwayTooltip unit={unit} series={series} />} />
                      <Legend />
                      {thresholds.map(threshold => (
                        <ReferenceLine
                          key={threshold.key}
                          y={threshold.value}
                          stroke={threshold.color}
                          strokeDasharray="6 6"
                          label={{
                            value: `${threshold.label}: ${formatValueByUnit(threshold.value, unit, {
                              numberDecimals: 2,
                              percentageDecimals: 2,
                              percentageScale: 'percentage'
                            })}`,
                            fill: threshold.color,
                            fontSize: 11,
                            position: 'right'
                          }}
                        />
                      ))}
                      {series.map(serie => (
                        <Bar
                          key={serie.dataKey}
                          dataKey={serie.dataKey}
                          name={serie.name}
                          fill={serie.color}
                          radius={[6, 6, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Valores mensuales</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Mes</th>
                        {series.map(serie => (
                          <th key={serie.dataKey} className="px-4 py-3 text-left font-semibold text-slate-600">
                            {serie.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chartData.map(row => (
                        <tr key={row.key} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{row.fullLabel}</td>
                          {series.map(serie => {
                            const value = row[serie.dataKey];
                            return (
                              <td key={`${row.key}-${serie.dataKey}`} className="px-4 py-3 font-medium text-slate-700">
                                {value != null
                                  ? formatValueByUnit(value, unit, {
                                      numberDecimals: 2,
                                      percentageDecimals: 2,
                                      percentageScale: 'percentage'
                                    })
                                  : 'Sin dato'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No hay datos registrados para este indicador.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SMSRunwayMetricCard({ indicator }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const unit = indicator?.unidad_medida;
  const series = useMemo(() => buildSeries(indicator), [indicator]);
  const thresholds = useMemo(() => {
    const customThresholds = Array.isArray(indicator?._runwayMetricThresholds)
      ? indicator._runwayMetricThresholds
      : null;

    const base = customThresholds && customThresholds.length
      ? customThresholds
      : DEFAULT_THRESHOLDS[indicator?._runwayMetricType] ?? [];

    return base
      .map(item => ({ ...item, value: toNumber(item.value) }))
      .filter(item => item.value != null);
  }, [indicator]);

  const historyQuery = useQuery({
    queryKey: ['indicator-history', indicator?.id],
    queryFn: () => getIndicatorHistory(indicator.id, { limit: 120 }),
    enabled: Boolean(indicator?.id)
  });

  useEffect(() => {
    if (!indicator?.id) {
      return undefined;
    }

    const channel = supabase
      .channel(`realtime-runway-${indicator.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mediciones',
          filter: `indicador_id=eq.${indicator.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['indicator-history', indicator.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [indicator?.id, queryClient]);

  const { latestYear, latestLabel, latestValues, chartData } = useMemo(
    () => buildRunwayDataset(historyQuery.data ?? [], series),
    [historyQuery.data, series]
  );

  const yDomain = useMemo(() => {
    const values = [];

    chartData.forEach(row => {
      series.forEach(serie => {
        const value = toNumber(row[serie.dataKey]);
        if (value != null) {
          values.push(value);
        }
      });
    });

    thresholds.forEach(threshold => {
      if (threshold?.value != null) {
        values.push(threshold.value);
      }
    });

    if (!values.length) {
      return [0, 100];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(1, Math.ceil((max - min) * 0.1));
    const lower = Math.max(0, Math.floor((min - padding) / 5) * 5);
    const upper = Math.ceil((max + padding) / 5) * 5;

    return [lower, upper <= lower ? lower + 5 : upper];
  }, [chartData, series, thresholds]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const handleKeyDownCard = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal();
    }
  };

  return (
    <article
      className="cursor-pointer rounded-2xl bg-white p-4 shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light/80 focus-visible:ring-offset-2"
      role="button"
      tabIndex={0}
      onClick={openModal}
      onKeyDown={handleKeyDownCard}
      aria-label={indicator?.nombre ? `Ver detalle del indicador ${indicator.nombre}` : 'Ver detalle del indicador'}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{indicator?.nombre}</h3>
          {indicator?.descripcion ? (
            <p className="text-sm text-slate-500">{indicator.descripcion}</p>
          ) : null}
          {latestLabel ? (
            <p className="text-xs text-slate-500">Última medición registrada: {latestLabel}</p>
          ) : (
            <p className="text-xs text-slate-400">Sin mediciones registradas.</p>
          )}
        </div>

        {historyQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando información…
          </div>
        ) : historyQuery.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No se pudieron obtener los datos históricos de este indicador.
          </div>
        ) : chartData.length ? (
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:grid-cols-2">
            {series.map(serie => {
              const value = latestValues[serie.runway];
              return (
                <div key={serie.dataKey} className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{serie.name}</p>
                  <p className="text-2xl font-semibold text-aifa-blue">
                    {value != null
                      ? formatValueByUnit(value, unit, {
                          numberDecimals: 2,
                          percentageDecimals: 2,
                          percentageScale: 'percentage'
                        })
                      : 'Sin dato'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Aún no hay datos capturados para este indicador.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>{latestYear ? `Datos disponibles para ${latestYear}` : 'Sin datos recientes'}</span>
          <span className="font-semibold text-aifa-blue">Haz clic para ver detalle</span>
        </div>
      </div>

      {isModalOpen ? (
        <SMSRunwayMetricModal
          indicator={indicator}
          unit={unit}
          onClose={() => setIsModalOpen(false)}
          series={series}
          chartData={chartData}
          thresholds={thresholds}
          latestYear={latestYear}
          yDomain={yDomain}
        />
      ) : null}
    </article>
  );
}

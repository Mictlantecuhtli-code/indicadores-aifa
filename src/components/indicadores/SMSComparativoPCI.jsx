import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  getIndicatorHistory
} from '../../lib/supabaseClient.js';
import { formatMonth, formatValueByUnit } from '../../utils/formatters.js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend
} from 'recharts';

const YEARS = [2023, 2024, 2025];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function resolveObservaciones(record) {
  return (
    record?.observaciones ??
    record?.observacion ??
    record?.nota ??
    record?.notas ??
    record?.comentarios ??
    record?.comentario ??
    record?.observaciones_validacion ??
    ''
  );
}

function buildComparativoData(historyA = [], historyB = [], year) {
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  return months.map(month => {
    const recordA = historyA.find(item => item.anio === year && (item.mes ?? 0) === month);
    const recordB = historyB.find(item => item.anio === year && (item.mes ?? 0) === month);
    return {
      month,
      label: MONTH_LABELS[month - 1] ?? `${month}`,
      fullLabel: formatMonth(year, month),
      pistaA: recordA ? toNumber(recordA.valor) : null,
      pistaB: recordB ? toNumber(recordB.valor) : null,
      observacionesA: recordA ? resolveObservaciones(recordA) : '',
      observacionesB: recordB ? resolveObservaciones(recordB) : ''
    };
  });
}

function calculateAverage(history = [], year) {
  const rows = history.filter(item => item.anio === year).map(item => toNumber(item.valor)).filter(value => value != null);
  if (!rows.length) return null;
  const sum = rows.reduce((acc, value) => acc + value, 0);
  return sum / rows.length;
}

function calculateStatus(value, meta) {
  if (meta == null || value == null) {
    return {
      label: 'Sin meta',
      badge: 'bg-slate-100 text-slate-600'
    };
  }

  if (value >= meta) {
    return {
      label: 'En meta',
      badge: 'bg-emerald-100 text-emerald-700'
    };
  }

  if (value >= meta * 0.9) {
    return {
      label: 'Cercano a meta',
      badge: 'bg-amber-100 text-amber-700'
    };
  }

  return {
    label: 'Fuera de meta',
    badge: 'bg-rose-100 text-rose-700'
  };
}

function ComparativeTooltip({ active, payload, label, unidadMedidaA, unidadMedidaB }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload ?? null;

  return (
    <div className="min-w-[16rem] rounded-xl border border-slate-200 bg-gray-100/95 p-3 text-sm text-gray-800 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{point?.fullLabel ?? label}</p>
      <div className="mt-2 space-y-2 text-sm">
        {payload.map(item => {
          const unit = item.dataKey === 'pistaA' ? unidadMedidaA : unidadMedidaB;
          const formattedValue =
            item.value != null
              ? formatValueByUnit(item.value, unit, {
                  numberDecimals: 2,
                  percentageDecimals: 3,
                  percentageScale: 'percentage'
                })
              : 'Sin dato';

          return (
            <div key={item.dataKey} className="flex flex-col gap-0.5">
              <span className="font-semibold" style={{ color: item.color }}>
                {item.name}: {formattedValue}
              </span>
            <span className="text-xs text-slate-500">
              {item.dataKey === 'pistaA' ? point?.observacionesA || 'Sin observaciones' : point?.observacionesB || 'Sin observaciones'}
            </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SMSComparativoPCI({ indicadorA, indicadorB, meta = 70 }) {
  const [year, setYear] = useState(() => {
    const current = new Date().getFullYear();
    return YEARS.includes(current) ? current : YEARS[0];
  });

  const queryClient = useQueryClient();

  const historyQueryA = useQuery({
    queryKey: ['indicator-history', indicadorA?.id],
    queryFn: () => getIndicatorHistory(indicadorA.id, { limit: 120 }),
    enabled: Boolean(indicadorA?.id)
  });

  const historyQueryB = useQuery({
    queryKey: ['indicator-history', indicadorB?.id],
    queryFn: () => getIndicatorHistory(indicadorB.id, { limit: 120 }),
    enabled: Boolean(indicadorB?.id)
  });

  useEffect(() => {
    if (!indicadorA?.id) return undefined;
    const channel = supabase
      .channel(`realtime-comparativo-${indicadorA.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mediciones',
          filter: `indicador_id=eq.${indicadorA.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['indicator-history', indicadorA.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [indicadorA?.id, queryClient]);

  useEffect(() => {
    if (!indicadorB?.id) return undefined;
    const channel = supabase
      .channel(`realtime-comparativo-${indicadorB.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mediciones',
          filter: `indicador_id=eq.${indicadorB.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['indicator-history', indicadorB.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [indicadorB?.id, queryClient]);

  const { chartData, promedioA, promedioB, statusA, statusB } = useMemo(() => {
    const historyA = sortHistory(historyQueryA.data ?? []);
    const historyB = sortHistory(historyQueryB.data ?? []);
    const data = buildComparativoData(historyA, historyB, year);
    const avgA = calculateAverage(historyA, year);
    const avgB = calculateAverage(historyB, year);
    return {
      chartData: data,
      promedioA: avgA,
      promedioB: avgB,
      statusA: calculateStatus(avgA, meta),
      statusB: calculateStatus(avgB, meta)
    };
  }, [historyQueryA.data, historyQueryB.data, year, meta]);

  const loading = historyQueryA.isLoading || historyQueryB.isLoading;
  const error = historyQueryA.error || historyQueryB.error;
  const unidadMedidaA = indicadorA?.unidad_medida;
  const unidadMedidaB = indicadorB?.unidad_medida;
  const axisUnit = unidadMedidaA ?? unidadMedidaB;
  const formattedMeta = formatValueByUnit(meta, axisUnit, {
    numberDecimals: 0,
    percentageDecimals: 3,
    percentageScale: 'percentage'
  });
  const referenceLabel = formattedMeta !== '—' ? `Meta ${formattedMeta}` : 'Meta';

  return (
    <section className="rounded-2xl bg-white p-4 shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Comparativo de PCI entre Pistas (04C–22C vs 04L–22R)</h3>
          <p className="text-sm text-slate-500">
            Seguimiento paralelo del desempeño PCI de las pistas estratégicas.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Año</span>
          <select
            value={year}
            onChange={event => setYear(Number(event.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-aifa-light focus:outline-none focus:ring-2 focus:ring-aifa-light/30"
          >
            {YEARS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudo cargar la información comparativa de PCI.
        </div>
      ) : chartData.length ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">SMS-05A · Pista 04C–22C</p>
                  <p className="text-lg font-bold text-aifa-blue">
                    {promedioA != null
                      ? formatValueByUnit(promedioA, unidadMedidaA, {
                          numberDecimals: 2,
                          percentageDecimals: 3,
                          percentageScale: 'percentage'
                        })
                      : 'Sin dato'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusA.badge}`}>{statusA.label}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">SMS-05B · Pista 04L–22R</p>
                  <p className="text-lg font-bold text-aifa-green">
                    {promedioB != null
                      ? formatValueByUnit(promedioB, unidadMedidaB, {
                          numberDecimals: 2,
                          percentageDecimals: 3,
                          percentageScale: 'percentage'
                        })
                      : 'Sin dato'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusB.badge}`}>{statusB.label}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-72 transition-all duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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
                      formatValueByUnit(value, axisUnit, {
                        numberDecimals: 0,
                        percentageDecimals: 3,
                        percentageScale: 'percentage'
                      })}
                    width={70}
                  />
                  <Tooltip
                    content={
                      <ComparativeTooltip
                        unidadMedidaA={unidadMedidaA}
                        unidadMedidaB={unidadMedidaB}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={meta}
                    stroke="#d9534f"
                    strokeDasharray="6 4"
                    label={{
                      value: referenceLabel,
                      fill: '#d9534f',
                      fontSize: 11,
                      position: 'insideTopRight'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pistaA"
                    name="SMS-05A · 04C–22C"
                    stroke="#1E3A8A"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#1E3A8A', fill: '#fff' }}
                    activeDot={{ r: 6, stroke: '#1E3A8A', strokeWidth: 2, fill: '#3B82F6' }}
                    connectNulls={false}
                    isAnimationActive
                  />
                  <Line
                    type="monotone"
                    dataKey="pistaB"
                    name="SMS-05B · 04L–22R"
                    stroke="#047857"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#047857', fill: '#fff' }}
                    activeDot={{ r: 6, stroke: '#047857', strokeWidth: 2, fill: '#34D399' }}
                    connectNulls={false}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No hay datos suficientes para construir el comparativo.
        </div>
      )}
    </section>
  );
}

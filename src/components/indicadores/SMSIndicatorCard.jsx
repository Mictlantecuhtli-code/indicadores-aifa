import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  getIndicatorHistory,
  getIndicatorTargets
} from '../../lib/supabaseClient.js';
import { formatMonth, formatValueByUnit } from '../../utils/formatters.js';
import IndicadorHeader from './IndicadorHeader.jsx';
import IndicadorDetalle from './IndicadorDetalle.jsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import SMSCapturaFaunaCard from './SMSCapturaFaunaCard.jsx';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function extractMetaAnual(targets = [], fallback) {
  const normalized = targets
    .map(item => ({
      ...item,
      valor: toNumber(item?.valor),
      mes: item?.mes ?? null,
      escenario: item?.escenario ?? ''
    }))
    .filter(item => item.valor != null);

  const byNullMonth = normalized.find(item => item.mes === null || Number(item.mes) === 0);
  if (byNullMonth) return byNullMonth.valor;

  const byScenario = normalized.find(item => {
    const text = (item.escenario ?? '').toString().toLowerCase();
    return text.includes('meta') || text.includes('objetivo') || text.includes('anual');
  });
  if (byScenario) return byScenario.valor;

  if (normalized.length) {
    return normalized[normalized.length - 1].valor;
  }

  const fallbackValue = toNumber(fallback);
  return fallbackValue ?? null;
}

function buildChartData(history = [], year, metaAnual) {
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const rows = months.map(month => {
    const record = history.find(item => item.anio === year && (item.mes ?? 0) === month);
    const value = record ? toNumber(record.valor) : null;
    return {
      month,
      label: MONTH_LABELS[month - 1] ?? `${month}`,
      fullLabel: formatMonth(year, month),
      valor: value,
      observaciones: record ? resolveObservaciones(record) : '',
      meta: metaAnual ?? null
    };
  });

  return rows;
}

function calculateStatus(value, meta) {
  if (meta == null || value == null) {
    return {
      label: 'Sin meta registrada',
      badge: 'bg-slate-100 text-slate-600',
      text: 'text-slate-500'
    };
  }

  if (value >= meta) {
    return {
      label: 'En meta',
      badge: 'bg-emerald-100 text-emerald-700',
      text: 'text-aifa-green'
    };
  }

  if (value >= meta * 0.9) {
    return {
      label: 'Cercano a la meta',
      badge: 'bg-amber-100 text-amber-700',
      text: 'text-amber-600'
    };
  }

  return {
    label: 'Fuera de meta',
    badge: 'bg-rose-100 text-rose-700',
    text: 'text-rose-600'
  };
}

function SMSChartTooltip({ active, payload, label, unidadMedida }) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload ?? null;
  const valueEntry = payload.find(item => item.dataKey === 'valor');
  const value = valueEntry?.value ?? null;
  const observations = datum?.observaciones;

  return (
    <div className="min-w-[14rem] rounded-xl border border-slate-200 bg-gray-100/95 p-3 text-sm text-gray-800 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{datum?.fullLabel ?? label}</p>
      <p className="mt-1 text-lg font-bold text-aifa-blue">
        {value != null
          ? formatValueByUnit(value, unidadMedida, {
              numberDecimals: 2,
              percentageDecimals: 3,
              percentageScale: 'percentage'
            })
          : 'Sin dato'}
      </p>
      {observations ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{observations}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Sin observaciones registradas</p>
      )}
    </div>
  );
}

function normalizeIndicatorName(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isFaunaCaptureIndicator(indicator) {
  if (!indicator) return false;
  if (Array.isArray(indicator._faunaSourceIds) && indicator._faunaSourceIds.length) {
    return true;
  }

  const code = indicator?.clave?.toString().trim().toUpperCase();
  if (code === 'SMS-02' || code === 'SMS-FAUNA') {
    return true;
  }

  const name = normalizeIndicatorName(indicator?.nombre);
  if (!name) return false;
  if (name.includes('captura') && name.includes('fauna')) return true;
  if (name.includes('capturas por especie')) return true;
  return false;
}

export default function SMSIndicatorCard({ indicator }) {
  if (isFaunaCaptureIndicator(indicator)) {
    return <SMSCapturaFaunaCard indicator={indicator} />;
  }

  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['indicator-history', indicator?.id],
    queryFn: () => getIndicatorHistory(indicator.id, { limit: 120 }),
    enabled: Boolean(indicator?.id)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', indicator?.id],
    queryFn: () => getIndicatorTargets(indicator.id),
    enabled: Boolean(indicator?.id)
  });

  useEffect(() => {
    if (!indicator?.id) return undefined;

    const channel = supabase
      .channel(`realtime-sms-${indicator.id}`)
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

  const { latestRecord, latestYear, chartData, metaAnual, status, detalleRegistros } = useMemo(() => {
    const history = sortHistory(historyQuery.data ?? []);
    if (!history.length) {
      return {
        latestRecord: null,
        latestYear: null,
        chartData: [],
        metaAnual: null,
        status: calculateStatus(null, null),
        detalleRegistros: []
      };
    }

    const latest = history[history.length - 1];
    const latestYearValue = history.reduce((year, item) => Math.max(year, Number(item.anio) || year), latest?.anio ?? null);
    const meta = extractMetaAnual(targetsQuery.data ?? [], indicator?.meta_anual);
    const chartRows = buildChartData(history, latestYearValue, meta);
    const detailRows = history
      .filter(item => item.anio === latestYearValue)
      .map(item => ({
        ...item,
        valor: toNumber(item.valor),
        observaciones: resolveObservaciones(item)
      }));

    const lastValue = toNumber(latest?.valor);

    return {
      latestRecord: latest ? { ...latest, valor: lastValue } : null,
      latestYear: latestYearValue,
      chartData: chartRows,
      metaAnual: meta,
      status: calculateStatus(lastValue, meta),
      detalleRegistros: detailRows
    };
  }, [historyQuery.data, targetsQuery.data, indicator?.meta_anual]);

  const loading = historyQuery.isLoading || targetsQuery.isLoading;
  const error = historyQuery.error || targetsQuery.error;
  const unidadMedida = indicator?.unidad_medida;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-md">
      <div className="space-y-5">
        <IndicadorHeader
          nombre={indicator?.nombre}
          descripcion={indicator?.descripcion}
          unidadMedida={indicator?.unidad_medida}
          metaAnual={metaAnual}
        />

        {loading ? (
          <div className="space-y-4">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No se pudieron obtener los datos históricos de este indicador.
          </div>
        ) : chartData.length ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:grid-cols-3">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Último valor registrado</p>
                <p className="mt-2 text-3xl font-bold text-aifa-blue">
                  {latestRecord?.valor != null
                    ? formatValueByUnit(latestRecord.valor, unidadMedida, {
                        numberDecimals: 2,
                        percentageDecimals: 3,
                        percentageScale: 'percentage'
                      })
                    : 'Sin dato'}
                </p>
                <p className="text-sm text-slate-500">
                  {latestRecord ? formatMonth(latestRecord.anio, latestRecord.mes ?? 1) : 'Pendiente de captura'}
                </p>
              </div>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                <span className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
                  {status.label}
                </span>
                <p className={`text-sm font-semibold ${status.text}`}>
                  {metaAnual != null && latestRecord?.valor != null
                    ? `${formatValueByUnit(latestRecord.valor - metaAnual, unidadMedida, {
                        numberDecimals: 2,
                        percentageDecimals: 3,
                        percentageScale: 'percentage'
                      })} vs meta`
                    : 'Sin referencia'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Comportamiento mensual {latestYear}</h3>
                  <p className="text-xs text-slate-500">
                    Valores capturados del indicador durante el año en curso.
                  </p>
                </div>
              </div>
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
                        formatValueByUnit(value, unidadMedida, {
                          numberDecimals: 0,
                          percentageDecimals: 3,
                          percentageScale: 'percentage'
                        })}
                      width={70}
                    />
                    <Tooltip content={<SMSChartTooltip unidadMedida={unidadMedida} />} />
                    {metaAnual != null ? (
                      <ReferenceLine
                        y={metaAnual}
                        stroke="#d9534f"
                        strokeDasharray="6 4"
                        label={{ value: 'Meta anual', fill: '#d9534f', fontSize: 11, position: 'insideTopRight' }}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="valor"
                      name="Valor real"
                      stroke="#1E3A8A"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, stroke: '#1E3A8A', fill: '#fff' }}
                      activeDot={{ r: 6, stroke: '#1E3A8A', strokeWidth: 2, fill: '#3B82F6' }}
                      connectNulls={false}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <IndicadorDetalle
              registros={detalleRegistros}
              year={latestYear}
              unidadMedida={unidadMedida}
              percentageScale="percentage"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Aún no hay datos para este indicador.
          </div>
        )}
      </div>
    </article>
  );
}

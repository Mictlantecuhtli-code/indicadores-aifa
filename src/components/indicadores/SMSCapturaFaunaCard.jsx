import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  getCapturasFaunaResumen,
  getIndicatorTargets
} from '../../lib/supabaseClient.js';
import { formatMonth, formatValueByUnit } from '../../utils/formatters.js';
import IndicadorHeader from './IndicadorHeader.jsx';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SPECIES_SERIES = [
  { key: 'aves', name: 'Ave', color: '#2563EB' },
  { key: 'mamiferos', name: 'Mamífero', color: '#B45309' },
  { key: 'reptiles', name: 'Reptil', color: '#059669' }
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function buildChartRows(records = [], year) {
  const yearRecords = records.filter(item => item.anio === year);
  if (!yearRecords.length) return [];

  const sorted = [...yearRecords].sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0));
  return sorted.map(item => {
    const aves = toNumber(item.aves) ?? 0;
    const mamiferos = toNumber(item.mamiferos) ?? 0;
    const reptiles = toNumber(item.reptiles) ?? 0;
    const total = toNumber(item.total_mes);
    const month = Number(item.mes ?? 0);

    return {
      month,
      label: MONTH_LABELS[month - 1] ?? `${month}`,
      fullLabel: formatMonth(item.anio, month || 1),
      aves,
      mamiferos,
      reptiles,
      total: total ?? aves + mamiferos + reptiles
    };
  });
}

function buildTableRows(records = [], year) {
  const yearRecords = records.filter(item => item.anio === year);
  const sorted = [...yearRecords]
    .map(item => ({
      anio: Number(item.anio),
      mes: Number(item.mes ?? 0),
      total: toNumber(item.total_mes)
    }))
    .filter(item => Number.isFinite(item.mes) && item.total != null)
    .sort((a, b) => a.mes - b.mes);

  return sorted.map(item => ({
    key: `${item.anio}-${item.mes}`,
    periodo: formatMonth(item.anio, item.mes),
    total: item.total
  }));
}

function CapturasTooltip({ active, payload, unidadMedida }) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload ?? null;
  if (!datum) return null;

  return (
    <div className="min-w-[14rem] rounded-xl border border-slate-200 bg-gray-100/95 p-3 text-sm text-gray-800 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{datum.fullLabel}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {SPECIES_SERIES.map(series => (
          <li key={series.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.name}
            </span>
            <span className="font-semibold text-slate-800">
              {formatValueByUnit(datum[series.key] ?? 0, unidadMedida, {
                numberDecimals: 0,
                percentageDecimals: 3,
                percentageScale: 'percentage'
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        Total: {formatValueByUnit(datum.total ?? 0, unidadMedida, {
          numberDecimals: 0,
          percentageDecimals: 3,
          percentageScale: 'percentage'
        })}
      </p>
    </div>
  );
}

function CapturasTable({ rows, year, unidadMedida }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-md">
      <header className="border-b border-slate-100 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Detalle mensual</h3>
          {year ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {year}
            </span>
          ) : null}
        </div>
      </header>
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Total de capturas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 text-left text-slate-700">{row.periodo}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                  {formatValueByUnit(row.total ?? 0, unidadMedida, {
                    numberDecimals: 0,
                    percentageDecimals: 3,
                    percentageScale: 'percentage'
                  })}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-400">
                  No se han registrado capturas para el periodo seleccionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SMSCapturaFaunaCard({ indicator }) {
  const queryClient = useQueryClient();
  const faunaSourceIds = useMemo(() => {
    if (!indicator) return [];
    if (Array.isArray(indicator._faunaSourceIds)) {
      return indicator._faunaSourceIds.filter(Boolean);
    }
    return [];
  }, [indicator]);

  const capturasQuery = useQuery({
    queryKey: ['capturas-fauna-resumen'],
    queryFn: () => getCapturasFaunaResumen()
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', indicator?.id],
    queryFn: () => getIndicatorTargets(indicator.id),
    enabled: Boolean(indicator?.id) && !indicator?._isSynthetic
  });

  useEffect(() => {
    const ids = [
      ...faunaSourceIds,
      indicator?.id && !indicator?._isSynthetic ? indicator.id : null
    ].filter(Boolean);
    if (!ids.length) {
      return undefined;
    }

    const channel = supabase.channel(`realtime-fauna-${ids.join('-')}`);

    ids.forEach(id => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mediciones',
          filter: `indicador_id=eq.${id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['capturas-fauna-resumen'] });
          if (indicator?.id && !indicator?._isSynthetic) {
            queryClient.invalidateQueries({ queryKey: ['indicator-targets', indicator.id] });
          }
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [indicator?.id, faunaSourceIds, queryClient]);

  const { latestRecord, latestYear, chartData, metaAnual, status, tableRows } = useMemo(() => {
    const records = Array.isArray(capturasQuery.data) ? capturasQuery.data : [];
    if (!records.length) {
      return {
        latestRecord: null,
        latestYear: null,
        chartData: [],
        metaAnual: extractMetaAnual(targetsQuery.data ?? [], indicator?.meta_anual),
        status: calculateStatus(null, null),
        tableRows: []
      };
    }

    const normalized = records
      .map(item => ({
        ...item,
        anio: Number(item.anio),
        mes: Number(item.mes ?? 0)
      }))
      .filter(item => Number.isFinite(item.anio));

    if (!normalized.length) {
      return {
        latestRecord: null,
        latestYear: null,
        chartData: [],
        metaAnual: extractMetaAnual(targetsQuery.data ?? [], indicator?.meta_anual),
        status: calculateStatus(null, null),
        tableRows: []
      };
    }

    const latestYearValue = normalized.reduce((acc, item) => Math.max(acc, item.anio), normalized[0].anio);
    const chartRows = buildChartRows(normalized, latestYearValue);
    const tableRowsData = buildTableRows(normalized, latestYearValue);
    const lastRecord = chartRows.length ? chartRows[chartRows.length - 1] : null;
    const meta = extractMetaAnual(targetsQuery.data ?? [], indicator?.meta_anual);
    const lastValue = lastRecord?.total ?? null;

    return {
      latestRecord: lastRecord ? { ...lastRecord, anio: latestYearValue } : null,
      latestYear: latestYearValue,
      chartData: chartRows,
      metaAnual: meta,
      status: calculateStatus(lastValue, meta),
      tableRows: tableRowsData
    };
  }, [capturasQuery.data, targetsQuery.data, indicator?.meta_anual]);

  const loading = capturasQuery.isLoading || targetsQuery.isLoading;
  const error = capturasQuery.error || targetsQuery.error;
  const unidadMedida = indicator?.unidad_medida;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-md">
      <div className="space-y-5">
        <IndicadorHeader
          nombre={indicator?.nombre ?? 'Captura de Fauna'}
          descripcion={indicator?.descripcion}
          unidadMedida={unidadMedida}
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
            No se pudieron obtener los datos de capturas de fauna.
          </div>
        ) : chartData.length ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:grid-cols-3">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Último total registrado</p>
                <p className="mt-2 text-3xl font-bold text-aifa-blue">
                  {latestRecord?.total != null
                    ? formatValueByUnit(latestRecord.total, unidadMedida, {
                        numberDecimals: 0,
                        percentageDecimals: 3,
                        percentageScale: 'percentage'
                      })
                    : 'Sin dato'}
                </p>
                <p className="text-sm text-slate-500">
                  {latestRecord ? formatMonth(latestRecord.anio, latestRecord.month ?? 1) : 'Pendiente de captura'}
                </p>
              </div>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                <span className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
                  {status.label}
                </span>
                <p className={`text-sm font-semibold ${status.text}`}>
                  {metaAnual != null && latestRecord?.total != null
                    ? `${formatValueByUnit(latestRecord.total - metaAnual, unidadMedida, {
                        numberDecimals: 0,
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
                  <h3 className="text-sm font-semibold text-slate-800">Capturas acumuladas por especie {latestYear}</h3>
                  <p className="text-xs text-slate-500">
                    Distribución mensual de capturas de aves, mamíferos y reptiles.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {SPECIES_SERIES.map(series => (
                    <span key={series.key} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: series.color }}
                      />
                      {series.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-72 transition-all duration-300">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
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
                        })
                      }
                      width={70}
                    />
                    <Tooltip content={<CapturasTooltip unidadMedida={unidadMedida} />} />
                    {SPECIES_SERIES.map(series => (
                      <Bar
                        key={series.key}
                        dataKey={series.key}
                        name={series.name}
                        stackId="capturas"
                        fill={series.color}
                        radius={series.key === 'reptiles' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      >
                        {series.key === 'reptiles' ? (
                          <LabelList
                            dataKey="total"
                            position="top"
                            className="fill-slate-700 text-[11px] font-semibold"
                          />
                        ) : null}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <CapturasTable rows={tableRows} year={latestYear} unidadMedida={unidadMedida} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Aún no hay datos de capturas de fauna para mostrar.
          </div>
        )}
      </div>
    </article>
  );
}

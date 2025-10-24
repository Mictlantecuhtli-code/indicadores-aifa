import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets
} from '../lib/supabaseClient.js';
import { formatMonth, formatNumber } from '../utils/formatters.js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { Filter, BarChart3 } from 'lucide-react';

function IndicatorHistoryChart({ history = [], targets = [] }) {
  const chartData = useMemo(() => {
    const rows = new Map();

    history.forEach(item => {
      const key = `${item.anio}-${item.mes}`;
      const value =
        item.valor ?? item.valor_medido ?? item.valor_real ?? item.valor_actual ?? item.cantidad ?? null;
      rows.set(key, {
        key,
        label: formatMonth(item.anio, item.mes ?? 1),
        real: value !== null && value !== undefined ? Number(value) : null
      });
    });

    targets.forEach(item => {
      const key = `${item.anio}-${item.mes}`;
      const scenario = (item.escenario ?? 'meta').toString().toLowerCase();
      const existing = rows.get(key) ?? {
        key,
        label: formatMonth(item.anio, item.mes ?? 1)
      };
      const value = item.valor ?? item.valor_meta ?? item.meta ?? null;
      rows.set(key, {
        ...existing,
        [`meta_${scenario}`]: value !== null && value !== undefined ? Number(value) : null
      });
    });

    return Array.from(rows.values()).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [history, targets]);

  if (!chartData.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/80">
        <div className="text-center text-sm text-slate-500">
          <BarChart3 className="mx-auto mb-2 h-6 w-6" />
          No hay suficientes datos históricos para graficar este indicador.
        </div>
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value, name) => [formatNumber(value, { maximumFractionDigits: 1 }), name]}
            contentStyle={{ borderRadius: '0.75rem', borderColor: '#CBD5F5' }}
          />
          <Legend />
          <Line type="monotone" dataKey="real" name="Valor real" stroke="#1E3A8A" strokeWidth={3} dot />
          <Line type="monotone" dataKey="meta_bajo" name="Meta escenario bajo" stroke="#F97316" strokeDasharray="6 3" />
          <Line type="monotone" dataKey="meta_medio" name="Meta escenario medio" stroke="#0EA5E9" strokeDasharray="6 3" />
          <Line type="monotone" dataKey="meta_alto" name="Meta escenario alto" stroke="#059669" strokeDasharray="6 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function VisualizationPage() {
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const areaOptions = useMemo(() => {
    const areasMap = new Map();
    (indicatorsQuery.data ?? []).forEach(item => {
      const rawId = item.area_id ?? item.areaId ?? item.area ?? item.area_nombre;
      const areaName = item.area_nombre ?? item.area ?? 'Sin área asignada';
      const key = rawId === null || rawId === undefined ? 'sin-area' : String(rawId);
      if (!areasMap.has(key)) {
        areasMap.set(key, { id: key, name: areaName });
      }
    });
    return Array.from(areasMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [indicatorsQuery.data]);

  const indicatorsByArea = useMemo(() => {
    if (!selectedArea) return [];
    return (indicatorsQuery.data ?? [])
      .filter(item => {
        const areaId = item.area_id ?? item.areaId ?? item.area ?? item.area_nombre;
        return String(areaId) === String(selectedArea);
      })
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
  }, [indicatorsQuery.data, selectedArea]);

  useEffect(() => {
    if (!areaOptions.length) return;
    setSelectedArea(prev => prev ?? areaOptions[0]?.id ?? null);
  }, [areaOptions]);

  useEffect(() => {
    if (!indicatorsByArea.length) {
      setSelectedIndicator(null);
      return;
    }
    setSelectedIndicator(prev => {
      if (prev && indicatorsByArea.some(indicator => indicator.id === prev)) {
        return prev;
      }
      return indicatorsByArea[0]?.id ?? null;
    });
  }, [indicatorsByArea]);

  const activeIndicator = useMemo(() => {
    if (!selectedIndicator) return null;
    return (indicatorsQuery.data ?? []).find(item => item.id === selectedIndicator) ?? null;
  }, [indicatorsQuery.data, selectedIndicator]);

  const historyQuery = useQuery({
    queryKey: ['visualization-history', selectedIndicator],
    queryFn: () => getIndicatorHistory(selectedIndicator, { limit: 36 }),
    enabled: Boolean(selectedIndicator)
  });

  const targetsQuery = useQuery({
    queryKey: ['visualization-targets', selectedIndicator],
    queryFn: () => getIndicatorTargets(selectedIndicator),
    enabled: Boolean(selectedIndicator)
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visualización de indicadores</h1>
          <p className="text-sm text-slate-500">
            Seleccione el área y posteriormente el indicador para consultar su tendencia histórica.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Área</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedArea ?? ''}
              onChange={event => setSelectedArea(event.target.value || null)}
              className="w-full border-none bg-transparent text-sm focus:outline-none"
            >
              {areaOptions.map(area => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="flex flex-col gap-2 md:col-span-1 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Indicador</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedIndicator ?? ''}
              onChange={event => setSelectedIndicator(event.target.value || null)}
              className="w-full border-none bg-transparent text-sm focus:outline-none"
              disabled={!indicatorsByArea.length}
            >
              {indicatorsByArea.map(indicator => (
                <option key={indicator.id} value={indicator.id}>
                  {indicator.nombre}
                </option>
              ))}
            </select>
          </div>
          {!indicatorsByArea.length && (
            <p className="text-xs text-slate-400">No hay indicadores registrados para el área seleccionada.</p>
          )}
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-6 shadow">
            <p className="text-xs uppercase tracking-widest text-slate-400">Área seleccionada</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-800">
              {areaOptions.find(area => area.id === selectedArea)?.name ?? 'Seleccione un área'}
            </h2>
            {activeIndicator?.area_estructura && (
              <p className="mt-3 text-sm text-slate-500">{activeIndicator.area_estructura}</p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <p className="text-xs uppercase tracking-widest text-slate-400">Indicador</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-800">
              {activeIndicator?.nombre ?? 'Seleccione un indicador'}
            </h2>
            {activeIndicator?.descripcion && (
              <p className="mt-3 text-sm text-slate-500">{activeIndicator.descripcion}</p>
            )}
            <div className="mt-4 grid gap-3 text-sm text-slate-500">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Unidad</p>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {activeIndicator?.unidad_medida ?? 'No definida'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Meta vigente</p>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {formatNumber(activeIndicator?.meta_vigente_valor)}
                </p>
                <p className="text-xs text-slate-500">Escenario {activeIndicator?.meta_vigente_escenario ?? '—'}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Tendencia histórica</h3>
            {historyQuery.isFetching && <span className="text-xs text-slate-400">Actualizando datos...</span>}
          </div>
          <IndicatorHistoryChart history={historyQuery.data ?? []} targets={targetsQuery.data ?? []} />
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Periodo</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Escenario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(historyQuery.data ?? []).map(item => (
                  <tr key={item.id ?? `${item.anio}-${item.mes}`}> 
                    <td className="px-4 py-2 text-slate-600">{formatMonth(item.anio, item.mes ?? 1)}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{
                      formatNumber(
                        item.valor ??
                          item.valor_medido ??
                          item.valor_real ??
                          item.valor_actual ??
                          item.cantidad
                      )
                    }</td>
                    <td className="px-4 py-2 text-right text-slate-500">{item.escenario ?? '—'}</td>
                  </tr>
                ))}
                {!historyQuery.data?.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      No hay registros históricos para este indicador.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

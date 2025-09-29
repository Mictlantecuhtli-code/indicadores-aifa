import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardSummary,
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets
} from '../lib/supabaseClient.js';
import { formatMonth, formatNumber, formatPercentage } from '../utils/formatters.js';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { AlertTriangle, BarChart3, Clock, Plane, TrendingUp } from 'lucide-react';
import classNames from 'classnames';

const OPERATIVE_NAMES = [
  'Aviación Comercial Pasajeros',
  'Aviación Comercial Operaciones',
  'Aviación Carga Operaciones',
  'Aviación Carga Toneladas'
];

const FBO_NAMES = ['Aviación General Pasajeros', 'Aviación General Operaciones'];

const SUMMARY_FIELDS = [
  { key: 'total_indicadores', label: 'Indicadores monitoreados', icon: BarChart3 },
  { key: 'indicadores_con_metas', label: 'Indicadores con metas', icon: TrendingUp },
  { key: 'indicadores_sin_actualizar', label: 'Indicadores pendientes', icon: Clock },
  { key: 'porcentaje_cumplimiento', label: 'Cumplimiento promedio', icon: Plane, type: 'percentage' }
];

function IndicatorButton({ indicator, active, onClick }) {
  const Icon = OPERATIVE_NAMES.includes(indicator.nombre) ? Plane : TrendingUp;
  return (
    <button
      onClick={onClick}
      className={classNames(
        'w-full rounded-xl border px-4 py-3 text-left transition-all',
        active
          ? 'border-transparent bg-gradient-to-r from-aifa-blue to-aifa-light text-white shadow-lg shadow-aifa-blue/30'
          : 'border-slate-200 bg-white text-slate-700 hover:border-aifa-light hover:bg-aifa-light/10'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{indicator.nombre}</p>
          <p className="text-xs text-slate-400">{indicator.area_nombre}</p>
        </div>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>
          Última medición:
          <strong className="ml-1 text-slate-900">
            {formatNumber(indicator.ultima_medicion_valor)} {indicator.unidad_medida ?? ''}
          </strong>
        </span>
        {indicator.ultima_medicion_fecha && (
          <span>
            Actualizado {new Date(indicator.ultima_medicion_fecha).toLocaleDateString('es-MX')}
          </span>
        )}
      </div>
    </button>
  );
}

function SummaryCards({ summary, loading }) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_FIELDS.map(field => (
          <div key={field.key} className="animate-pulse rounded-2xl bg-white/60 p-6 shadow">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  const data = summary?.[0] ?? {};
  const fields = SUMMARY_FIELDS.filter(field => field.key in data);

  if (!fields.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {fields.map(field => {
        const Icon = field.icon;
        const value = data[field.key];
        const formattedValue = field.type === 'percentage' ? formatPercentage(value) : formatNumber(value);
        return (
          <div
            key={field.key}
            className="relative overflow-hidden rounded-2xl bg-white p-6 shadow transition hover:shadow-lg"
          >
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-aifa-light/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">{field.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-800">{formattedValue}</p>
              </div>
              <span className="rounded-full bg-aifa-light/10 p-3 text-aifa-blue">
                <Icon className="h-6 w-6" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndicatorChart({ history = [], targets = [] }) {
  const chartData = useMemo(() => {
    if (!history.length && !targets.length) return [];

    const rows = new Map();

    history.forEach(item => {
      const key = `${item.anio}-${item.mes}`;
      rows.set(key, {
        key,
        label: formatMonth(item.anio, item.mes ?? 1),
        real: item.valor ? Number(item.valor) : null,
        escenario: item.escenario ?? null
      });
    });

    targets.forEach(item => {
      const key = `${item.anio}-${item.mes}`;
      const scenario = typeof item.escenario === 'string' ? item.escenario.toLowerCase() : 'meta';
      const existing = rows.get(key) ?? {
        key,
        label: formatMonth(item.anio, item.mes ?? 1)
      };
      rows.set(key, {
        ...existing,
        [`meta_${scenario}`]: item.valor ? Number(item.valor) : null
      });
    });

    return Array.from(rows.values()).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [history, targets]);

  if (!chartData.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60">
        <div className="text-center text-sm text-slate-500">
          <BarChart3 className="mx-auto mb-2 h-6 w-6" />
          No hay datos suficientes para mostrar la gráfica
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 16, bottom: 12 }}>
          <defs>
            <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value, name) => [formatNumber(value, { maximumFractionDigits: 1 }), name]}
            contentStyle={{ borderRadius: '0.75rem', borderColor: '#CBD5F5' }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="real"
            name="Valor real"
            stroke="#1E3A8A"
            fillOpacity={1}
            fill="url(#colorReal)"
            strokeWidth={3}
            dot
          />
          <Area type="monotone" dataKey="meta_bajo" name="Meta escenario bajo" stroke="#F97316" fill="none" strokeDasharray="5 5" strokeWidth={2} />
          <Area type="monotone" dataKey="meta_medio" name="Meta escenario medio" stroke="#047857" fill="none" strokeDasharray="5 5" strokeWidth={2} />
          <Area type="monotone" dataKey="meta_alto" name="Meta escenario alto" stroke="#0EA5E9" fill="none" strokeDasharray="5 5" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const operativeIndicators = useMemo(
    () => (indicatorsQuery.data ?? []).filter(item => OPERATIVE_NAMES.includes(item.nombre)),
    [indicatorsQuery.data]
  );
  const fboIndicators = useMemo(
    () => (indicatorsQuery.data ?? []).filter(item => FBO_NAMES.includes(item.nombre)),
    [indicatorsQuery.data]
  );

  useEffect(() => {
    if (!selectedIndicator && (operativeIndicators.length || fboIndicators.length)) {
      setSelectedIndicator((operativeIndicators[0] ?? fboIndicators[0])?.id ?? null);
    }
  }, [selectedIndicator, operativeIndicators, fboIndicators]);

  const activeIndicator = useMemo(
    () => (indicatorsQuery.data ?? []).find(item => item.id === selectedIndicator) ?? null,
    [indicatorsQuery.data, selectedIndicator]
  );

  const historyQuery = useQuery({
    queryKey: ['indicator-history', selectedIndicator],
    queryFn: () => getIndicatorHistory(selectedIndicator, { limit: 36 }),
    enabled: Boolean(selectedIndicator)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', selectedIndicator],
    queryFn: () => getIndicatorTargets(selectedIndicator),
    enabled: Boolean(selectedIndicator)
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel estratégico de indicadores</h1>
          <p className="text-sm text-slate-500">
            Seguimiento ejecutivo de los indicadores clave de operación del Aeropuerto Internacional Felipe Ángeles.
          </p>
        </div>
        {activeIndicator?.ultima_medicion_alerta && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {activeIndicator.ultima_medicion_alerta}
          </div>
        )}
      </div>

      <SummaryCards summary={summaryQuery.data} loading={summaryQuery.isLoading} />

      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Indicadores operativos</h2>
              <span className="rounded-full bg-aifa-light/10 px-2 py-0.5 text-xs font-medium text-aifa-blue">
                {operativeIndicators.length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {operativeIndicators.map(indicator => (
                <IndicatorButton
                  key={indicator.id}
                  indicator={indicator}
                  active={indicator.id === selectedIndicator}
                  onClick={() => setSelectedIndicator(indicator.id)}
                />
              ))}
              {!operativeIndicators.length && <p className="text-sm text-slate-400">No se encontraron indicadores operativos.</p>}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Indicadores FBO</h2>
              <span className="rounded-full bg-aifa-light/10 px-2 py-0.5 text-xs font-medium text-aifa-blue">{fboIndicators.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {fboIndicators.map(indicator => (
                <IndicatorButton
                  key={indicator.id}
                  indicator={indicator}
                  active={indicator.id === selectedIndicator}
                  onClick={() => setSelectedIndicator(indicator.id)}
                />
              ))}
              {!fboIndicators.length && <p className="text-sm text-slate-400">No se encontraron indicadores FBO.</p>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-800">{activeIndicator?.nombre ?? 'Seleccione un indicador'}</h2>
                {activeIndicator?.descripcion && (
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">{activeIndicator.descripcion}</p>
                )}
              </div>
              {activeIndicator?.unidad_medida && (
                <div className="rounded-xl bg-aifa-blue/10 px-4 py-2 text-right">
                  <p className="text-xs uppercase tracking-widest text-aifa-blue">Unidad</p>
                  <p className="text-sm font-semibold text-aifa-blue">{activeIndicator.unidad_medida}</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Valor actual</p>
                <p className="mt-2 text-2xl font-semibold text-slate-800">
                  {formatNumber(activeIndicator?.ultima_medicion_valor)}
                </p>
                {activeIndicator?.ultima_medicion_fecha && (
                  <p className="text-xs text-slate-500">
                    Actualizado {new Date(activeIndicator.ultima_medicion_fecha).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Meta vigente</p>
                <p className="mt-2 text-2xl font-semibold text-slate-800">
                  {formatNumber(activeIndicator?.meta_vigente_valor)}
                </p>
                {activeIndicator?.meta_vigente_escenario && (
                  <p className="text-xs text-slate-500">Escenario {activeIndicator.meta_vigente_escenario}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <IndicatorChart history={historyQuery.data ?? []} targets={targetsQuery.data ?? []} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Historial reciente</h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Periodo</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Escenario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(historyQuery.data ?? []).slice(-12).map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2 text-slate-600">{formatMonth(item.anio, item.mes ?? 1)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">{formatNumber(item.valor)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{item.escenario ?? '—'}</td>
                    </tr>
                  ))}
                  {!historyQuery.data?.length && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        No hay mediciones registradas para este indicador.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

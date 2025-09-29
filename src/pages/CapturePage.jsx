import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets,
  saveMeasurement,
  upsertTarget
} from '../lib/supabaseClient.js';
import { formatMonth, formatNumber } from '../utils/formatters.js';
import { CheckCircle2, Loader2, PlusCircle, Target } from 'lucide-react';

const SCENARIOS = [
  { value: 'BAJO', label: 'Escenario bajo' },
  { value: 'MEDIO', label: 'Escenario medio' },
  { value: 'ALTO', label: 'Escenario alto' }
];

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex items-start gap-4">
        <span className="rounded-xl bg-aifa-blue/10 p-3 text-aifa-blue">
          <Icon className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function CapturePage() {
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const currentYear = new Date().getFullYear();

  const queryClient = useQueryClient();
  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const indicatorsOptions = useMemo(
    () =>
      (indicatorsQuery.data ?? []).map(item => ({
        value: item.id,
        label: item.nombre,
        area: item.area_nombre,
        unidad: item.unidad_medida
      })),
    [indicatorsQuery.data]
  );

  useEffect(() => {
    if (!selectedIndicator && indicatorsOptions.length) {
      setSelectedIndicator(indicatorsOptions[0].value);
    }
  }, [selectedIndicator, indicatorsOptions]);

  const historyQuery = useQuery({
    queryKey: ['indicator-history', selectedIndicator],
    queryFn: () => getIndicatorHistory(selectedIndicator, { limit: 12 }),
    enabled: Boolean(selectedIndicator)
  });

  const targetsQuery = useQuery({
    queryKey: ['indicator-targets', selectedIndicator, currentYear],
    queryFn: () => getIndicatorTargets(selectedIndicator, { year: currentYear }),
    enabled: Boolean(selectedIndicator)
  });

  const measurementForm = useForm({
    defaultValues: {
      anio: currentYear,
      mes: new Date().getMonth() + 1,
      valor: '',
      escenario: 'REAL'
    }
  });

  const targetForm = useForm({
    defaultValues: {
      anio: currentYear,
      mes: new Date().getMonth() + 1,
      escenario: 'MEDIO',
      valor: ''
    }
  });

  const measurementMutation = useMutation({
    mutationFn: payload => saveMeasurement(payload),
    onSuccess: () => {
      measurementForm.reset({
        anio: currentYear,
        mes: new Date().getMonth() + 1,
        valor: '',
        escenario: 'REAL'
      });
      queryClient.invalidateQueries({ queryKey: ['indicator-history', selectedIndicator] });
    }
  });

  const targetMutation = useMutation({
    mutationFn: payload => upsertTarget(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicator-targets', selectedIndicator, currentYear] });
    }
  });

  const onSubmitMeasurement = measurementForm.handleSubmit(values => {
    if (!selectedIndicator) return;
    measurementMutation.mutate({
      indicador_id: selectedIndicator,
      anio: Number(values.anio),
      mes: Number(values.mes),
      valor: Number(values.valor),
      escenario: values.escenario
    });
  });

  const onSubmitTarget = targetForm.handleSubmit(values => {
    if (!selectedIndicator) return;
    targetMutation.mutate({
      indicador_id: selectedIndicator,
      anio: Number(values.anio),
      mes: Number(values.mes),
      escenario: values.escenario,
      valor: Number(values.valor)
    });
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Captura de indicadores</h1>
          <p className="text-sm text-slate-500">
            Actualice mediciones reales y metas estratégicas para mantener el panel de directivos siempre vigente.
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Indicador</span>
          <select
            value={selectedIndicator ?? ''}
            onChange={event => setSelectedIndicator(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
          >
            {indicatorsOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.area}
              </option>
            ))}
          </select>
        </label>
        {selectedIndicator && (
          <p className="mt-2 text-xs text-slate-500">
            Unidad de medida:{' '}
            <span className="font-semibold text-slate-700">
              {indicatorsOptions.find(option => option.value === selectedIndicator)?.unidad ?? 'No definida'}
            </span>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Registrar medición"
          description="Capture el valor real observado para el periodo seleccionado."
          icon={PlusCircle}
        >
          <form onSubmit={onSubmitMeasurement} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Año
              <input
                type="number"
                min="2020"
                max="2100"
                {...measurementForm.register('anio', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mes
              <select
                {...measurementForm.register('mes', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                  <option key={month} value={month}>
                    {formatMonth(currentYear, month)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Escenario
              <select
                {...measurementForm.register('escenario', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                <option value="REAL">Valor real</option>
                {SCENARIOS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Valor
              <input
                type="number"
                step="0.01"
                {...measurementForm.register('valor', { required: true, min: 0 })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow hover:bg-aifa-light focus:outline-none focus:ring-2 focus:ring-aifa-blue/30 disabled:cursor-not-allowed"
                disabled={measurementMutation.isPending}
              >
                {measurementMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Guardar medición
              </button>
              {measurementMutation.isError && (
                <p className="mt-2 text-xs text-red-500">
                  No fue posible guardar la medición: {measurementMutation.error.message}
                </p>
              )}
              {measurementMutation.isSuccess && (
                <p className="mt-2 text-xs text-green-600">Medición registrada correctamente.</p>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Actualizar meta"
          description="Registre la meta del indicador para el periodo seleccionado en el escenario deseado."
          icon={Target}
        >
          <form onSubmit={onSubmitTarget} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Año
              <input
                type="number"
                min="2020"
                max="2100"
                {...targetForm.register('anio', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mes
              <select
                {...targetForm.register('mes', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                  <option key={month} value={month}>
                    {formatMonth(currentYear, month)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Escenario
              <select
                {...targetForm.register('escenario', { required: true })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                {SCENARIOS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Valor meta
              <input
                type="number"
                step="0.01"
                {...targetForm.register('valor', { required: true, min: 0 })}
                className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-aifa-green px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-aifa-green/30 disabled:cursor-not-allowed"
                disabled={targetMutation.isPending}
              >
                {targetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Guardar meta
              </button>
              {targetMutation.isError && (
                <p className="mt-2 text-xs text-red-500">
                  No fue posible guardar la meta: {targetMutation.error.message}
                </p>
              )}
              {targetMutation.isSuccess && (
                <p className="mt-2 text-xs text-green-600">Meta registrada correctamente.</p>
              )}
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Mediciones recientes</h3>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Periodo</th>
                  <th className="px-4 py-2 text-left">Escenario</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(historyQuery.data ?? []).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2 text-slate-600">{formatMonth(item.anio, item.mes ?? 1)}</td>
                    <td className="px-4 py-2 text-slate-500">{item.escenario ?? 'REAL'}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{formatNumber(item.valor)}</td>
                  </tr>
                ))}
                {!historyQuery.data?.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      Sin mediciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Metas del año</h3>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Periodo</th>
                  <th className="px-4 py-2 text-left">Escenario</th>
                  <th className="px-4 py-2 text-right">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(targetsQuery.data ?? []).map(item => (
                  <tr key={item.id ?? `${item.anio}-${item.mes}-${item.escenario}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2 text-slate-600">{formatMonth(item.anio, item.mes)}</td>
                    <td className="px-4 py-2 text-slate-500">{item.escenario}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{formatNumber(item.valor)}</td>
                  </tr>
                ))}
                {!targetsQuery.data?.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No hay metas registradas para este año.
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

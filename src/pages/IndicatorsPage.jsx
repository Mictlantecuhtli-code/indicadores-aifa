import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIndicators } from '../lib/supabaseClient.js';
import { formatNumber } from '../utils/formatters.js';
import { Download, Filter } from 'lucide-react';

function exportToCSV(indicators) {
  const headers = [
    'Indicador',
    'Área',
    'Unidad',
    'Meta vigente',
    'Escenario meta',
    'Último valor',
    'Fecha actualización'
  ];
  const rows = indicators.map(item => [
    item.nombre,
    item.area_nombre,
    item.unidad_medida,
    item.meta_vigente_valor,
    item.meta_vigente_escenario,
    item.ultima_medicion_valor,
    item.ultima_medicion_fecha ? new Date(item.ultima_medicion_fecha).toLocaleDateString('es-MX') : ''
  ]);
  const csv = [headers, ...rows]
    .map(row =>
      row
        .map(value => {
          if (value === null || value === undefined) return '';
          const strValue = String(value);
          if (strValue.includes(',') || strValue.includes('"')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'indicadores.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default function IndicatorsPage() {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('todos');

  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const areas = useMemo(() => {
    const names = new Set();
    (indicatorsQuery.data ?? []).forEach(item => {
      if (item.area_nombre) {
        names.add(item.area_nombre);
      }
    });
    return Array.from(names).sort();
  }, [indicatorsQuery.data]);

  const filteredIndicators = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (indicatorsQuery.data ?? []).filter(indicator => {
      const matchesTerm =
        !term ||
        indicator.nombre?.toLowerCase().includes(term) ||
        indicator.area_nombre?.toLowerCase().includes(term) ||
        indicator.codigo?.toLowerCase?.().includes(term);
      const matchesArea = area === 'todos' || indicator.area_nombre === area;
      return matchesTerm && matchesArea;
    });
  }, [indicatorsQuery.data, search, area]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consulta de indicadores</h1>
          <p className="text-sm text-slate-500">Filtre y exporte los indicadores operativos del aeropuerto.</p>
        </div>
        <button
          type="button"
          onClick={() => exportToCSV(filteredIndicators)}
          className="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow hover:bg-aifa-light"
          disabled={!filteredIndicators.length}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-3">
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Buscar</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por indicador, área o código"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
          />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Área</span>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={area}
              onChange={event => setArea(event.target.value)}
              className="w-full border-none bg-transparent text-sm focus:outline-none"
            >
              <option value="todos">Todas las áreas</option>
              {areas.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Indicador</th>
              <th className="px-4 py-3 text-left">Área</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-right">Meta vigente</th>
              <th className="px-4 py-3 text-right">Escenario</th>
              <th className="px-4 py-3 text-right">Último valor</th>
              <th className="px-4 py-3 text-right">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredIndicators.map(indicator => (
              <tr key={indicator.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{indicator.nombre}</p>
                  {indicator.codigo && <p className="text-xs text-slate-400">{indicator.codigo}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{indicator.area_nombre}</td>
                <td className="px-4 py-3 text-slate-600">{indicator.unidad_medida ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatNumber(indicator.meta_vigente_valor)}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{indicator.meta_vigente_escenario ?? '—'}</td>
                <td className="px-4 py-3 text-right text-slate-800">
                  {formatNumber(indicator.ultima_medicion_valor)}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {indicator.ultima_medicion_fecha
                    ? new Date(indicator.ultima_medicion_fecha).toLocaleDateString('es-MX')
                    : '—'}
                </td>
              </tr>
            ))}
            {!filteredIndicators.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No se encontraron indicadores que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {indicatorsQuery.isLoading && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
            Cargando indicadores...
          </div>
        )}
      </div>
    </div>
  );
}

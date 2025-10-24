import { formatMonth, formatValueByUnit } from '../../utils/formatters.js';

function resolveObservacion(item) {
  return (
    item?.observaciones ??
    item?.observacion ??
    item?.nota ??
    item?.notas ??
    item?.comentarios ??
    item?.comentario ??
    item?.observaciones_validacion ??
    ''
  );
}

export default function IndicadorDetalle({
  registros = [],
  year,
  unidadMedida,
  percentageScale = 'auto'
}) {
  const rows = registros.map(entry => ({
    key: `${entry.anio}-${entry.mes ?? 0}`,
    periodo: formatMonth(entry.anio, entry.mes ?? 1),
    valor: entry.valor != null ? Number(entry.valor) : null,
    observaciones: resolveObservacion(entry)
  }));

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
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2 text-left">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 text-left text-slate-700">{row.periodo}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                  {row.valor != null
                    ? formatValueByUnit(row.valor, unidadMedida, {
                        numberDecimals: 2,
                        percentageDecimals: 3,
                        percentageScale
                      })
                    : '—'}
                </td>
                <td className="px-4 py-2 text-left text-slate-600">
                  {row.observaciones ? row.observaciones : (
                    <span className="text-xs text-slate-400">Sin observaciones</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                  No se han capturado observaciones para este periodo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

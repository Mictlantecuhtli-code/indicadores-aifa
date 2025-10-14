import { formatValueByUnit } from '../../utils/formatters.js';

export default function IndicadorHeader({
  nombre,
  descripcion,
  unidadMedida,
  metaAnual
}) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Indicador</p>
          <h2 className="text-2xl font-bold text-slate-900">{nombre ?? 'Indicador SMS'}</h2>
          {descripcion ? (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{descripcion}</p>
          ) : null}
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Unidad de medida</p>
            <p className="mt-1 text-lg font-semibold text-aifa-blue">{unidadMedida ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Meta anual</p>
            <p className="mt-1 text-lg font-semibold text-rose-600">
              {metaAnual != null
                ? formatValueByUnit(metaAnual, unidadMedida, {
                    numberDecimals: 1,
                    percentageDecimals: 3,
                    percentageScale: 'percentage'
                  })
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

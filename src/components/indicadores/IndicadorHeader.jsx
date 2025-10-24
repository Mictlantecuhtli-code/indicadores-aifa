import { formatValueByUnit } from '../../utils/formatters.js';

export default function IndicadorHeader({
  indicator,
  nombre,
  descripcion,
  unidadMedida,
  metaAnual,
  onClick
}) {
  const resolvedNombre = nombre ?? indicator?.nombre ?? 'Indicador SMS';
  const resolvedDescripcion = descripcion ?? indicator?.descripcion ?? null;
  const resolvedUnidadMedida = unidadMedida ?? indicator?.unidad_medida ?? '—';
  const clickable = typeof onClick === 'function';

  const interactiveProps = clickable
    ? {
        onClick: onClick,
        role: 'button',
        tabIndex: 0,
        onKeyDown: event => {
          if (!clickable) return;
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            onClick();
          }
        }
      }
    : {};

  return (
    <header
      className={`rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition ${
        clickable
          ? 'cursor-pointer hover:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/60 focus:ring-offset-2'
          : ''
      }`}
      {...interactiveProps}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Indicador</p>
          <h2 className="text-2xl font-bold text-slate-900">{resolvedNombre}</h2>
          {resolvedDescripcion ? (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{resolvedDescripcion}</p>
          ) : null}
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Unidad de medida</p>
            <p className="mt-1 text-lg font-semibold text-aifa-blue">{resolvedUnidadMedida}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Meta anual</p>
            <p className="mt-1 text-lg font-semibold text-rose-600">
              {metaAnual != null
                ? formatValueByUnit(metaAnual, resolvedUnidadMedida, {
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

import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import {
  Activity,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Goal,
  Package,
  Plane,
  PlaneTakeoff,
  TrendingDown,
  Users,
  Weight
} from 'lucide-react';
import { useIndicatorAssignments } from '../hooks/useIndicatorAssignments.js';
import { formatNumber } from '../utils/formatters.js';

const PALETTES = {
  indigo: {
    border: 'border-indigo-100',
    background: 'bg-indigo-50/80',
    icon: 'text-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    option: {
      idle: 'border-indigo-100 hover:border-indigo-200 hover:bg-white',
      active: 'border-indigo-200 bg-white shadow-lg shadow-indigo-200/60 text-indigo-900'
    },
    chevron: 'text-indigo-500'
  },
  blue: {
    border: 'border-blue-100',
    background: 'bg-blue-50/80',
    icon: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    option: {
      idle: 'border-blue-100 hover:border-blue-200 hover:bg-white',
      active: 'border-blue-200 bg-white shadow-lg shadow-blue-200/60 text-blue-900'
    },
    chevron: 'text-blue-500'
  },
  amber: {
    border: 'border-amber-100',
    background: 'bg-amber-50/80',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    option: {
      idle: 'border-amber-100 hover:border-amber-200 hover:bg-white',
      active: 'border-amber-200 bg-white shadow-lg shadow-amber-200/60 text-amber-900'
    },
    chevron: 'text-amber-500'
  },
  orange: {
    border: 'border-orange-100',
    background: 'bg-orange-50/80',
    icon: 'text-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    option: {
      idle: 'border-orange-100 hover:border-orange-200 hover:bg-white',
      active: 'border-orange-200 bg-white shadow-lg shadow-orange-200/60 text-orange-900'
    },
    chevron: 'text-orange-500'
  },
  emerald: {
    border: 'border-emerald-100',
    background: 'bg-emerald-50/80',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    option: {
      idle: 'border-emerald-100 hover:border-emerald-200 hover:bg-white',
      active: 'border-emerald-200 bg-white shadow-lg shadow-emerald-200/60 text-emerald-900'
    },
    chevron: 'text-emerald-500'
  },
  teal: {
    border: 'border-teal-100',
    background: 'bg-teal-50/80',
    icon: 'text-teal-500',
    badge: 'bg-teal-100 text-teal-700',
    option: {
      idle: 'border-teal-100 hover:border-teal-200 hover:bg-white',
      active: 'border-teal-200 bg-white shadow-lg shadow-teal-200/60 text-teal-900'
    },
    chevron: 'text-teal-500'
  },
  violet: {
    border: 'border-violet-100',
    background: 'bg-violet-50/80',
    icon: 'text-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    option: {
      idle: 'border-violet-100 hover:border-violet-200 hover:bg-white',
      active: 'border-violet-200 bg-white shadow-lg shadow-violet-200/60 text-violet-900'
    },
    chevron: 'text-violet-500'
  },
  sky: {
    border: 'border-sky-100',
    background: 'bg-sky-50/80',
    icon: 'text-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    option: {
      idle: 'border-sky-100 hover:border-sky-200 hover:bg-white',
      active: 'border-sky-200 bg-white shadow-lg shadow-sky-200/60 text-sky-900'
    },
    chevron: 'text-sky-500'
  },
  slate: {
    border: 'border-slate-200',
    background: 'bg-slate-50/80',
    icon: 'text-slate-500',
    badge: 'bg-slate-100 text-slate-600',
    option: {
      idle: 'border-slate-200 hover:border-slate-300 hover:bg-white',
      active: 'border-slate-300 bg-white shadow-lg shadow-slate-200/60 text-slate-900'
    },
    chevron: 'text-slate-500'
  }
};

const OPTION_ICON_MAP = {
  'calendar-month': CalendarDays,
  'calendar-quarter': CalendarClock,
  'calendar-year': CalendarRange,
  'target-low': TrendingDown,
  'target-mid': Activity,
  'target-high': Goal
};

const CARD_ICON_MAP = {
  'plane-operations': PlaneTakeoff,
  'plane-passengers': Users,
  'cargo-operations': Package,
  'cargo-weight': Weight,
  'fbo-operations': Plane,
  'fbo-passengers': Users
};

function IndicatorButton({ option, theme, onNavigate }) {
  const Icon = OPTION_ICON_MAP[option.icon] ?? BarChart3;
  const assigned = Boolean(option.indicator);

  return (
    <button
      type="button"
      onClick={() => assigned && onNavigate(option)}
      disabled={!assigned}
      className={classNames(
        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        assigned ? theme.option.idle : 'border-dashed border-slate-200 bg-white/60 text-slate-400 cursor-not-allowed',
        'focus-visible:ring-aifa-light'
      )}
    >
      <span className={classNames('flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm', assigned ? theme.icon : 'text-slate-400')}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-medium leading-snug text-slate-800">{option.label}</span>
        {assigned ? (
          <span className="text-xs text-slate-500">
            Último valor: {formatNumber(option.indicator?.ultima_medicion_valor)}{' '}
            {option.indicator?.unidad_medida ?? ''}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Sin indicador asignado</span>
        )}
      </div>
      {assigned && option.indicator?.ultima_medicion_fecha && (
        <div className="text-right text-xs text-slate-400">
          Actualizado
          <br />
          {new Date(option.indicator.ultima_medicion_fecha).toLocaleDateString('es-MX')}
        </div>
      )}
    </button>
  );
}

function CategoryCard({ category, onNavigate }) {
  const theme = PALETTES[category.palette] ?? PALETTES.slate;
  const CardIcon = CARD_ICON_MAP[category.icon] ?? BarChart3;
  const assignedCount = category.options.filter(option => option.indicator).length;

  return (
    <div className={classNames('overflow-hidden rounded-2xl border bg-white shadow-sm', theme.border)}>
      <div className={classNames('flex items-center gap-3 border-b px-5 py-4', theme.background, theme.border)}>
        <span className={classNames('flex h-11 w-11 items-center justify-center rounded-full bg-white shadow', theme.icon)}>
          <CardIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-800">{category.label}</p>
          <p className={classNames('text-xs font-medium', theme.badge)}>
            {assignedCount
              ? `${assignedCount} indicador${assignedCount === 1 ? '' : 'es'} disponibles`
              : 'Sin indicadores asignados'}
          </p>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        {category.options.map(option => (
          <IndicatorButton key={option.id} option={option} theme={theme} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { sections, indicatorsQuery } = useIndicatorAssignments();

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Panel directivos</h1>
          <p className="text-sm text-slate-500">
            Seleccione una opción para consultar el análisis detallado del indicador asociado.
          </p>
        </div>
      </header>

      <div className="space-y-10">
        {indicatorsQuery.isLoading ? (
          <section className="space-y-5">
            <div className="h-5 w-48 rounded bg-slate-200/60" />
            <div className="grid gap-5 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-slate-100 bg-white"
                />
              ))}
            </div>
          </section>
        ) : (
          sections.map(section => (
            <section key={section.id} className="space-y-5">
              <header className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-xs text-slate-400">{section.description}</p>
                )}
              </header>

              <div className="grid gap-5 xl:grid-cols-2">
                {section.categories.map(category => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onNavigate={option => navigate(`/panel-directivos/${option.id}`)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {!indicatorsQuery.isLoading && !sections.length && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              No se encontraron indicadores asignados a las opciones del panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

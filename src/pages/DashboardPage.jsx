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
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleGauge,
  Goal,
  Layers3,
  Package,
  Plane,
  PlaneTakeoff,
  TrendingDown,
  TrendingUp,
  Users,
  Weight
} from 'lucide-react';
import classNames from 'classnames';
import {
  INDICATOR_SECTIONS,
  DIRECTION_FALLBACKS,
  buildIndicatorOptions,
  normalizeText,
  buildCodeFromName
} from '../config/dashboardConfig.js';

const SUMMARY_FIELDS = [
  { key: 'total_indicadores', label: 'Indicadores monitoreados', icon: BarChart3 },
  { key: 'indicadores_con_metas', label: 'Indicadores con metas', icon: Goal },
  { key: 'indicadores_sin_actualizar', label: 'Indicadores pendientes', icon: Layers3 },
  { key: 'porcentaje_cumplimiento', label: 'Cumplimiento promedio', icon: CircleGauge, type: 'percentage' }
];

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

const DIRECTION_ICON = Users;

function SummaryCards({ summary, loading }) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_FIELDS.map(field => (
          <div
            key={field.key}
            className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white/70 p-6 shadow-sm"
          >
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
            className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow transition hover:shadow-lg"
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

function IndicatorOption({ option, theme, onSelect, isActive }) {
  const Icon = OPTION_ICON_MAP[option.icon] ?? BarChart3;
  return (
    <button
      type="button"
      onClick={() => option.indicator && onSelect(option)}
      disabled={!option.indicator}
      className={classNames(
        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        option.indicator
          ? theme.option.idle
          : 'border-dashed border-slate-200 bg-white/60 text-slate-400 cursor-not-allowed',
        isActive && option.indicator ? theme.option.active : null,
        isActive && !option.indicator ? 'border-slate-300 bg-white' : null,
        option.indicator ? 'focus-visible:ring-aifa-light' : 'focus-visible:ring-slate-200'
      )}
    >
      <span
        className={classNames(
          'flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm',
          option.indicator ? theme.icon : 'text-slate-400'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-medium leading-snug">{option.label}</span>
        {option.indicator ? (
          <span className="text-xs text-slate-500">
            Último valor: {formatNumber(option.indicator.ultima_medicion_valor)}{' '}
            {option.indicator.unidad_medida ?? ''}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Sin asignar</span>
        )}
      </div>
      {option.indicator?.ultima_medicion_fecha && (
        <div className="text-right text-xs text-slate-400">
          Actualizado
          <br />
          {new Date(option.indicator.ultima_medicion_fecha).toLocaleDateString('es-MX')}
        </div>
      )}
    </button>
  );
}

function IndicatorCard({
  category,
  options,
  isOpen,
  onToggle,
  onSelect,
  activeOptionId
}) {
  const theme = PALETTES[category.palette] ?? PALETTES.slate;
  const CardIcon = CARD_ICON_MAP[category.icon] ?? BarChart3;
  const assignedCount = options.filter(option => option.indicator).length;

  return (
    <div className={classNames('overflow-hidden rounded-2xl border bg-white shadow-sm', theme.border)}>
      <button
        type="button"
        onClick={onToggle}
        className={classNames(
          'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition',
          theme.background,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-aifa-light'
        )}
      >
        <div className="flex flex-1 items-center gap-3">
          <span className={classNames('flex h-11 w-11 items-center justify-center rounded-full bg-white shadow', theme.icon)}>
            <CardIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-slate-800">{category.label}</p>
            <p className={classNames('text-xs font-medium', theme.badge)}>
              {assignedCount ? `${assignedCount} opción${assignedCount === 1 ? '' : 'es'} asignada${
                assignedCount === 1 ? '' : 's'
              }` : 'Sin asignar'}
            </p>
          </div>
        </div>
        <ChevronDown className={classNames('h-5 w-5 transition-transform', theme.chevron, isOpen && 'rotate-180')} />
      </button>
      <div
        className={classNames(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-3">
            {options.map(option => (
              <IndicatorOption
                key={option.id}
                option={option}
                theme={theme}
                onSelect={onSelect}
                isActive={activeOptionId === option.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectionCard({ direction, isOpen, onToggle }) {
  const theme = PALETTES[direction.palette] ?? PALETTES.slate;
  return (
    <div className={classNames('overflow-hidden rounded-2xl border bg-white shadow-sm', theme.border)}>
      <button
        type="button"
        onClick={onToggle}
        className={classNames(
          'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition',
          theme.background,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-aifa-light'
        )}
      >
        <div className="flex flex-1 items-center gap-3">
          <span className={classNames('flex h-11 w-11 items-center justify-center rounded-full bg-white shadow', theme.icon)}>
            <DIRECTION_ICON className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-slate-800">{direction.name}</p>
            <p className={classNames('inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest', theme.badge)}>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {direction.code}
              </span>
              {direction.subdirections.length ? `${direction.subdirections.length} subdirección${
                direction.subdirections.length === 1 ? '' : 'es'
              }` : 'Sin subdirecciones registradas'}
            </p>
          </div>
        </div>
        <ChevronDown className={classNames('h-5 w-5 transition-transform', theme.chevron, isOpen && 'rotate-180')} />
      </button>
      <div
        className={classNames(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden border-t border-slate-100 bg-white px-5 py-4">
          {direction.subdirections.length ? (
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {direction.subdirections.map(sub => (
                <li
                  key={`${direction.id}-${sub.code ?? sub.name}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2"
                >
                  <span className="font-medium text-slate-700">{sub.name}</span>
                  {sub.code && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-400">
                      {sub.code}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-400">
              No hay subdirecciones registradas en la matriz.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [openCardId, setOpenCardId] = useState(null);
  const [openDirectionId, setOpenDirectionId] = useState(null);

  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const indicatorsIndex = useMemo(() => {
    return (indicatorsQuery.data ?? []).map(record => ({
      record,
      normalizedName: normalizeText(record.nombre),
      normalizedDescription: normalizeText(record.descripcion),
      normalizedArea: normalizeText(record.area_nombre ?? record.area)
    }));
  }, [indicatorsQuery.data]);

  const indicatorSections = useMemo(() => {
    return INDICATOR_SECTIONS.map(section => ({
      ...section,
      categories: section.categories.map(category => {
        const options = buildIndicatorOptions(category).map(option => {
          const normalizedOption = normalizeText(option.label);
          const indicatorMatch = indicatorsIndex.find(entry => {
            if (!entry.normalizedName && !entry.normalizedDescription) return false;
            const haystacks = [entry.normalizedName, entry.normalizedDescription].filter(Boolean);
            const sectionName = normalizeText(category.label);
            const areaName = entry.normalizedArea;
            const optionWords = normalizedOption.split(' ').filter(Boolean);
            return haystacks.some(text => {
              if (text.includes(normalizedOption)) return true;
              const containsAllWords = optionWords.every(part => text.includes(part));
              if (containsAllWords && sectionName && text.includes(sectionName)) {
                return true;
              }
              if (containsAllWords && areaName && text.includes(areaName)) {
                return true;
              }
              return false;
            });
          });

          return {
            ...option,
            indicator: indicatorMatch?.record ?? null
          };
        });

        return {
          ...category,
          options
        };
      })
    }));
  }, [indicatorsIndex]);

  useEffect(() => {
    if (selectedIndicator) return;
    for (const section of indicatorSections) {
      for (const category of section.categories) {
        const firstAssigned = category.options.find(option => option.indicator);
        if (firstAssigned) {
          setSelectedIndicator(firstAssigned.indicator.id);
          setSelectedOptionId(firstAssigned.id);
          setOpenCardId(category.id);
          return;
        }
      }
    }
  }, [indicatorSections, selectedIndicator]);

  const activeIndicator = useMemo(() => {
    if (!selectedIndicator) return null;
    return (indicatorsQuery.data ?? []).find(item => item.id === selectedIndicator) ?? null;
  }, [indicatorsQuery.data, selectedIndicator]);

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

  const directions = useMemo(() => {
    const map = new Map();
    (indicatorsQuery.data ?? []).forEach(item => {
      const directionName = item.direccion ?? item.direccion_nombre ?? item.area_direccion ?? null;
      if (!directionName) return;
      const key = normalizeText(directionName);
      if (!map.has(key)) {
        const fallback = DIRECTION_FALLBACKS.find(dir => normalizeText(dir.name) === key);
        map.set(key, {
          id: fallback?.id ?? key,
          name: directionName,
          code: item.direccion_codigo ?? item.direccion_clave ?? fallback?.code ?? buildCodeFromName(directionName),
          palette: fallback?.palette ?? 'slate',
          subdirections: new Map()
        });
      }
      const subName = item.subdireccion ?? item.subdireccion_nombre ?? item.area_subdireccion ?? null;
      if (subName) {
        const entry = map.get(key);
        const subKey = normalizeText(subName);
        entry.subdirections.set(subKey, {
          name: subName,
          code: item.subdireccion_codigo ?? item.subdireccion_clave ?? buildCodeFromName(subName)
        });
      }
    });

    let list = Array.from(map.values()).map(item => ({
      ...item,
      subdirections: Array.from(item.subdirections.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }));

    const existingKeys = new Set(list.map(item => normalizeText(item.name)));
    DIRECTION_FALLBACKS.forEach(fallback => {
      const key = normalizeText(fallback.name);
      if (!existingKeys.has(key)) {
        list.push({ ...fallback, subdirections: [] });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [indicatorsQuery.data]);

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel de Análisis de Indicadores</h1>
            <p className="text-sm text-slate-500">
              Seleccione un indicador para consultar su tendencia y el comparativo contra las metas planteadas.
            </p>
          </div>
          {activeIndicator?.ultima_medicion_alerta && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {activeIndicator.ultima_medicion_alerta}
            </div>
          )}
        </div>
      </header>

      <SummaryCards summary={summaryQuery.data} loading={summaryQuery.isLoading} />

      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          {indicatorSections.map(section => (
            <section key={section.id} className="space-y-4">
              <header>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {section.title}
                </h2>
                <p className="text-xs text-slate-400">{section.description}</p>
              </header>
              <div className="space-y-3">
                {section.categories.map(category => (
                  <IndicatorCard
                    key={category.id}
                    category={category}
                    options={category.options}
                    isOpen={openCardId === category.id}
                    onToggle={() => setOpenCardId(prev => (prev === category.id ? null : category.id))}
                    onSelect={option => {
                      setSelectedIndicator(option.indicator?.id ?? null);
                      setSelectedOptionId(option.id);
                    }}
                    activeOptionId={selectedOptionId}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-4">
            <header>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Direcciones</h2>
              <p className="text-xs text-slate-400">
                Consulta la estructura de subdirecciones según la matriz institucional asignada.
              </p>
            </header>
            <div className="space-y-3">
              {directions.map(direction => (
                <DirectionCard
                  key={direction.id}
                  direction={direction}
                  isOpen={openDirectionId === direction.id}
                  onToggle={() => setOpenDirectionId(prev => (prev === direction.id ? null : direction.id))}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-800">
                  {activeIndicator?.nombre ?? 'Seleccione un indicador asignado'}
                </h2>
                {activeIndicator?.descripcion && (
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">{activeIndicator.descripcion}</p>
                )}
              </div>
              {activeIndicator?.unidad_medida && (
                <div className="rounded-2xl bg-aifa-blue/10 px-4 py-2 text-right">
                  <p className="text-xs uppercase tracking-widest text-aifa-blue">Unidad</p>
                  <p className="text-sm font-semibold text-aifa-blue">{activeIndicator.unidad_medida}</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Valor actual</p>
                <p className="mt-2 text-2xl font-semibold text-slate-800">
                  {formatNumber(activeIndicator?.ultima_medicion_valor)}
                </p>
                {activeIndicator?.ultima_medicion_fecha && (
                  <p className="text-xs text-slate-500">
                    Actualizado{' '}
                    {new Date(activeIndicator.ultima_medicion_fecha).toLocaleDateString('es-MX', {
                      dateStyle: 'medium'
                    })}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Historial reciente</h3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
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

import { useMemo, useState } from 'react';
import classNames from 'classnames';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  LineChart,
  Loader2,
  Package,
  Plane,
  PlaneTakeoff,
  Target,
  Users,
  Weight
} from 'lucide-react';
import { getAreas } from '../lib/supabaseClient.js';

const OPTION_BLUEPRINTS = [
  {
    id: 'monthly-yoy',
    type: 'monthly',
    template: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'quarterly-yoy',
    type: 'quarterly',
    template: entity =>
      `Cantidad de ${entity} real trimestral del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'annual-yoy',
    type: 'annual',
    template: entity =>
      `Cantidad de ${entity} real anual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'scenario-low',
    type: 'scenario',
    template: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Bajo`
  },
  {
    id: 'scenario-mid',
    type: 'scenario',
    template: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Mediano`
  },
  {
    id: 'scenario-high',
    type: 'scenario',
    template: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Alto`
  }
];

const OPTION_ICON_MAP = {
  monthly: LineChart,
  quarterly: BarChart3,
  annual: Calendar,
  scenario: Target
};

const OPERATIVE_GROUP_CONFIGS = [
  { id: 'operations', title: 'Operaciones', entity: 'Operaciones', icon: PlaneTakeoff },
  { id: 'passengers', title: 'Pasajeros', entity: 'Pasajeros', icon: Users },
  { id: 'cargo-operations', title: 'Carga Operaciones', entity: 'Carga Operaciones', icon: Package },
  { id: 'cargo-weight', title: 'Carga Toneladas', entity: 'Carga Toneladas', icon: Weight }
];

const FBO_GROUP_CONFIGS = [
  { id: 'fbo-operations', title: 'Operaciones', entity: 'Operaciones', icon: Plane },
  { id: 'fbo-passengers', title: 'Pasajeros', entity: 'Pasajeros', icon: Users }
];

function buildIndicatorGroups(configs) {
  return configs.map(config => ({
    ...config,
    options: OPTION_BLUEPRINTS.map(blueprint => ({
      id: `${config.id}-${blueprint.id}`,
      label: blueprint.template(config.entity),
      type: blueprint.type
    }))
  }));
}

const OPERATIVE_GROUPS = buildIndicatorGroups(OPERATIVE_GROUP_CONFIGS);
const FBO_GROUPS = buildIndicatorGroups(FBO_GROUP_CONFIGS);

function AccordionSection({ id, title, description, isOpen, onToggle, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        <ChevronDown
          className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {isOpen && <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5">{children}</div>}
    </section>
  );
}

function IndicatorGroupsList({ groups }) {
  const [openGroupId, setOpenGroupId] = useState(null);

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <IndicatorGroupItem
          key={group.id}
          group={group}
          isOpen={openGroupId === group.id}
          onToggle={() => setOpenGroupId(prev => (prev === group.id ? null : group.id))}
        />
      ))}
    </div>
  );
}

function IndicatorGroupItem({ group, isOpen, onToggle }) {
  const GroupIcon = group.icon ?? BarChart3;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <GroupIcon className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-slate-800">{group.title}</span>
        </span>
        <ChevronDown
          className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <ul className="space-y-2">
            {group.options.map(option => {
              const OptionIcon = OPTION_ICON_MAP[option.type] ?? LineChart;
              return (
                <li
                  key={option.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                >
                  <span className="mt-0.5 text-slate-500">
                    <OptionIcon className="h-4 w-4" />
                  </span>
                  <span>{option.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalizeHex(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(prefixed)) {
    return prefixed.length === 4
      ? `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`
      : prefixed;
  }
  return null;
}

function getBadgeStyles(color) {
  const normalized = normalizeHex(color) ?? '#1e293b';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.65 ? '#0f172a' : '#ffffff';
  return {
    backgroundColor: normalized,
    color: textColor
  };
}

function buildAreaTree(areas) {
  const byParent = new Map();

  (areas ?? []).forEach(area => {
    const parentId = area?.parent_area_id ?? null;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId).push(area);
  });

  const sortAreas = list =>
    (list ?? []).slice().sort((a, b) => (a?.nombre ?? '').localeCompare(b?.nombre ?? '', 'es', { sensitivity: 'base' }));

  const buildBranch = parentId => {
    const children = sortAreas(byParent.get(parentId));
    return children.map(child => ({
      ...child,
      children: buildBranch(child.id)
    }));
  };

  return buildBranch(null);
}

function DirectionChildrenList({ areas }) {
  if (!areas?.length) return null;

  return (
    <ul className="space-y-2">
      {areas.map(area => (
        <li key={area.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>{area.nombre}</span>
            <span
              className="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
              style={getBadgeStyles(area.color_hex)}
            >
              {area.clave ?? '—'}
            </span>
          </div>
          {area.children?.length ? (
            <div className="ml-4 border-l border-slate-200 pl-4">
              <DirectionChildrenList areas={area.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DirectionsSection({ areas, isLoading, error }) {
  const [openDirectionId, setOpenDirectionId] = useState(null);
  const hasDirections = areas?.length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando direcciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudieron cargar las direcciones.
      </div>
    );
  }

  if (!hasDirections) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay direcciones registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {areas.map(area => {
        const hasChildren = area.children?.length;
        const isOpen = openDirectionId === area.id;
        return (
          <div key={area.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => (hasChildren ? setOpenDirectionId(prev => (prev === area.id ? null : area.id)) : null)}
              aria-expanded={hasChildren ? isOpen : undefined}
              className={classNames(
                'flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2',
                hasChildren ? 'hover:bg-slate-50' : 'cursor-default'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">{area.nombre}</span>
                <span
                  className="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
                  style={getBadgeStyles(area.color_hex)}
                >
                  {area.clave ?? '—'}
                </span>
              </div>
              {hasChildren && (
                <ChevronDown
                  className={classNames('h-5 w-5 text-slate-400 transition-transform', isOpen ? 'rotate-180' : '')}
                />
              )}
            </button>
            {hasChildren && isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                <DirectionChildrenList areas={area.children} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [openSection, setOpenSection] = useState('operativos');
  const areasQuery = useQuery({
    queryKey: ['areas'],
    queryFn: getAreas
  });

  const directions = useMemo(() => buildAreaTree(areasQuery.data ?? []), [areasQuery.data]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Panel directivos</h1>
        <p className="text-sm text-slate-500">
          Seleccione una categoría para explorar las opciones de indicadores y direcciones disponibles.
        </p>
      </header>

      <div className="space-y-5">
        <AccordionSection
          id="operativos"
          title="Indicadores Operativos"
          isOpen={openSection === 'operativos'}
          onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
          icon={BarChart3}
        >
          <IndicatorGroupsList groups={OPERATIVE_GROUPS} />
        </AccordionSection>

        <AccordionSection
          id="fbo"
          title="Indicadores FBO (Aviación General)"
          isOpen={openSection === 'fbo'}
          onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
          icon={Plane}
        >
          <IndicatorGroupsList groups={FBO_GROUPS} />
        </AccordionSection>

        <AccordionSection
          id="direcciones"
          title="Direcciones"
          isOpen={openSection === 'direcciones'}
          onToggle={next => setOpenSection(prev => (prev === next ? null : next))}
          icon={Users}
        >
          <DirectionsSection areas={directions} isLoading={areasQuery.isLoading} error={areasQuery.error} />
        </AccordionSection>
      </div>
    </div>
  );
}

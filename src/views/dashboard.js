import {
  getAreas,
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets,
  getCapturasFauna,
  getImpactosFauna,
  getSmsDocuments,
  getSmsPistasData
} from '../services/supabaseClient.js';
import { formatValueByUnit } from '../utils/formatters.js';
import { renderError, renderLoading } from '../ui/feedback.js';
import {
  IMPACTOS_FAUNA_MODAL_ID,
  buildImpactosFaunaChartView,
  buildImpactosFaunaCsv,
  buildImpactosFaunaDetailTable,
  buildImpactosFaunaModalMarkup,
  buildImpactosFaunaSummary
} from './modals/modalImpactosFauna.js';
import {
  PGPAFS_MODAL_ID,
  buildPgpaFsChartView,
  buildPgpaFsModalMarkup,
  buildPgpaFsSummary,
  buildCapturesChartView
} from './modals/modalPgpaFs.js';
import {
  SMS_PISTAS_MODAL_ID,
  buildSmsPistasModalMarkup,
  buildSmsPistasChartView,
  buildSmsPistasChartConfig,
  buildSmsPistasSummary
} from './modals/modalIndicadoresSMS.js';
import { openSmsPistasModal } from './modals/modalIndicadoresSMSInit.js';
import { openSmsLucesModal } from './modals/modalIndicadorSMSLucesInit.js';
import { openSmsPciModal } from './modals/modalIndicadorSmsPCIInit.js';
const OPTION_BLUEPRINTS = [
  {
    id: 'monthly-yoy',
    type: 'monthly',
    scenario: null,
    buildLabel: entity =>
      `Mensual del año en curso vs. el año anterior`
  },
  {
    id: 'quarterly-yoy',
    type: 'quarterly',
    scenario: null,
    buildLabel: entity =>
      `Trimestral del año en curso vs. el año anterior`
  },
  {
    id: 'scenario-low',
    type: 'scenario',
    scenario: 'BAJO',
    buildLabel: entity =>
      `Mensual del año en curso vs. proyección de meta escenario Bajo (PMD)`
  },
  {
    id: 'scenario-mid',
    type: 'scenario',
    scenario: 'MEDIO',
    buildLabel: entity =>
      `Mensual del año en curso vs. proyección de meta escenario Mediano (PMD)`
  },
  {
    id: 'scenario-high',
    type: 'scenario',
    scenario: 'ALTO',
    buildLabel: entity =>
      `Mensual del año en curso vs. proyección de meta escenario Alto (PMD)`
  }
];

const NON_SCENARIO_OPTION_BLUEPRINTS = OPTION_BLUEPRINTS.filter(
  blueprint => blueprint.type !== 'scenario'
);


const OPTION_ICON_CLASSES = {
  monthly: 'fa-solid fa-chart-line',
  quarterly: 'fa-solid fa-chart-column',
  annual: 'fa-solid fa-calendar-days',
  scenario: 'fa-solid fa-bullseye'
};

const GROUP_DEFINITIONS = {
  operations: {
    id: 'operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    dataKey: 'operations',
    iconClass: 'fa-solid fa-plane-up'
  },
  passengers: {
    id: 'passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    dataKey: 'passengers',
    iconClass: 'fa-solid fa-users-between-lines'
  },
  'cargo-operations': {
    id: 'cargo-operations',
    title: 'Carga Operaciones',
    entity: 'Carga Operaciones',
    dataKey: 'cargo-operations',
    iconClass: 'fa-solid fa-boxes-stacked'
  },
  'cargo-weight': {
    id: 'cargo-weight',
    title: 'Carga Toneladas',
    entity: 'Carga Toneladas',
    dataKey: 'cargo-weight',
    iconClass: 'fa-solid fa-weight-hanging'
  },
  'fbo-operations': {
    id: 'fbo-operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    dataKey: 'fbo-operations',
    iconClass: 'fa-solid fa-plane',
    optionBlueprints: NON_SCENARIO_OPTION_BLUEPRINTS
  },
  'fbo-passengers': {
    id: 'fbo-passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    dataKey: 'fbo-passengers',
    iconClass: 'fa-solid fa-user-group',
    optionBlueprints: NON_SCENARIO_OPTION_BLUEPRINTS
  }
};

const DIRECT_INDICATOR_PREFIX = 'indicator:';
const DIRECTION_GROUP_PREFIX = 'direction-indicator-';

let cachedIndicators = null;

function normalizeMatchText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAreaName(value) {
  return normalizeMatchText(value);
}

const EXCLUDED_AREA_NAMES = new Set(
  [
    // Ocultamos temporalmente estas direcciones del Panel Directivos.
    'SMS',
    'Dirección Comercial y de Servicios',
    'Dirección de Administración',
    'Dirección de Operación',
    'Dirección Jurídica'
  ].map(normalizeAreaName)
);

function getVisualizationOrder(value) {
  const order = Number(value);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

const SMS_SECTION_OBJECTIVES = [
  {
    id: 'sms-objective-1',
    title: 'Objetivo 1',
    description:
      'Mantener la tasa de impactos de fauna dentro del aeropuerto igual o por debajo del porcentaje del año anterior.',
    indicators: [
      {
        id: 'sms-indicator-1-1',
        name: 'Indicador 1.1',
        description: 'Tasa de impactos con fauna dentro del aeropuerto.'
      },
      {
        id: 'sms-indicator-1-2',
        name: 'Indicador 1.2',
        description:
          'Porcentaje de cumplimiento del programa de gestión del peligro aviario y la fauna silvestre.'
      }
    ]
  },
  {
    id: 'sms-objective-2',
    title: 'Objetivo 2',
    description:
      'Mantener el porcentaje de disponibilidad y el índice de confiabilidad del sistema de iluminación de ayudas visuales dentro de los parámetros establecidos.',
    indicators: [
      {
        id: 'sms-indicator-2-1',
        name: 'Indicador 2.1',
        description: 'Porcentaje de disponibilidad del sistema de iluminación de ayudas visuales en pista.'
      },
      {
        id: 'sms-indicator-2-2',
        name: 'Indicador 2.2',
        description: 'Índice de confiabilidad del sistema de iluminación de ayudas visuales en pista.'
      },
      {
        id: 'sms-indicator-2-3',
        name: 'Indicador 2.3',
        description: 'Porcentaje de luces operativas del sistema de ayudas visuales en pista.'
      }
    ]
  },
  {
    id: 'sms-objective-3',
    title: 'Objetivo 3',
    description: 'Mantener la disponibilidad de pistas dentro de los parámetros establecidos.',
    indicators: [
      {
        id: 'sms-indicator-3-1',
        name: 'Indicador 3.1',
        description: 'PCI* (Índice de condiciones del pavimento).'
      },
      {
        id: 'sms-indicator-3-2',
        name: 'Indicador 3.2',
        description: 'Porcentaje de mantenimientos programados a pavimentos.'
      },
      {
        id: 'sms-indicator-3-3',
        name: 'Indicador 3.3',
        description: 'Porcentaje de disponibilidad de pistas.'
      }
    ]
  },
  {
    id: 'sms-objective-4',
    title: 'Objetivo 4',
    description:
      'Realizar capacitaciones y supervisiones en materia de Seguridad Operacional al personal del AIFA.',
    indicators: [
      {
        id: 'sms-indicator-4-1',
        name: 'Indicador 4.1',
        description: 'Porcentaje de capacitaciones realizadas al año.'
      },
      {
        id: 'sms-indicator-4-2',
        name: 'Indicador 4.2',
        description: 'Porcentaje de supervisiones realizadas al año.'
      }
    ]
  }
];

const SMS_INDICATOR_MODAL_ROUTES = {
  'sms-indicator-1-1': () => openImpactosFaunaModal(),
  'sms-indicator-1-2': () => openPgpaFsModal(),
  'sms-indicator-2-1': (id, name, subtitle) => openSmsPistasModal(id, name, subtitle),
  'sms-indicator-2-2': (id, name, subtitle) => openSmsPistasModal(id, name, subtitle),
  'sms-indicator-2-3': (id, name, subtitle) => openSmsLucesModal(id, name, subtitle),
  'sms-indicator-3-1': (id, name, subtitle) => openSmsPciModal(id, name, subtitle)
};

function buildSmsSectionContent() {
  const objectivesMarkup = SMS_SECTION_OBJECTIVES.map(objective => {
    const indicators = Array.isArray(objective.indicators) ? objective.indicators : [];
    const indicatorsMarkup = indicators
      .map(indicator => `
        <li>
          <a
            href="#"
            class="group inline-flex flex-col gap-0.5 text-left text-sm leading-snug text-slate-700 transition hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
            data-sms-indicator-link
            data-sms-indicator-id="${escapeHtml(indicator.id)}"
            data-sms-indicator-name="${escapeHtml(indicator.name)}"
            data-sms-indicator-subtitle="${escapeHtml(indicator.description)}"
          >
            <span class="font-semibold text-primary-700 transition group-hover:text-primary-800">${escapeHtml(indicator.name)}</span>
            <span class="text-slate-600">${escapeHtml(indicator.description)}</span>
          </a>
        </li>
      `)
      .join('');

    const panelId = `${objective.id}-panel`;

    return `
      <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="${escapeHtml(objective.id)}">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
          data-sms-objective-button
          data-sms-objective-id="${escapeHtml(objective.id)}"
          data-sms-objective-panel-target="${escapeHtml(panelId)}"
          aria-expanded="false"
          aria-controls="${escapeHtml(panelId)}"
        >
          <span class="flex-1 text-left">
            <span class="block text-base font-semibold text-slate-900">${escapeHtml(objective.title)}</span>
            <span class="mt-1 block text-sm text-slate-600">${escapeHtml(objective.description)}</span>
          </span>
          <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-sms-objective-chevron></i>
        </button>
        <div
          id="${escapeHtml(panelId)}"
          class="border-t border-slate-100 bg-slate-50/60 px-5 py-4"
          data-sms-objective-panel="${escapeHtml(panelId)}"
          hidden
        >
          <ul class="mt-2 space-y-2">
            ${indicatorsMarkup}
          </ul>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="space-y-4" data-sms-objectives-root>
      ${objectivesMarkup}
    </div>
  `;
}

const BASE_ACCORDION_SECTIONS = [
  {
    id: 'operativos',
    type: 'indicators',
    title: 'Indicadores Operativos',
    iconClass: 'fa-solid fa-gauge-high',
    groupIds: ['operations', 'passengers', 'cargo-operations', 'cargo-weight']
  },
  {
    id: 'sms',
    type: 'static',
    title: 'Indicadores SMS',
    iconClass: 'fa-solid fa-shield-halved',
    buildContent: buildSmsSectionContent
  },
  {
    id: 'fbo',
    type: 'indicators',
    title: 'Indicadores FBO (Aviación General)',
    iconClass: 'fa-solid fa-plane-circle-check',
    groupIds: ['fbo-operations', 'fbo-passengers']
  }
];

const DEFAULT_ACCORDION_ID = 'operativos';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
  { index: 0, label: 'Enero', short: 'Ene' },
  { index: 1, label: 'Febrero', short: 'Feb' },
  { index: 2, label: 'Marzo', short: 'Mar' },
  { index: 3, label: 'Abril', short: 'Abr' },
  { index: 4, label: 'Mayo', short: 'May' },
  { index: 5, label: 'Junio', short: 'Jun' },
  { index: 6, label: 'Julio', short: 'Jul' },
  { index: 7, label: 'Agosto', short: 'Ago' },
  { index: 8, label: 'Septiembre', short: 'Sep' },
  { index: 9, label: 'Octubre', short: 'Oct' },
  { index: 10, label: 'Noviembre', short: 'Nov' },
  { index: 11, label: 'Diciembre', short: 'Dic' }
];

const QUARTER_LABELS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Trimestre 4'];

const SCENARIO_LABELS = {
  BAJO: 'Escenario Bajo',
  MEDIO: 'Escenario Medio',
  ALTO: 'Escenario Alto',
  OBJETIVO: 'Objetivo',
  'ALERTA 1': 'Nivel de alerta 1',
  'ALERTA 2': 'Nivel de alerta 2',
  'ALERTA 3': 'Nivel de alerta 3'
};

const LOWER_IS_BETTER_CODE_SET = new Set(['DPE-E001-003', 'DPE-E001-004']);

const LOWER_IS_BETTER_ID_SET = new Set([
  '0784a385-5f45-47a0-9646-520d35539874',
  'dd074728-b12f-43aa-8223-f5db94199018'
]);

const PLANNING_PRIORITY_CODES = [
  'DPE-K053-001',
  'DPE-K053-002',
  'DPE-K053-003',
  'DPE-K053-004',
  'DPE-E001-001',
  'DPE-E001-002',
  'DPE-E001-003',
  'DPE-E001-004'
];

const PLANNING_PRIORITY_MAP = new Map(
  PLANNING_PRIORITY_CODES.map((code, index) => [code, index])
);

const PLANNING_ALLOWED_CODES = new Set(PLANNING_PRIORITY_CODES);

const INDICATOR_CODE_OVERRIDES = {
  'DPE-K053-001': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-K053-002': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-K053-003': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-K053-004': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-E001-001': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-E001-002': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-E001-003': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  },
  'DPE-E001-004': {
    hasDashboardData: true,
    defaultScenario: 'MEDIO',
    scenarios: ['MEDIO'],
    scenarioLabels: {
      MEDIO: 'Meta Programada',
      ALTO: 'Meta Alcanzada'
    }
  }
};

const INDICATOR_ID_OVERRIDES = {
  'ac8f54a3-1710-4b28-b26c-2a868219a5b8': INDICATOR_CODE_OVERRIDES['DPE-K053-001'],
  '7bf1ad26-f93d-475c-812d-78ca625056e9': INDICATOR_CODE_OVERRIDES['DPE-K053-002'],
  'dcd0cba3-a769-4c56-90c9-76727ab95221': INDICATOR_CODE_OVERRIDES['DPE-K053-003'],
  '383cc154-edb0-4e48-a003-1dd6d3b92d10': INDICATOR_CODE_OVERRIDES['DPE-K053-004'],
  '1998bd51-15e9-46f7-9c4b-159a341bbf3c': INDICATOR_CODE_OVERRIDES['DPE-E001-001'],
  '67755395-1689-4b73-9b87-7ba53cc99b90': INDICATOR_CODE_OVERRIDES['DPE-E001-002'],
  '0784a385-5f45-47a0-9646-520d35539874': INDICATOR_CODE_OVERRIDES['DPE-E001-003'],
  'dd074728-b12f-43aa-8223-f5db94199018': INDICATOR_CODE_OVERRIDES['DPE-E001-004']
};

function normalizeScenarioValue(value) {
  const normalized = (value ?? '')
    .toString()
    .trim()
    .toUpperCase();
  return normalized ? normalized : null;
}

function getIndicatorCode(indicator) {
  if (!indicator) return null;
  const code = indicator?.clave ?? null;
  if (!code) return null;
  const normalized = code.toString().trim().toUpperCase();
  return normalized || null;
}

function getIndicatorOverrideByCode(code) {
  const normalized = normalizeScenarioValue(code ? code.replace(/[^A-Z0-9-]/gi, '') : null);
  if (!normalized) return null;
  return INDICATOR_CODE_OVERRIDES[normalized] ?? null;
}

function getIndicatorOverrideById(id) {
  const normalized = (id ?? '').toString().trim().toLowerCase();
  if (!normalized) return null;
  return INDICATOR_ID_OVERRIDES[normalized] ?? null;
}

function getIndicatorOverride(indicator) {
  if (!indicator) return null;

  const overrideById = getIndicatorOverrideById(indicator?.id);
  if (overrideById) {
    return overrideById;
  }

  const code = getIndicatorCode(indicator);
  if (!code) return null;
  return getIndicatorOverrideByCode(code);
}

function indicatorPrefersLowerValues(indicator) {
  if (!indicator) return false;

  const code = getIndicatorCode(indicator);
  if (code && LOWER_IS_BETTER_CODE_SET.has(code)) {
    return true;
  }

  const id = (indicator?.id ?? '').toString().trim().toLowerCase();
  if (id && LOWER_IS_BETTER_ID_SET.has(id)) {
    return true;
  }

  return false;
}

function getPlanningIndicatorPriority(indicator) {
  if (!indicator) return Number.MAX_SAFE_INTEGER;

  const code = getIndicatorCode(indicator);
  if (code && PLANNING_PRIORITY_MAP.has(code)) {
    return PLANNING_PRIORITY_MAP.get(code);
  }

  return Number.MAX_SAFE_INTEGER;
}

function indicatorHasDashboardData(indicator) {
  const override = getIndicatorOverride(indicator);
  return Boolean(override?.hasDashboardData);
}

function getIndicatorDefaultScenario(indicator, fallback = null) {
  const override = getIndicatorOverride(indicator);
  const normalizedFallback = normalizeScenarioValue(fallback);

  if (override) {
    const normalizedDefault = normalizeScenarioValue(override.defaultScenario);
    if (normalizedDefault) {
      return normalizedDefault;
    }

    if (Array.isArray(override.scenarios)) {
      const firstScenario = override.scenarios
        .map(normalizeScenarioValue)
        .find(value => value);
      if (firstScenario) {
        return firstScenario;
      }
    }
  }

  return normalizedFallback;
}

function resolveScenarioLabel(indicator, scenario, override = null) {
  const normalizedScenario = normalizeScenarioValue(scenario);
  if (!normalizedScenario) {
    return 'Meta';
  }

  const effectiveOverride = override ?? getIndicatorOverride(indicator);
  const overrideLabel = effectiveOverride?.scenarioLabels?.[normalizedScenario];
  if (overrideLabel) {
    return overrideLabel;
  }

  return SCENARIO_LABELS[normalizedScenario] ?? 'Meta';
}

function getIndicatorScenarioLabel(indicator, scenario) {
  return resolveScenarioLabel(indicator, scenario);
}

function getIndicatorScenarioOptions(indicator, currentScenario = null) {
  const override = getIndicatorOverride(indicator);
  const normalizedCurrent = normalizeScenarioValue(currentScenario);

  const baseScenarios = Array.isArray(override?.scenarios) && override.scenarios.length
    ? override.scenarios
    : normalizedCurrent
      ? [normalizedCurrent]
      : [];

  const options = [];
  const seen = new Set();

  baseScenarios.forEach(value => {
    const normalized = normalizeScenarioValue(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    options.push({
      value: normalized,
      label: resolveScenarioLabel(indicator, normalized, override)
    });
  });

  if (normalizedCurrent && !seen.has(normalizedCurrent)) {
    seen.add(normalizedCurrent);
    options.push({
      value: normalizedCurrent,
      label: resolveScenarioLabel(indicator, normalizedCurrent, override)
    });
  }

  return options;
}

const INDICATOR_MAPPING = {
  'operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['comercial', 'aviacion comercial'],
    excludePatterns: ['carga', 'fbo', 'general', 'toneladas'],
    priority: 1
  },
  'passengers': {
    patterns: ['pasajeros', 'pasajero'],
    areaPatterns: ['comercial', 'aviacion comercial'],
    excludePatterns: ['carga', 'fbo', 'general'],
    priority: 1
  },
  'cargo-operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['carga', 'aviacion carga'],
    excludePatterns: ['pasajeros', 'fbo', 'general', 'toneladas'],
    priority: 2
  },
  'cargo-weight': {
    patterns: ['toneladas', 'tonelada', 'peso', 'kg'],
    areaPatterns: ['carga', 'aviacion carga'],
    excludePatterns: ['operaciones', 'pasajeros', 'fbo', 'general'],
    priority: 2
  },
  'fbo-operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['fbo', 'general', 'aviacion general', 'ejecutiva'],
    excludePatterns: ['carga', 'comercial', 'pasajeros', 'toneladas'],
    priority: 3
  },
  'fbo-passengers': {
    patterns: ['pasajeros', 'pasajero'],
    areaPatterns: ['fbo', 'general', 'aviacion general', 'ejecutiva'],
    excludePatterns: ['carga', 'comercial', 'operaciones'],
    priority: 3
  }
};

let activeModalChart = null;
let modalContainer = null;
// Funciones auxiliares para obtener y procesar datos reales

const TARGET_SCENARIO_PRIORITY = ['MEDIO', 'ALTO', 'BAJO'];
const META_SCENARIO_DISPLAY_ORDER = ['MEDIO', 'ALTO', 'BAJO'];
const META_SCENARIO_COLORS = {
  MEDIO: {
    border: '#f97316',
    backgroundLine: 'rgba(249, 115, 22, 0.15)',
    backgroundBar: 'rgba(249, 115, 22, 0.85)'
  },
  ALTO: {
    border: '#16a34a',
    backgroundLine: 'rgba(22, 163, 74, 0.15)',
    backgroundBar: 'rgba(22, 163, 74, 0.85)'
  },
  BAJO: {
    border: '#0ea5e9',
    backgroundLine: 'rgba(14, 165, 233, 0.15)',
    backgroundBar: 'rgba(14, 165, 233, 0.85)'
  }
};

function buildHistoryFallbackFromTargets(targets = []) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [];
  }

  const scenario = TARGET_SCENARIO_PRIORITY.find(candidate =>
    targets.some(target => target?.escenario === candidate)
  );

  if (!scenario) {
    return [];
  }

  return targets
    .filter(target => target?.escenario === scenario)
    .map(target => ({
      ...target,
      anio: Number(target?.anio) || target?.anio || null,
      mes: Number(target?.mes) || target?.mes || null,
      valor: Number(target?.valor),
      escenario: scenario,
      es_meta: true,
      fuente: 'indicador_metas'
    }))
    .filter(item => Number.isFinite(item.anio) && Number.isFinite(item.mes) && Number.isFinite(item.valor))
    .sort((a, b) => {
      if (a.anio === b.anio) {
        return a.mes - b.mes;
      }
      return a.anio - b.anio;
    });
}

async function getIndicatorRealData(indicatorId) {
  if (!indicatorId) return null;

  try {
    const indicatorPromise = (async () => {
      if (cachedIndicators === null) {
        const fetchedIndicators = await getIndicators();
        cachedIndicators = Array.isArray(fetchedIndicators) ? fetchedIndicators : [];
      }

      const indicators = Array.isArray(cachedIndicators) ? cachedIndicators : [];
      return indicators.find(i => i.id === indicatorId);
    })();

    const [historyRaw, targetsRaw, indicator] = await Promise.all([
      getIndicatorHistory(indicatorId, { limit: 120 }),
      getIndicatorTargets(indicatorId),
      indicatorPromise
    ]);

    const targets = Array.isArray(targetsRaw) ? targetsRaw : [];
    let history = Array.isArray(historyRaw) ? historyRaw : [];

    if (!history.length && targets.length) {
      const fallbackHistory = buildHistoryFallbackFromTargets(targets);
      if (fallbackHistory.length) {
        history = fallbackHistory;
      }
    }

    return {
      indicator,
      history,
      targets
    };
  } catch (error) {
    console.error('Error obteniendo datos del indicador:', error);
    return null;
  }
}

function getLastLoadedMonth(history = []) {
  if (!history.length) return null;

  const sorted = [...history].sort((a, b) => {
    if (a.anio !== b.anio) return b.anio - a.anio;
    return b.mes - a.mes;
  });

  return sorted[0] ? { year: sorted[0].anio, month: sorted[0].mes } : null;
}

function isCapturedPeriod(year, month, lastLoaded) {
  if (!lastLoaded) return false;
  if (year < lastLoaded.year) return true;
  if (year === lastLoaded.year && month <= lastLoaded.month) return true;
  return false;
}

function filterCompleteQuarters(history = [], currentYear) {
  const lastLoaded = getLastLoadedMonth(history);
  if (!lastLoaded || lastLoaded.year !== currentYear) {
    return 4;
  }
  
  const lastMonth = lastLoaded.month;
  return Math.floor(lastMonth / 3);
}

function getDataByYear(history = [], year) {
  return history
    .filter(item => item.anio === year)
    .sort((a, b) => a.mes - b.mes);
}

function aggregateQuarterlyData(history = [], year, maxQuarter = 4) {
  const quarters = [];

  for (let q = 1; q <= maxQuarter; q++) {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    
    const quarterData = history.filter(
      item => item.anio === year && item.mes >= startMonth && item.mes <= endMonth
    );
    
    if (quarterData.length === 3) {
      const total = quarterData.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
      quarters.push({
        quarter: q,
        label: `Q${q}`,
        value: total,
        months: quarterData
      });
    }
  }

  return quarters;
}

function buildScenarioTargetValues(targets = [], scenario, year) {
  const values = Array(12).fill(null);
  const map = new Map();

  if (!Array.isArray(targets) || !scenario) {
    return { values, map };
  }

  const filtered = targets
    .filter(item => item.anio === year && item.escenario === scenario)
    .map(item => ({
      month: Number(item.mes),
      value: Number(item.valor)
    }))
    .filter(item => Number.isFinite(item.month) && !Number.isNaN(item.value))
    .sort((a, b) => a.month - b.month);

  if (!filtered.length) {
    return { values, map };
  }

  const explicit = new Map();
  filtered.forEach(entry => {
    if (entry.month >= 1 && entry.month <= 12) {
      explicit.set(entry.month, entry.value);
    }
  });

  const firstEntry = filtered[0];
  let lastKnown = null;

  for (let month = 1; month <= 12; month++) {
    if (explicit.has(month)) {
      lastKnown = explicit.get(month);
    }

    if (lastKnown != null) {
      values[month - 1] = lastKnown;
      map.set(month, lastKnown);
    }
  }

  if (firstEntry && firstEntry.value != null) {
    const fallbackValue = firstEntry.value;
    const firstMonth = firstEntry.month;

    for (let month = 1; month <= 12; month++) {
      if (values[month - 1] == null && (!firstMonth || month <= firstMonth)) {
        values[month - 1] = fallbackValue;
        map.set(month, fallbackValue);
      }
    }
  }

  return { values, map };
}

function buildQuarterScenarioMap(targets = [], year) {
  const scenarioMap = new Map();
  const numericYear = Number(year);

  if (!Array.isArray(targets) || !Number.isFinite(numericYear)) {
    return scenarioMap;
  }

  targets.forEach(target => {
    const targetYear = Number(target?.anio);
    if (!Number.isFinite(targetYear) || targetYear !== numericYear) {
      return;
    }

    const scenario = normalizeScenarioValue(target?.escenario);
    const month = Number(target?.mes);
    const value = Number(target?.valor);

    if (!scenario || !Number.isFinite(month) || !Number.isFinite(value)) {
      return;
    }

    if (month < 1 || month > 12) {
      return;
    }

    const quarterIndex = Math.ceil(month / 3) - 1;
    if (quarterIndex < 0 || quarterIndex >= QUARTER_LABELS.length) {
      return;
    }

    if (!scenarioMap.has(scenario)) {
      scenarioMap.set(scenario, Array(QUARTER_LABELS.length).fill(null));
    }

    const values = scenarioMap.get(scenario);
    const previousValue = values[quarterIndex];
    const shouldUpdate = previousValue == null || month % 3 === 0;

    if (shouldUpdate) {
      values[quarterIndex] = value;
    }
  });

  return scenarioMap;
}

function findIndicatorByDataKey(indicators, dataKey) {
  if (typeof dataKey === 'string' && dataKey.startsWith(DIRECT_INDICATOR_PREFIX)) {
    const indicatorId = dataKey.slice(DIRECT_INDICATOR_PREFIX.length);
    if (!indicatorId) return null;
    return (indicators || []).find(indicator => indicator?.id === indicatorId) ?? null;
  }

  const config = INDICATOR_MAPPING[dataKey];
  if (!config) {
    console.warn(`No hay configuración de mapeo para: ${dataKey}`);
    return null;
  }

  const scored = indicators.map(ind => {
    const normalizedName = normalizeMatchText(ind.nombre);
    const normalizedDesc = normalizeMatchText(ind.descripcion);
    const normalizedArea = normalizeMatchText(ind.area_nombre);
    const searchText = `${normalizedName} ${normalizedDesc} ${normalizedArea}`;
    
    let score = 0;
    
    if (config.excludePatterns.some(pattern => searchText.includes(pattern))) {
      return { indicator: ind, score: -1000 };
    }
    
    config.patterns.forEach(pattern => {
      if (normalizedName.includes(pattern)) score += 100;
      if (normalizedDesc.includes(pattern)) score += 50;
    });
    
    config.areaPatterns.forEach(pattern => {
      if (normalizedArea.includes(pattern)) score += 80;
      if (searchText.includes(pattern)) score += 40;
    });
    
    const mainPattern = config.patterns[0];
    if (normalizedName.startsWith(mainPattern)) score += 50;
    
    return { indicator: ind, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  if (scored[0] && scored[0].score > 0) {
    if (window.DEBUG_INDICATORS) {
      console.log(`✅ Match encontrado para ${dataKey}:`, {
        indicador: scored[0].indicator.nombre,
        score: scored[0].score
      });
    }
    return scored[0].indicator;
  }
  
  if (window.DEBUG_INDICATORS) {
    console.warn(`❌ No se encontró match para ${dataKey}`);
  }
  
  return null;
}

function sum(values = []) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildValueTimeline(records = []) {
  return records
    .map(item => ({
      year: Number(item?.anio),
      month: Number(item?.mes ?? 0),
      value: toNumber(item?.valor)
    }))
    .filter(item => Number.isFinite(item.year) && Number.isFinite(item.month) && item.value !== null)
    .sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });
}

function buildTimelineIndex(timeline = []) {
  const map = new Map();
  timeline.forEach((entry, index) => {
    const key = `${entry.year}-${entry.month}`;
    if (!map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

function findPreviousTimelineEntry(timeline = [], indexMap = new Map(), year, month) {
  const comparisonYear = Number(year) - 1;
  const comparisonMonth = Number(month);
  if (!Number.isFinite(comparisonYear) || !Number.isFinite(comparisonMonth)) {
    return null;
  }

  const key = `${comparisonYear}-${comparisonMonth}`;
  if (!indexMap.has(key)) {
    return null;
  }

  return timeline[indexMap.get(key)] ?? null;
}

function computeTotals(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const hasCurrent = rows.some(row => toNumber(row?.current) !== null);
  const hasComparison = rows.some(row => toNumber(row?.comparison) !== null);

  if (!hasCurrent && !hasComparison) {
    return null;
  }

  const currentSum = hasCurrent
    ? rows.reduce((total, row) => {
        const value = toNumber(row?.current);
        return total + (value ?? 0);
      }, 0)
    : null;

  const comparisonSum = hasComparison
    ? rows.reduce((total, row) => {
        const value = toNumber(row?.comparison);
        return total + (value ?? 0);
      }, 0)
    : null;

  const diff =
    hasCurrent && hasComparison && comparisonSum !== null
      ? (currentSum ?? 0) - (comparisonSum ?? 0)
      : null;

  const canComputePct =
    hasComparison && comparisonSum !== null && comparisonSum !== 0 && hasCurrent;

  const pct = canComputePct ? diff / comparisonSum : null;

  return {
    current: hasCurrent ? currentSum : null,
    comparison: hasComparison ? comparisonSum : null,
    diff,
    pct
  };
}

function addMonths(baseYear, baseMonth, offset) {
  const year = Number(baseYear) || 2000;
  const month = Number(baseMonth) || 1;
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function formatMonthLabel(year, month) {
  const entry = MONTHS[(Number(month) || 1) - 1];
  if (!entry) {
    return `${month}/${year}`;
  }
  return `${entry.label} ${year}`;
}

function formatTrendLabel(year, month, referenceYear = null) {
  const entry = MONTHS[(Number(month) || 1) - 1];
  const shortLabel = entry ? entry.short : `Mes ${month}`;
  if (referenceYear !== null && Number(year) === Number(referenceYear)) {
    return shortLabel;
  }
  const shortYear = String(year).slice(-2);
  return `${shortLabel} ${shortYear}`;
}

function forecastWithHoltLinear(series, steps, alpha = 0.5, beta = 0.3) {
  if (series.length === 0 || steps <= 0) {
    return [];
  }

  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;

  if (!Number.isFinite(level)) level = 0;
  if (!Number.isFinite(trend)) trend = 0;

  const fallbackValue = Number.isFinite(series[series.length - 1])
    ? series[series.length - 1]
    : level;

  for (let index = 1; index < series.length; index += 1) {
    const value = series[index];
    if (!Number.isFinite(value)) {
      continue;
    }
    const previousLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }

  const predictions = [];
  for (let step = 1; step <= steps; step += 1) {
    const value = level + step * trend;
    predictions.push(Number.isFinite(value) ? value : fallbackValue);
  }
  return predictions;
}

function forecastWithHoltWinters(series, steps, {
  alpha = 0.4,
  beta = 0.3,
  gamma = 0.3,
  seasonLength = 12
} = {}) {
  if (series.length < 2 || steps <= 0) {
    return [];
  }

  const maxSeason = Math.min(seasonLength, Math.floor(series.length / 2));
  if (!Number.isFinite(maxSeason) || maxSeason < 2) {
    return forecastWithHoltLinear(series, steps, alpha, beta);
  }

  const effectiveSeasonLength = maxSeason;
  const seasonCount = Math.floor(series.length / effectiveSeasonLength);
  if (seasonCount < 2) {
    return forecastWithHoltLinear(series, steps, alpha, beta);
  }

  const seasonals = new Array(effectiveSeasonLength).fill(0);
  const seasonAverages = [];
  for (let seasonIndex = 0; seasonIndex < seasonCount; seasonIndex += 1) {
    const start = seasonIndex * effectiveSeasonLength;
    let sum = 0;
    for (let offset = 0; offset < effectiveSeasonLength; offset += 1) {
      sum += series[start + offset];
    }
    seasonAverages.push(sum / effectiveSeasonLength);
  }

  for (let position = 0; position < effectiveSeasonLength; position += 1) {
    let sum = 0;
    for (let seasonIndex = 0; seasonIndex < seasonCount; seasonIndex += 1) {
      const value = series[seasonIndex * effectiveSeasonLength + position];
      sum += value - seasonAverages[seasonIndex];
    }
    seasonals[position] = sum / seasonCount;
  }

  let level = seasonAverages[0];
  if (!Number.isFinite(level)) {
    level = series[0];
  }
  let trendSum = 0;
  for (let i = 0; i < effectiveSeasonLength; i += 1) {
    const first = series[i];
    const second = series[i + effectiveSeasonLength];
    if (Number.isFinite(first) && Number.isFinite(second)) {
      trendSum += (second - first) / effectiveSeasonLength;
    }
  }
  let trend = trendSum / effectiveSeasonLength;
  if (!Number.isFinite(trend)) {
    trend = 0;
  }

  const fallbackValue = Number.isFinite(series[series.length - 1])
    ? series[series.length - 1]
    : level;

  for (let index = 0; index < series.length; index += 1) {
    const value = series[index];
    if (!Number.isFinite(value)) {
      continue;
    }
    const seasonIndex = index % effectiveSeasonLength;
    const previousLevel = level;
    const seasonal = seasonals[seasonIndex];
    level = alpha * (value - seasonal) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonals[seasonIndex] = gamma * (value - level) + (1 - gamma) * seasonal;
  }

  const predictions = [];
  for (let step = 1; step <= steps; step += 1) {
    const seasonIndex = (series.length + step - 1) % effectiveSeasonLength;
    const value = level + step * trend + seasonals[seasonIndex];
    predictions.push(Number.isFinite(value) ? value : fallbackValue);
  }

  return predictions;
}

function forecastExponentialSmoothing(values = [], steps = 6, options = {}) {
  const series = values.map(toNumber).filter(value => value !== null);

  if (series.length < 3 || steps <= 0) {
    return [];
  }

  return forecastWithHoltWinters(series, steps, options);
}

function computeForecastData(realData, type, { periods = 6 } = {}) {
  if (!realData?.history?.length) {
    return null;
  }

  if (type !== 'monthly' && type !== 'scenario') {
    return null;
  }

  const sortedHistory = [...realData.history]
    .map(item => ({
      year: Number(item?.anio),
      month: Number(item?.mes ?? 0),
      value: toNumber(item?.valor)
    }))
    .filter(item => Number.isFinite(item.year) && Number.isFinite(item.month) && item.value !== null)
    .sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });

  if (!sortedHistory.length) {
    return null;
  }

  const numericSeries = sortedHistory.map(item => item.value);
  if (numericSeries.length < 4) {
    return null;
  }

  const predictions = forecastExponentialSmoothing(numericSeries, periods, { seasonLength: 12 });
  if (!predictions.length) {
    return null;
  }

  const latestRecord = sortedHistory[sortedHistory.length - 1];
  const anchorIndex = (latestRecord.month || 1) - 1;
  const anchorValue = latestRecord.value;

  const rows = [];
  const chartPoints = [];

  predictions.forEach((value, index) => {
    const { year, month } = addMonths(latestRecord.year, latestRecord.month, index + 1);
    rows.push({
      label: formatMonthLabel(year, month),
      current: value,
      comparison: null,
      diff: null,
      pct: null
    });
    chartPoints.push({
      label: formatTrendLabel(year, month, latestRecord.year),
      value,
      year,
      monthIndex: (Number(month) || 1) - 1
    });
  });

  const totals = computeTotals(rows);

  return {
    rows,
    totals,
    chartPoints,
    anchor: {
      index: anchorIndex,
      value: anchorValue
    }
  };
}
function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(value));
}

function formatDecimal(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function resolvePercentageDigits(value, override) {
  if (typeof override === 'number' && override >= 0) {
    return override;
  }

  const percentageValue = Math.abs(Number(value)) * 100;
  if (!Number.isFinite(percentageValue)) {
    return 1;
  }

  if (percentageValue === 0) {
    return 1;
  }

  if (percentageValue >= 1) {
    return 1;
  }

  if (percentageValue >= 0.1) {
    return 2;
  }

  return 3;
}

function formatPercentage(value, digits = null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const fractionDigits = resolvePercentageDigits(value, digits);
  return new Intl.NumberFormat('es-MX', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number(value));
}

function formatSignedNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const absolute = Math.abs(Number(value));
  const formatted = formatNumber(absolute);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function normalizeUnit(unit) {
  return (unit ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function shouldFormatAsInteger(unit) {
  const normalized = normalizeUnit(unit);

  if (!normalized) {
    return false;
  }

  return normalized.includes('pasajero') || normalized.includes('operacion');
}

function resolveNumberDigitsByUnit(unit) {
  return shouldFormatAsInteger(unit) ? 0 : 2;
}

function formatUnitValue(
  value,
  unit,
  { numberDigits, percentageDigits = 3, percentageScale } = {}
) {
  const resolvedNumberDigits =
    typeof numberDigits === 'number' ? numberDigits : resolveNumberDigitsByUnit(unit);
  const resolvedPercentageScale = percentageScale ?? 'auto';

  return formatValueByUnit(value, unit, {
    numberDecimals: resolvedNumberDigits,
    percentageDecimals: percentageDigits,
    percentageScale: resolvedPercentageScale
  });
}

function formatSignedUnitValue(value, unit, options = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const numeric = Number(value);
  const formatted = formatUnitValue(numeric, unit, options);
  if (formatted === '—') return '—';
  return numeric > 0 ? `+${formatted}` : formatted;
}

function findLatestIndex(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] != null && !Number.isNaN(Number(values[index]))) {
      return index;
    }
  }
  return values.length - 1;
}

function getTrendColorClasses(value, { invert = false } = {}) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric === 0) {
    return {
      text: 'text-slate-600',
      badge: 'bg-slate-100 text-slate-600'
    };
  }

  const shouldTreatPositiveAsGood = !invert;

  if (numeric > 0) {
    return shouldTreatPositiveAsGood
      ? { text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' }
      : { text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600' };
  }

  return shouldTreatPositiveAsGood
    ? { text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600' }
    : { text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' };
}

function escapeHtml(value) {
  if (value == null) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSummary(realData, type, scenario) {
  if (!realData || !realData.history.length) {
    return {
      title: 'Sin datos disponibles',
      currentLabel: 'Actual',
      comparisonLabel: 'Anterior',
      currentValue: null,
      comparisonValue: null,
      diff: null,
      pct: null
    };
  }

  const { history } = realData;
  const currentYear = CURRENT_YEAR;
  const lastLoaded = getLastLoadedMonth(history);
  const timeline = buildValueTimeline(history);
  const timelineIndex = buildTimelineIndex(timeline);

  const indicator = realData?.indicator;
  
  if (!lastLoaded) {
    return {
      title: 'Sin datos disponibles',
      currentLabel: 'Actual',
      comparisonLabel: 'Anterior',
      currentValue: null,
      comparisonValue: null,
      diff: null,
      pct: null
    };
  }

  if (type === 'monthly') {
    const latestMonth = lastLoaded.month;
    const latestYear = lastLoaded.year;
    const month = MONTHS[latestMonth - 1] || MONTHS[MONTHS.length - 1];

    const currentItem = history.find(
      item => item.anio === latestYear && item.mes === latestMonth
    );

    const comparisonEntry = findPreviousTimelineEntry(timeline, timelineIndex, latestYear, latestMonth);
    const comparisonValue = comparisonEntry ? comparisonEntry.value : null;
    const comparisonLabel = comparisonEntry
      ? `${MONTHS[comparisonEntry.month - 1]?.label || comparisonEntry.month} ${comparisonEntry.year}`
      : 'Mes anterior';

    const current = currentItem ? Number(currentItem.valor) : null;
    const diff = current != null && comparisonValue != null ? current - comparisonValue : null;
    const pct = diff != null && comparisonValue ? diff / comparisonValue : null;

    return {
      title: `Variación mensual (${month.label} ${latestYear})`,
      currentLabel: `${month.label} ${latestYear}`,
      comparisonLabel,
      currentValue: current,
      comparisonValue,
      diff,
      pct
    };
  }

  if (type === 'quarterly') {
    const completeQuarters = filterCompleteQuarters(history, currentYear);
    
    // Nombres completos de trimestres
    const quarterNames = ['Primer Trimestre', 'Segundo Trimestre', 'Tercer Trimestre', 'Cuarto Trimestre'];
    
    if (completeQuarters === 0) {
      return {
        title: 'Sin trimestres completos',
        currentLabel: `${currentYear}`,
        comparisonLabel: `${currentYear - 1}`,
        currentValue: null,
        comparisonValue: null,
        diff: null,
        pct: null
      };
    }
    
    const currentQuarters = aggregateQuarterlyData(history, currentYear, completeQuarters);
    const previousQuarters = aggregateQuarterlyData(history, currentYear - 1, completeQuarters);
    
    const latest = currentQuarters[currentQuarters.length - 1];
    const previousLatest = previousQuarters[previousQuarters.length - 1];
    
    return {
      title: `Comparativo trimestral (Q${latest?.quarter || 1} ${currentYear})`,
      currentLabel: `${currentYear}`,
      comparisonLabel: `${currentYear - 1}`,
      currentValue: latest?.value ?? null,
      comparisonValue: previousLatest?.value ?? null,
      diff: latest && previousLatest ? latest.value - previousLatest.value : null,
      pct:
        latest && previousLatest && previousLatest.value
          ? (latest.value - previousLatest.value) / previousLatest.value
          : null
    };
  }

  if (type === 'annual') {
    const currentData = getDataByYear(history, currentYear);
    const previousData = getDataByYear(history, currentYear - 1);
    
    const current = sum(currentData.map(item => item.valor));
    const comparison = sum(previousData.map(item => item.valor));
    
    const diff = current - comparison;
    const pct = comparison ? diff / comparison : null;
    
    return {
      title: `Acumulado anual (${currentYear})`,
      currentLabel: `${currentYear}`,
      comparisonLabel: `${currentYear - 1}`,
      currentValue: current,
      comparisonValue: comparison,
      diff,
      pct
    };
  }

  // Para escenarios
  const latestMonth = lastLoaded.month;
  const latestYear = lastLoaded.year;
  const month = MONTHS[latestMonth - 1];

  const currentItem = history.find(
    item => item.anio === latestYear && item.mes === latestMonth
  );

  const effectiveScenario = scenario;
  const scenarioLabel = getIndicatorScenarioLabel(indicator, effectiveScenario);
  const metaOnlyHistory = history.every(item => item?.es_meta);

  if (metaOnlyHistory) {
    const normalizedLatestMonth = Number.isFinite(latestMonth) ? latestMonth : 1;
    const normalizedLatestYear = Number.isFinite(latestYear) ? latestYear : currentYear;
    const quarterIndex = Math.max(
      0,
      Math.min(QUARTER_LABELS.length - 1, Math.ceil(normalizedLatestMonth / 3) - 1)
    );
    const quarterLabel = QUARTER_LABELS[quarterIndex] ?? `Trimestre ${quarterIndex + 1}`;
    const quarterScenarioMap = buildQuarterScenarioMap(realData?.targets ?? [], normalizedLatestYear);

    if (quarterScenarioMap.size) {
      const programLabel = getIndicatorScenarioLabel(indicator, 'MEDIO') || 'Meta Programada';
      const achievedLabel = getIndicatorScenarioLabel(indicator, 'ALTO') || 'Meta Alcanzada';

      const resolveQuarterValue = scenarioCode => {
        const normalizedScenario = normalizeScenarioValue(scenarioCode);
        if (!normalizedScenario) {
          return null;
        }

        const values = quarterScenarioMap.get(normalizedScenario);
        if (Array.isArray(values)) {
          const value = values[quarterIndex];
          if (value != null && !Number.isNaN(Number(value))) {
            return Number(value);
          }
        }

        const fallbackTarget = (realData?.targets ?? []).find(target => {
          const targetScenario = normalizeScenarioValue(target?.escenario);
          if (targetScenario !== normalizedScenario) {
            return false;
          }

          const targetYear = Number(target?.anio);
          if (!Number.isFinite(targetYear) || targetYear !== normalizedLatestYear) {
            return false;
          }

          const targetQuarterIndex = Math.ceil(Number(target?.mes) / 3) - 1;
          return targetQuarterIndex === quarterIndex;
        });

        if (fallbackTarget && fallbackTarget.valor != null) {
          const numeric = Number(fallbackTarget.valor);
          if (!Number.isNaN(numeric)) {
            return numeric;
          }
        }

        if (currentItem && normalizeScenarioValue(currentItem.escenario) === normalizedScenario) {
          const numeric = Number(currentItem.valor);
          if (!Number.isNaN(numeric)) {
            return numeric;
          }
        }

        return null;
      };

      const programValue = resolveQuarterValue('MEDIO');
      const achievedValue = resolveQuarterValue('ALTO');
      const diff =
        programValue != null && achievedValue != null ? achievedValue - programValue : null;
      const pct = diff != null && programValue ? diff / programValue : null;

      return {
        title: `${programLabel} vs ${achievedLabel} (${quarterLabel} ${normalizedLatestYear})`,
        currentLabel: programLabel,
        comparisonLabel: achievedLabel,
        currentValue: programValue,
        comparisonValue: achievedValue,
        diff,
        pct
      };
    }

    const currentValue = currentItem ? Number(currentItem.valor) : null;

    return {
      title: `${scenarioLabel || 'Meta'} (${quarterLabel} ${normalizedLatestYear})`,
      currentLabel: scenarioLabel || 'Meta Programada',
      comparisonLabel: '—',
      currentValue,
      comparisonValue: null,
      diff: null,
      pct: null
    };
  }

  const { map: targetValues } = buildScenarioTargetValues(realData.targets, effectiveScenario, latestYear);

  const current = currentItem ? Number(currentItem.valor) : null;
  const comparison = targetValues.get(latestMonth) ?? null;
  const diff = current != null && comparison != null ? current - comparison : null;
  const pct = diff != null && comparison ? diff / comparison : null;

  const comparisonLabel = scenarioLabel || 'Meta';
  const titleLabel = scenarioLabel || 'Meta';

  return {
    title: `${titleLabel} (${month?.label || ''} ${latestYear})`,
    currentLabel: 'Real',
    comparisonLabel,
    currentValue: current,
    comparisonValue: comparison,
    diff,
    pct
  };
}


function buildTableContent(realData, type, scenario, options = {}) {
  const { showHistorical = false, showTrend = false, forecastData = null } = options;
  const currentYear = CURRENT_YEAR;
  const indicator = realData?.indicator ?? null;
  const invertScenarioDiff = type === 'scenario' && indicatorPrefersLowerValues(indicator);
  const scenarioLabel = type === 'scenario' ? getIndicatorScenarioLabel(indicator, scenario) : null;
  const comparisonHeaderLabel = type === 'scenario' ? scenarioLabel || 'Meta' : 'Mismo mes año anterior';
  const variationReferenceLabel = type === 'scenario' ? scenarioLabel || 'Meta' : 'mismo mes año anterior';
  const historicalYears = showHistorical
    ? Array.from({ length: 4 }, (_, index) => currentYear - (3 - index)).filter(year => year > 0)
    : [];
  const hasHistoricalYears = showHistorical && historicalYears.length > 0;

  const history = Array.isArray(realData?.history) ? realData.history : [];
  const metaOnlyScenario = type === 'scenario' && history.length > 0 && history.every(item => item?.es_meta);
  let metaScenarioMap = null;
  let metaScenarioColumns = [];

  if (metaOnlyScenario) {
    const historyYears = history
      .map(item => Number(item?.anio))
      .filter(Number.isFinite);
    const metaYear = historyYears.length ? Math.max(...historyYears) : currentYear;
    metaScenarioMap = buildQuarterScenarioMap(realData?.targets ?? [], metaYear);

    if (metaScenarioMap.size) {
      const prioritized = META_SCENARIO_DISPLAY_ORDER.filter(code => metaScenarioMap.has(code));
      const extras = Array.from(metaScenarioMap.keys()).filter(code => !prioritized.includes(code));
      metaScenarioColumns = [...prioritized, ...extras];
    }
  }

  let headerCells = ['<th class="px-4 py-2 text-left">Periodo</th>'];

  if (metaOnlyScenario) {
    if (!metaScenarioColumns.length) {
      headerCells.push(
        `<th class="px-4 py-2 text-right">${escapeHtml(scenarioLabel || 'Meta Programada')}</th>`
      );
    } else {
      metaScenarioColumns.forEach(code => {
        const labelText = getIndicatorScenarioLabel(indicator, code) || code;
        headerCells.push(
          `<th class="px-4 py-2 text-right">${escapeHtml(labelText)}</th>`
        );
      });
    }
  } else if (hasHistoricalYears) {
    headerCells = headerCells.concat(
      historicalYears.map((year, index, array) =>
        `<th class="px-4 py-2 text-right ${
          index === array.length - 1 ? 'text-slate-700' : 'text-slate-500'
        }">${year}</th>`
      )
    );
  } else {
    headerCells.push('<th class="px-4 py-2 text-right">Real</th>');
  }

  if (!metaOnlyScenario && !hasHistoricalYears) {
    headerCells.push(
      `<th class="px-4 py-2 text-right">${escapeHtml(comparisonHeaderLabel)}</th>`
    );
  }

  const variationNote = metaOnlyScenario
    ? ''
    : `<div class="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">vs. ${escapeHtml(variationReferenceLabel)}</div>`;

  if (!metaOnlyScenario) {
    headerCells.push(
      hasHistoricalYears
        ? `<th class="px-4 py-2 text-right">Variación${variationNote}</th>`
        : `<th class="px-4 py-2 text-right">Variación${variationNote}</th>`
    );

    headerCells.push(
      hasHistoricalYears
        ? `<th class="px-4 py-2 text-right">% Variación${variationNote}</th>`
        : `<th class="px-4 py-2 text-right">% Variación${variationNote}</th>`
    );
  }

  const totalColumns = headerCells.length;

  const headerMarkup = `<tr>${headerCells.join('')}</tr>`;

  if (!realData || !history.length) {
    return {
      headerMarkup,
      bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td></tr>`
    };
  }

  const lastLoaded = getLastLoadedMonth(history);
  const timeline = buildValueTimeline(history);
  const timelineIndex = buildTimelineIndex(timeline);
  const unit = indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatUnit = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });
  const formatSignedUnit = value =>
    formatSignedUnitValue(value, unit, {
      numberDigits,
      percentageDigits: 3,
      percentageScale
    });

  if (!lastLoaded) {
    return {
      headerMarkup,
      bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td></tr>`
    };
  }

  let rows = [];
  let metaRows = null;

  if (type === 'monthly') {
    const currentData = getDataByYear(history, currentYear);
    const previousYear = currentYear - 1;
    const previousYearData = getDataByYear(history, previousYear);
    const toNumeric = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const currentMap = new Map();
    currentData.forEach(item => {
      const numeric = toNumeric(item.valor);
      if (numeric != null) {
        currentMap.set(item.mes, numeric);
      }
    });

    const previousMap = new Map();
    previousYearData.forEach(item => {
      const numeric = toNumeric(item.valor);
      if (numeric != null) {
        previousMap.set(item.mes, numeric);
      }
    });

    const historicalMaps = new Map();
    historicalYears.forEach(year => {
      const yearData = getDataByYear(history, year);
      const monthMap = new Map();
      yearData.forEach(item => {
        const numeric = toNumeric(item.valor);
        if (numeric != null) {
          monthMap.set(item.mes, numeric);
        }
      });
      historicalMaps.set(year, monthMap);
    });

    const monthsToRender = showHistorical
      ? Array.from({ length: 12 }, (_, index) => index + 1)
      : Array.from(new Set(currentData.map(item => item.mes))).sort((a, b) => a - b);

    rows = monthsToRender.map(monthNumber => {
      const current = currentMap.has(monthNumber) ? currentMap.get(monthNumber) : null;
      if (current === null) {
        return null;
      }

      const comparison = previousMap.has(monthNumber) ? previousMap.get(monthNumber) : null;
      const diff = current != null && comparison != null ? current - comparison : null;
      const pct = diff !== null && comparison !== null && comparison !== 0 ? diff / comparison : null;

      const historicalValues = showHistorical
        ? historicalYears.map(year => {
            const map = historicalMaps.get(year);
            return map?.has(monthNumber) ? map.get(monthNumber) : null;
          })
        : [];

      return {
        label: MONTHS[monthNumber - 1]?.label || `Mes ${monthNumber}`,
        current,
        comparison,
        diff,
        pct,
        historicalValues
      };
    }).filter(Boolean);
  } else if (type === 'quarterly') {
    const completeQuarters = filterCompleteQuarters(history, currentYear);

    if (completeQuarters === 0) {
      return {
        headerMarkup,
        bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay trimestres completos disponibles</td></tr>`
      };
    }

    const currentQuarters = aggregateQuarterlyData(history, currentYear, completeQuarters);
    const previousQuarters = aggregateQuarterlyData(history, currentYear - 1, completeQuarters);
    const previousMap = new Map();
    previousQuarters.forEach(q => {
      previousMap.set(q.quarter, q.value);
    });

    const historicalMaps = new Map();
    historicalYears.forEach(year => {
      const quarters = aggregateQuarterlyData(history, year, 4);
      const map = new Map();
      quarters.forEach(q => {
        map.set(q.quarter, q.value);
      });
      historicalMaps.set(year, map);
    });

    rows = currentQuarters.map(q => {
      const current = q.value;
      const hasComparison = previousMap.has(q.quarter);
      const comparison = hasComparison ? previousMap.get(q.quarter) : null;
      const diff = comparison != null ? current - comparison : null;
      const pct = diff !== null && comparison != null && comparison !== 0 ? diff / comparison : null;

      const historicalValues = showHistorical
        ? historicalYears.map(year => {
            const map = historicalMaps.get(year);
            return map?.has(q.quarter) ? map.get(q.quarter) : null;
          })
        : [];

      return {
        label: `Trimestre ${q.quarter}`,
        current,
        comparison,
        diff,
        pct,
        historicalValues
      };
    });
  } else if (type === 'annual') {
    const years = Array.from(new Set(history.map(item => item.anio)))
      .sort((a, b) => b - a)
      .slice(0, 5);

    rows = years.map((year, index) => {
      const yearData = getDataByYear(history, year);
      const current = sum(yearData.map(item => item.valor));
      const previousYear = years[index + 1];
      const previousYearData = previousYear ? getDataByYear(history, previousYear) : [];
      const comparison = previousYearData.length ? sum(previousYearData.map(item => item.valor)) : null;
      const diff = comparison !== null ? current - comparison : null;
      const pct = diff !== null && comparison ? diff / comparison : null;

      return {
        label: `${year}`,
        current,
        comparison,
        diff,
        pct,
        historicalValues: showHistorical ? historicalYears.map(() => null) : []
      };
    });
  } else {
    const effectiveYear = lastLoaded?.year ?? currentYear;
    const currentData = getDataByYear(history, effectiveYear);

    if (metaOnlyScenario) {
      if (metaScenarioColumns.length && metaScenarioMap?.size) {
        const quarterPresence = QUARTER_LABELS.map((_, index) =>
          metaScenarioColumns.some(code => {
            const values = metaScenarioMap.get(code) ?? [];
            const value = values[index];
            return value != null && !Number.isNaN(Number(value));
          })
        );

        const hasMetaValues = quarterPresence.some(Boolean);

        if (hasMetaValues) {
          const latestQuarterIndex = findLatestIndex(
            quarterPresence.map(flag => (flag ? 1 : null))
          );

          metaRows = Array.from({ length: latestQuarterIndex + 1 }, (_, index) => ({
            label: QUARTER_LABELS[index] ?? `Trimestre ${index + 1}`,
            values: metaScenarioColumns.map(code => ({
              scenario: code,
              value: metaScenarioMap.get(code)?.[index] ?? null
            }))
          }));
        } else {
          metaRows = [];
        }
      } else {
        const quarterMap = new Map();

        currentData.forEach(item => {
          const month = Number(item.mes);
          const value = Number(item.valor);
          if (!Number.isFinite(month) || !Number.isFinite(value)) {
            return;
          }
          const quarter = Math.ceil(month / 3);
          if (quarter >= 1 && quarter <= 4) {
            quarterMap.set(quarter, value);
          }
        });

        metaRows = Array.from(quarterMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([quarter, value]) => ({
            label: QUARTER_LABELS[quarter - 1] ?? `Trimestre ${quarter}`,
            values: [
              {
                scenario: scenario,
                value
              }
            ]
          }));
      }
    } else {
      const { map: targetMap } = buildScenarioTargetValues(realData.targets, scenario, effectiveYear);

      rows = currentData.map(item => {
        const current = Number(item.valor) || 0;
        const hasComparison = targetMap.has(item.mes);
        const comparison = hasComparison ? targetMap.get(item.mes) : null;
        const diff = comparison != null ? current - comparison : null;
        const pct = diff !== null && comparison != null && comparison !== 0 ? diff / comparison : null;

        return {
          label: MONTHS[item.mes - 1]?.label || `Mes ${item.mes}`,
          current,
          comparison,
          diff,
          pct,
          historicalValues: showHistorical ? historicalYears.map(() => null) : []
        };
      });
    }
  }

  if (metaRows) {
    if (!metaRows.length) {
      return {
        headerMarkup,
        bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles para este periodo</td></tr>`
      };
    }

    const bodyMarkup = metaRows
      .map(row => {
        const valueCells = (Array.isArray(row.values) ? row.values : [])
          .map(entry => {
            const value = entry?.value;
            return `<td class="px-4 py-2 text-right text-sm font-semibold text-slate-800">${formatUnit(value)}</td>`;
          })
          .join('');

        return `<tr class="border-b border-slate-100"><td class="px-4 py-2 text-left text-sm text-slate-600">${escapeHtml(row.label)}</td>${valueCells}</tr>`;
      })
      .join('');

    return {
      headerMarkup,
      bodyMarkup
    };
  }

  if (!rows.length) {
    return {
      headerMarkup,
      bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles para este periodo</td></tr>`
    };
  }

  const totals = computeTotals(rows);
  const historicalTotals = showHistorical
    ? historicalYears.map((_, columnIndex) => {
        let hasValue = false;
        const total = rows.reduce((sum, row) => {
          const value = toNumber(row?.historicalValues?.[columnIndex]);
          if (value !== null) {
            hasValue = true;
            return sum + value;
          }
          return sum;
        }, 0);
        return hasValue ? total : null;
      })
    : [];

  const tableRows = rows.map(row => ({ ...row, rowType: 'history' }));

  if (totals) {
    tableRows.push({
      label: 'Total',
      current: totals.current,
      comparison: totals.comparison,
      diff: totals.diff,
      pct: totals.pct,
      historicalValues: showHistorical ? historicalTotals : [],
      rowType: 'total'
    });
  }

  const includeForecast = showTrend && !showHistorical && forecastData?.rows?.length;
  const forecastRows = includeForecast ? forecastData.rows : [];
  if (forecastRows.length) {
    const historicalPlaceholder = showHistorical
      ? Array.from({ length: historicalYears.length }, () => null)
      : [];

    forecastRows.forEach(item => {
      tableRows.push({
        label: item.label,
        current: item.current,
        comparison: item.comparison,
        diff: item.diff,
        pct: item.pct,
        historicalValues: showHistorical ? [...historicalPlaceholder] : [],
        rowType: 'forecast'
      });
    });

    if (includeForecast && forecastData?.totals) {
      tableRows.push({
        label: 'Total tendencia',
        current: forecastData.totals.current,
        comparison: forecastData.totals.comparison,
        diff: forecastData.totals.diff,
        pct: forecastData.totals.pct,
        historicalValues: showHistorical ? [...historicalPlaceholder] : [],
        rowType: 'forecast-total'
      });
    }
  }

  const bodyMarkup = tableRows
    .map(row => {
      const isForecast = row.rowType === 'forecast' || row.rowType === 'forecast-total';
      const isTotal = row.rowType === 'total' || row.rowType === 'forecast-total';

      const rowClasses = ['border-b border-slate-100'];
      if (isForecast) {
        rowClasses.push('bg-violet-50/60');
      }
      if (isTotal) {
        rowClasses.push('bg-slate-50/80 font-semibold');
      }
      const rowClassName = rowClasses.filter(Boolean).join(' ');

      const labelBadge = isForecast
        ? '<span class="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 text-[11px] font-semibold text-violet-700">Tendencia</span>'
        : '';

      const labelCell = `<td class="px-4 py-2 text-left text-sm text-slate-600">${escapeHtml(row.label)}${labelBadge}</td>`;

      const historicalCells = showHistorical
        ? row.historicalValues
            .map((value, index, array) => {
              const classes = ['px-4 py-2 text-right text-sm'];
              if (index === array.length - 1) {
                classes.push('font-semibold text-slate-800');
              } else {
                classes.push('text-slate-500');
              }
              if (isForecast) {
                classes.push('text-violet-700');
              }
              return `<td class="${classes.join(' ')}">${formatUnit(value)}</td>`;
            })
            .join('')
        : `<td class="px-4 py-2 text-right text-sm font-semibold ${
            isForecast ? 'text-violet-700' : 'text-slate-800'
          }">${formatUnit(row.current)}</td>`;

      const comparisonCell = !showHistorical
        ? `<td class="px-4 py-2 text-right text-sm ${
            isForecast ? 'text-violet-700' : 'text-slate-600'
          }">${formatUnit(row.comparison)}</td>`
        : '';

      let variationClass = 'text-slate-500';
      if (isForecast) {
        variationClass = 'text-violet-700';
      } else if (row.diff != null && !Number.isNaN(Number(row.diff))) {
        const numericDiff = Number(row.diff);
        if (numericDiff !== 0) {
          const invertDiff = invertScenarioDiff;
          if (numericDiff > 0) {
            variationClass = invertDiff ? 'text-rose-600' : 'text-emerald-600';
          } else {
            variationClass = invertDiff ? 'text-emerald-600' : 'text-rose-600';
          }
        }
      }

      const variationCell = `<td class="px-4 py-2 text-right text-sm font-semibold ${variationClass}"><div>${formatSignedUnit(
        row.diff
      )}</div></td>`;

      const pctCell = `<td class="px-4 py-2 text-right text-sm ${
        isForecast ? 'text-violet-700' : 'text-slate-600'
      }"><div>${formatPercentage(row.pct)}</div></td>`;

      return `<tr class="${rowClassName}">${labelCell}${historicalCells}${comparisonCell}${variationCell}${pctCell}</tr>`;
    })
    .join('');

  return { headerMarkup, bodyMarkup };
}

function destroyActiveModalChart() {
  if (activeModalChart) {
    activeModalChart.destroy();
    activeModalChart = null;
  }
}

function renderModalChart(canvas, config) {
  if (!canvas) return;
  const Chart = typeof window !== 'undefined' ? window.Chart : null;
  if (!Chart) {
    const fallback = document.createElement('div');
    fallback.className =
      'flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500';
    fallback.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i>No se pudo cargar la biblioteca de gráficas.';
    canvas.replaceWith(fallback);
    return;
  }
  destroyActiveModalChart();
  activeModalChart = new Chart(canvas, config);
}

// Función buildMonthlyChartConfig corregida
// CAMBIO: Ahora soporta mostrar últimos 4 años cuando showHistorical = true y sobreponer la tendencia proyectada

function buildMonthlyChartConfig(realData, chartType = 'line', showHistorical = false, options = {}) {
  if (!realData || !realData.history.length) {
    return null;
  }

  const { showTrend = false, forecastData = null } = options;
  const currentYear = CURRENT_YEAR;
  const lastLoaded = getLastLoadedMonth(realData.history);

  // CAMBIO: Determinar cuántos años mostrar
  const yearsToShow = showHistorical ? 4 : 2;
  const startYear = currentYear - (yearsToShow - 1);

  // CAMBIO: Generar datasets dinámicamente para los años solicitados
  const datasets = [];
  const colors = ['#2563eb', '#10b981', '#f97316', '#8b5cf6']; // 4 colores distintos

  for (let i = 0; i < yearsToShow; i++) {
    const year = startYear + i;
    const yearData = getDataByYear(realData.history, year);
    const yearValues = Array(12).fill(null);

    yearData.forEach(item => {
      if (item.mes >= 1 && item.mes <= 12) {
        const numericValue = Number(item.valor);
        if (!Number.isFinite(numericValue)) {
          yearValues[item.mes - 1] = null;
          return;
        }

        const includeZero =
          numericValue !== 0 || !lastLoaded || isCapturedPeriod(year, item.mes, lastLoaded);
        yearValues[item.mes - 1] = includeZero ? numericValue : null;
      }
    });

    const dataset = {
      label: `${year}`,
      data: yearValues,
      borderColor: colors[i],
      backgroundColor: chartType === 'bar' ? colors[i] : `${colors[i]}26`, // 26 en hex = 15% opacidad
      borderWidth: chartType === 'bar' ? 0 : 2,
      spanGaps: true
    };

    if (chartType === 'line') {
      dataset.tension = 0.3;
      dataset.fill = true;
      dataset.pointRadius = 3;
    }

    datasets.push(dataset);
  }

  let labels = MONTHS.map(month => month.short);

  const trendEnabled = showTrend && forecastData?.chartPoints?.length;
  if (trendEnabled) {
    const trendData = Array(labels.length).fill(null);
    const anchorIndex = Number.isFinite(forecastData?.anchor?.index) ? forecastData.anchor.index : null;
    const anchorValue = toNumber(forecastData?.anchor?.value);

    if (anchorIndex !== null && anchorIndex >= 0 && anchorIndex < trendData.length && anchorValue !== null) {
      trendData[anchorIndex] = anchorValue;
    }

    forecastData.chartPoints.forEach(point => {
      const baseMonthIndex = Number(point.monthIndex);
      const chartLabel = point.label;
      let targetIndex = null;

      if (Number(point.year) === currentYear && baseMonthIndex >= 0 && baseMonthIndex < 12) {
        targetIndex = baseMonthIndex;
      } else {
        let existingIndex = labels.indexOf(chartLabel);
        if (existingIndex === -1) {
          labels.push(chartLabel);
          existingIndex = labels.length - 1;
          datasets.forEach(dataset => {
            while (dataset.data.length < labels.length) {
              dataset.data.push(null);
            }
          });
          while (trendData.length < labels.length) {
            trendData.push(null);
          }
        }
        targetIndex = existingIndex;
      }

      if (targetIndex !== null) {
        if (targetIndex >= trendData.length) {
          const missing = targetIndex - trendData.length + 1;
          for (let fillIndex = 0; fillIndex < missing; fillIndex += 1) {
            trendData.push(null);
            datasets.forEach(dataset => dataset.data.push(null));
          }
        }
        trendData[targetIndex] = point.value;
      }
    });

    const trendDataset = {
      label: 'Tendencia',
      data: trendData,
      borderColor: '#7c3aed',
      backgroundColor: '#7c3aed1a',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      spanGaps: true,
      type: 'line',
      fill: false,
      tension: 0.3,
      isTrend: true
    };

    if (chartType === 'bar') {
      trendDataset.order = datasets.length + 1;
    }

    datasets.push(trendDataset);
  }

  // Asegurar que todas las series tengan la misma longitud
  datasets.forEach(dataset => {
    while (dataset.data.length < labels.length) {
      dataset.data.push(null);
    }
  });

  const unit = realData?.indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatTick = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

  const config = {
    type: chartType,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: formatTick
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };

  if (chartType === 'line') {
    config.data.datasets.forEach(dataset => {
      if (dataset.isTrend) {
        return;
      }
      dataset.tension = 0.3;
      dataset.fill = true;
      dataset.pointRadius = 3;
    });
  } else if (chartType === 'bar') {
    config.options.scales.x = {
      stacked: false
    };
    config.options.scales.y.stacked = false;
  }
  
  return config;
}

// Función buildQuarterlyChartConfig corregida
// CAMBIO: Ahora soporta chartType (line/bar) y showHistorical (2 o 4 años)

function buildQuarterlyChartConfig(realData, chartType = 'bar', showHistorical = false) {
  if (!realData || !realData.history.length) {
    return null;
  }
  
  const currentYear = CURRENT_YEAR;
  const completeQuarters = filterCompleteQuarters(realData.history, currentYear);
  
  if (completeQuarters === 0) {
    return null;
  }
  
  // CAMBIO: Determinar cuántos años mostrar
  const yearsToShow = showHistorical ? 4 : 2;
  const startYear = currentYear - (yearsToShow - 1);
  
  // CAMBIO: Generar datasets dinámicamente para los años solicitados
  const datasets = [];
  const colors = [
    { bg: 'rgba(37, 99, 235, 0.65)', border: '#2563eb' },
    { bg: 'rgba(16, 185, 129, 0.45)', border: '#10b981' },
    { bg: 'rgba(249, 115, 22, 0.65)', border: '#f97316' },
    { bg: 'rgba(139, 92, 246, 0.65)', border: '#8b5cf6' }
  ];
  
  // Generar labels basados en trimestres completos
  const quarterNames = ['Primer trimestre', 'Segundo trimestre', 'Tercer trimestre', 'Cuarto trimestre'];
  const labels = Array.from({ length: completeQuarters }, (_, i) => quarterNames[i]);
  
  for (let i = 0; i < yearsToShow; i++) {
    const year = startYear + i;
    const quarterData = aggregateQuarterlyData(realData.history, year, completeQuarters);
    const values = quarterData.map(q => q.value);
    
    const dataset = {
      label: `${year}`,
      data: values,
      backgroundColor: colors[i].bg,
      borderColor: colors[i].border,
      borderWidth: chartType === 'line' ? 2 : 0
    };
    
    // Configuración específica para líneas
    if (chartType === 'line') {
      dataset.tension = 0.3;
      dataset.fill = true;
      dataset.pointRadius = 4;
      dataset.pointBackgroundColor = colors[i].border;
    }
    
    datasets.push(dataset);
  }
  
  const unit = realData?.indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatTick = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

  const config = {
    type: chartType,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: formatTick
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
  
  // Asegurar que las barras no estén apiladas
  if (chartType === 'bar') {
    config.options.scales.x = {
      stacked: false
    };
    config.options.scales.y.stacked = false;
  }
  
  return config;
}

function buildScenarioChartConfig(realData, scenario, chartType = 'line', options = {}) {
  if (!realData || !realData.history.length) {
    return null;
  }

  const { showTrend = false, forecastData = null } = options;
  const currentYear = CURRENT_YEAR;
  const lastLoaded = getLastLoadedMonth(realData.history);
  const initialYearData = getDataByYear(realData.history, currentYear);
  const effectiveYear = initialYearData.length ? currentYear : lastLoaded?.year ?? currentYear;
  const currentData =
    effectiveYear === currentYear ? initialYearData : getDataByYear(realData.history, effectiveYear);

  const scenarioLabel = getIndicatorScenarioLabel(realData?.indicator, scenario) || 'Meta';
  const { values: targetValuesBase } = buildScenarioTargetValues(realData.targets, scenario, effectiveYear);

  const isMetaOnly = currentData.length > 0 && currentData.every(item => item?.es_meta);

  if (isMetaOnly) {
    const quarterScenarioMap = buildQuarterScenarioMap(realData.targets ?? [], effectiveYear);

    if (quarterScenarioMap.size) {
      const prioritized = META_SCENARIO_DISPLAY_ORDER.filter(code => quarterScenarioMap.has(code));
      const extras = Array.from(quarterScenarioMap.keys()).filter(code => !prioritized.includes(code));
      const orderedScenarios = [...prioritized, ...extras];

      const labels = QUARTER_LABELS.slice();
      const quarterPresence = labels.map((_, index) =>
        orderedScenarios.some(code => {
          const values = quarterScenarioMap.get(code) ?? [];
          const value = values[index];
          return value != null && !Number.isNaN(Number(value));
        })
      );

      const hasMetaValues = quarterPresence.some(Boolean);
      if (hasMetaValues) {
        const latestQuarterIndex = findLatestIndex(
          quarterPresence.map(flag => (flag ? 1 : null))
        );
        const effectiveLabels = labels.slice(0, latestQuarterIndex + 1);
        const datasets = [];
        const fallbackPalette = ['#f97316', '#16a34a', '#0ea5e9', '#8b5cf6'];

        orderedScenarios.forEach((code, index) => {
          const rawValues = quarterScenarioMap.get(code) ?? [];
          const slicedValues = rawValues.slice(0, latestQuarterIndex + 1);
          const hasValues = slicedValues.some(value => value != null && !Number.isNaN(Number(value)));
          if (!hasValues) {
            return;
          }

          const labelText = getIndicatorScenarioLabel(realData?.indicator, code) || code;
          const color = META_SCENARIO_COLORS[code] ?? {};
          const borderColor = color.border || fallbackPalette[index % fallbackPalette.length];
          const backgroundColor =
            chartType === 'bar'
              ? color.backgroundBar || `${borderColor}CC`
              : color.backgroundLine || `${borderColor}26`;

          const dataset = {
            label: labelText,
            data: slicedValues,
            borderColor,
            backgroundColor,
            borderWidth: chartType === 'bar' ? 0 : 2,
            spanGaps: true
          };

          if (chartType === 'line') {
            dataset.tension = 0.3;
            dataset.pointRadius = 3;
            dataset.fill = false;
          }

          datasets.push(dataset);
        });

        if (datasets.length) {
          const unit = realData?.indicator?.unidad_medida ?? null;
          const numberDigits = resolveNumberDigitsByUnit(unit);
          const percentageScale = 'auto';
          const formatTick = value =>
            formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

          return {
            type: chartType,
            data: {
              labels: effectiveLabels,
              datasets
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: formatTick
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }
          };
        }
      }
    }

    const quarterValues = Array(QUARTER_LABELS.length).fill(null);

    currentData.forEach(item => {
      const month = Number(item.mes);
      const value = Number(item.valor);
      if (!Number.isFinite(month) || !Number.isFinite(value)) {
        return;
      }
      const quarterIndex = Math.ceil(month / 3) - 1;
      if (quarterIndex >= 0 && quarterIndex < quarterValues.length) {
        quarterValues[quarterIndex] = value;
      }
    });

    const hasQuarterData = quarterValues.some(value => value != null);
    if (!hasQuarterData) {
      return null;
    }

    const latestQuarterIndex = findLatestIndex(quarterValues);
    const labelsFallback = QUARTER_LABELS.slice(0, latestQuarterIndex + 1);
    const valuesFallback = quarterValues.slice(0, latestQuarterIndex + 1);

    const dataset = {
      label: scenarioLabel,
      data: valuesFallback,
      borderColor: '#2563eb',
      backgroundColor: chartType === 'bar' ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
      borderWidth: 2,
      spanGaps: true
    };

    if (chartType === 'line') {
      dataset.tension = 0.3;
      dataset.pointRadius = 3;
      dataset.fill = true;
    }

    const unit = realData?.indicator?.unidad_medida ?? null;
    const numberDigits = resolveNumberDigitsByUnit(unit);
    const percentageScale = 'auto';
    const formatTick = value =>
      formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

    return {
      type: chartType,
      data: {
        labels: labelsFallback,
        datasets: [dataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: formatTick
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    };
  }

  let labels = MONTHS.map(month => month.short);

  const realValues = Array(labels.length).fill(null);
  const targetValues = [...targetValuesBase];

  currentData.forEach(item => {
    if (item.mes >= 1 && item.mes <= 12) {
      const numericValue = Number(item.valor);
      if (!Number.isFinite(numericValue)) {
        realValues[item.mes - 1] = null;
        return;
      }

      const includeZero =
        numericValue !== 0 || !lastLoaded || isCapturedPeriod(currentYear, item.mes, lastLoaded);
      realValues[item.mes - 1] = includeZero ? numericValue : null;
    }
  });

  const label = scenarioLabel;

  const trendEnabled = showTrend && forecastData?.chartPoints?.length;
  let trendDataset = null;

  if (trendEnabled) {
    const trendData = Array(labels.length).fill(null);
    const anchorIndex = Number.isFinite(forecastData?.anchor?.index) ? forecastData.anchor.index : null;
    const anchorValue = toNumber(forecastData?.anchor?.value);

    if (anchorIndex !== null && anchorIndex >= 0 && anchorIndex < trendData.length && anchorValue !== null) {
      trendData[anchorIndex] = anchorValue;
    }

    forecastData.chartPoints.forEach(point => {
      const baseMonthIndex = Number(point.monthIndex);
      const chartLabel = point.label;
      let targetIndex = null;

      if (Number(point.year) === currentYear && baseMonthIndex >= 0 && baseMonthIndex < 12) {
        targetIndex = baseMonthIndex;
      } else {
        let existingIndex = labels.indexOf(chartLabel);
        if (existingIndex === -1) {
          labels.push(chartLabel);
          existingIndex = labels.length - 1;
          while (realValues.length < labels.length) {
            realValues.push(null);
          }
          while (targetValues.length < labels.length) {
            targetValues.push(null);
          }
          while (trendData.length < labels.length) {
            trendData.push(null);
          }
        }
        targetIndex = existingIndex;
      }

      if (targetIndex !== null) {
        if (targetIndex >= trendData.length) {
          const missing = targetIndex - trendData.length + 1;
          for (let fillIndex = 0; fillIndex < missing; fillIndex += 1) {
            trendData.push(null);
            realValues.push(null);
            targetValues.push(null);
          }
        }
        trendData[targetIndex] = point.value;
      }
    });

    trendDataset = {
      label: 'Tendencia',
      data: trendData,
      borderColor: '#7c3aed',
      backgroundColor: '#7c3aed1a',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      spanGaps: true,
      type: 'line',
      fill: false,
      tension: 0.3,
      isTrend: true
    };

    if (chartType === 'bar') {
      trendDataset.order = 3;
    }
  }

  const unit = realData?.indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatTick = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

  const datasets = [
    {
      label: 'Real',
      data: realValues,
      borderColor: '#2563eb',
      backgroundColor: chartType === 'bar' ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
      borderWidth: 2,
      spanGaps: true
    },
    {
      label,
      data: targetValues,
      borderColor: '#f97316',
      backgroundColor: chartType === 'bar' ? '#f97316' : 'rgba(249, 115, 22, 0.15)',
      borderWidth: 2,
      spanGaps: true
    }
  ];

  if (trendDataset) {
    datasets.push(trendDataset);
  }

  const config = {
    type: chartType,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: formatTick
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };

  if (chartType === 'line') {
    config.data.datasets.forEach((dataset, index) => {
      if (dataset.isTrend) {
        return;
      }

      dataset.tension = 0.3;
      dataset.pointRadius = 3;
      if (index === 0) {
        dataset.fill = true;
      } else {
        dataset.fill = false;
        dataset.borderDash = [6, 4];
      }
    });
  }

  return config;
}

// Función buildAnnualChartConfig corregida
// CAMBIO: Ahora soporta chartType (line/bar) y showHistorical (ajusta cantidad de años)

function buildAnnualChartConfig(realData, chartType = 'bar', showHistorical = false) {
  if (!realData || !realData.history.length) {
    return null;
  }
  
  // CAMBIO: Ajustar la cantidad de años según showHistorical
  // Si showHistorical = false: últimos 5 años
  // Si showHistorical = true: últimos 4 años (para comparación año contra año)
  const yearsLimit = showHistorical ? 4 : 5;
  
  const years = Array.from(new Set(realData.history.map(item => item.anio)))
    .sort((a, b) => a - b)
    .slice(-yearsLimit);
  
  const values = years.map(year => {
    const yearData = getDataByYear(realData.history, year);
    return sum(yearData.map(item => item.valor));
  });
  
  const unit = realData?.indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatTick = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });

  const config = {
    type: chartType,
    data: {
      labels: years.map(String),
      datasets: [
        {
          label: 'Total anual',
          data: values,
          backgroundColor: 'rgba(37, 99, 235, 0.7)',
          borderColor: '#2563eb',
          borderWidth: chartType === 'line' ? 3 : 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: formatTick
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
  
  // Configuración específica para gráficas de línea
  if (chartType === 'line') {
    config.data.datasets[0].tension = 0.3;
    config.data.datasets[0].fill = true;
    config.data.datasets[0].pointRadius = 5;
    config.data.datasets[0].pointBackgroundColor = '#2563eb';
    config.data.datasets[0].pointBorderColor = '#fff';
    config.data.datasets[0].pointBorderWidth = 2;
    config.data.datasets[0].backgroundColor = 'rgba(37, 99, 235, 0.15)';
  }
  
  return config;
}

// Función buildChartConfig corregida
// CAMBIO: Ahora acepta los parámetros showHistorical y showTrend para controlar histórico extendido y tendencia proyectada

function buildChartConfig(realData, type, scenario, chartType = 'line', options = {}) {
  if (!realData) return null;

  const { showHistorical = false, showTrend = false, forecastData = null } = options;

  if (type === 'monthly') {
    return buildMonthlyChartConfig(realData, chartType, showHistorical, { showTrend, forecastData });
  } else if (type === 'quarterly') {
    return buildQuarterlyChartConfig(realData, chartType, showHistorical);
  } else if (type === 'annual') {
    return buildAnnualChartConfig(realData, chartType, showHistorical);
  }

  // Los escenarios no usan el histórico de 4 años
  return buildScenarioChartConfig(realData, scenario, chartType, { showTrend, forecastData });
}

// Función buildChartTypeToggle corregida
// CAMBIO: Ahora también muestra el toggle para 'monthly'

function buildChartTypeToggle(currentType, type) {
  const supportedTypes = new Set(['monthly', 'quarterly', 'annual', 'scenario']);

  if (!supportedTypes.has(type)) {
    return '';
  }

  return `
    <div class="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" data-chart-toggle>
      <button
        type="button"
        data-chart-type="line"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          currentType === 'line' 
            ? 'bg-primary-600 text-white shadow' 
            : 'text-slate-500 hover:bg-slate-100'
        }"
      >
        <i class="fa-solid fa-chart-line"></i>
        Líneas
      </button>
      <button
        type="button"
        data-chart-type="bar"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          currentType === 'bar' 
            ? 'bg-primary-600 text-white shadow' 
            : 'text-slate-500 hover:bg-slate-100'
        }"
      >
        <i class="fa-solid fa-chart-column"></i>
        Barras
      </button>
    </div>
  `;
}
function ensureModalContainer() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.setAttribute('data-modal-root', '');
    document.body.appendChild(modalContainer);
  }
  return modalContainer;
}

function closeIndicatorModal() {
  destroyActiveModalChart();
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
  document.body.classList.remove('overflow-hidden');
}

function buildModalMarkup({
  label,
  realData,
  type,
  scenario,
  scenarioOptions = [],
  chartType = 'line',
  showHistorical = false,
  showTrend = false,
  forecastData = null,
  hasForecast = false,
  trendEnabled = false,
  trendHelperText = ''
}) {
  const summary = buildSummary(realData, type, scenario);
  const { headerMarkup, bodyMarkup } = buildTableContent(realData, type, scenario, {
    showHistorical,
    showTrend,
    forecastData
  });
  const indicator = realData?.indicator ?? null;
  const metaOnlyScenario =
    type === 'scenario' && Array.isArray(realData?.history) &&
    realData.history.length > 0 &&
    realData.history.every(item => item?.es_meta);
  const invertTrend = type === 'scenario' && indicatorPrefersLowerValues(indicator);
  const trendClasses = getTrendColorClasses(summary.diff ?? 0, { invert: invertTrend });
  const activeScenarioValue = type === 'scenario' ? normalizeScenarioValue(scenario) : null;
  const scenarioLabel = type === 'scenario'
    ? metaOnlyScenario
      ? summary.comparisonLabel
      : getIndicatorScenarioLabel(indicator, scenario)
    : summary.comparisonLabel;
  const chartToggle = buildChartTypeToggle(chartType, type);
  const unit = realData?.indicator?.unidad_medida ?? null;
  const numberDigits = resolveNumberDigitsByUnit(unit);
  const percentageScale = 'auto';
  const formatUnit = value =>
    formatUnitValue(value, unit, { numberDigits, percentageDigits: 3, percentageScale });
  const formatSignedUnit = value =>
    formatSignedUnitValue(value, unit, {
      numberDigits,
      percentageDigits: 3,
      percentageScale
    });
  const formattedDiff = formatSignedUnit(summary.diff);
  const formattedPct = formatPercentage(summary.pct);
  const variationValueMarkup = `<p class="mt-2 text-2xl font-semibold ${trendClasses.text}">${formattedPct}</p>`;
  const variationDetailMarkup = `<p class="mt-1 text-sm text-slate-600">(${formattedDiff})</p>`;
  const normalizedScenarioOptions = Array.isArray(scenarioOptions)
    ? scenarioOptions
        .map(option => {
          const optionValue = normalizeScenarioValue(option?.value);
          if (!optionValue) return null;
          return { option, optionValue };
        })
        .filter(Boolean)
    : [];
  const scenarioButtonMarkup =
    type === 'scenario' && normalizedScenarioOptions.length > 1
      ? normalizedScenarioOptions
          .map(({ option, optionValue }) => {
            const isActive = optionValue === activeScenarioValue;
            const classes = [
              'rounded-full',
              'border',
              'px-3',
              'py-1.5',
              'text-xs',
              'font-semibold',
              'transition',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-aifa-light',
              'focus-visible:ring-offset-2'
            ];
            if (isActive) {
              classes.push('border-primary-600', 'bg-primary-600', 'text-white', 'shadow');
            } else {
              classes.push(
                'border-slate-200',
                'bg-white',
                'text-slate-600',
                'hover:border-primary-200',
                'hover:text-primary-600'
              );
            }
            const labelText = option?.label ?? optionValue;
            return `<button type="button" class="${classes.join(' ')}" data-scenario-option="${escapeHtml(optionValue)}">${escapeHtml(labelText)}</button>`;
          })
          .join('')
      : '';
  const scenarioToggleMarkup =
    type === 'scenario' && scenarioButtonMarkup
      ? `<div class="flex flex-wrap gap-2" data-scenario-toggle>${scenarioButtonMarkup}</div>`
      : '';

  const trendToggleClasses = [
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition shadow-sm'
  ];
  if (trendEnabled) {
    trendToggleClasses.push('cursor-pointer');
    if (showTrend) {
      trendToggleClasses.push('border-violet-300 bg-violet-50 text-violet-700');
    } else {
      trendToggleClasses.push('border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600');
    }
  } else {
    trendToggleClasses.push('cursor-not-allowed border-slate-200 bg-white text-slate-400 opacity-60');
  }
  const trendToggleClass = trendToggleClasses.join(' ');
  const resolvedTrendTitle = trendEnabled
    ? 'Mostrar tendencia proyectada'
    : trendHelperText || 'Sin datos suficientes para proyectar';
  const trendHelperMarkup = trendHelperText
    ? `<span class="text-xs font-medium text-slate-400" data-trend-helper>${escapeHtml(trendHelperText)}</span>`
    : '';
  const trendToggleMarkup = ['monthly', 'scenario'].includes(type)
    ? `
        <label
          class="${trendToggleClass}"
          data-trend-toggle-wrapper
          title="${escapeHtml(resolvedTrendTitle)}"
        >
          <input
            type="checkbox"
            data-toggle-trend
            class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            ${showTrend && trendEnabled ? 'checked' : ''}
            ${trendEnabled ? '' : 'disabled'}
          />
          Tendencia
        </label>
        ${trendHelperMarkup}
      `
    : '';

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
      <div class="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
        <button
          type="button"
          class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          aria-label="Cerrar"
          data-modal-close
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="space-y-6 p-6">
          <header class="space-y-2">
            <p class="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
            <h2 class="text-2xl font-semibold text-slate-900">${escapeHtml(label)}</h2>
            ${realData?.indicator ? `
              <div class="flex flex-wrap gap-3 text-sm text-slate-500">
                <span><strong>Área:</strong> ${escapeHtml(realData.indicator.area_nombre || '—')}</span>
                <span><strong>Unidad:</strong> ${escapeHtml(realData.indicator.unidad_medida || '—')}</span>
              </div>
            ` : ''}
          </header>

          <section class="space-y-4">
            <header class="flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">${escapeHtml(
                summary.title
              )}</h3>
              <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">${
                type === 'scenario' ? 'Seguimiento vs meta' : 'Comparativo año contra año'
              }</span>
            </header>
            ${scenarioToggleMarkup}

            <div class="grid gap-4 sm:grid-cols-3">
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${escapeHtml(summary.currentLabel)}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatUnit(summary.currentValue)}</p>
              </article>
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${escapeHtml(scenarioLabel)}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatUnit(summary.comparisonValue)}</p>
              </article>
              <!-- CAMBIO 1: Porcentaje arriba y diferencia numérica abajo -->
            <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs uppercase tracking-widest text-slate-400">Variación</p>
              ${variationValueMarkup}
              ${variationDetailMarkup}
            </article>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between flex-wrap gap-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Visualización</h3>
              <div class="flex items-center gap-3">
                ${trendToggleMarkup}
                ${chartToggle}
              </div>
            </div>
            <div class="h-72">
              <canvas data-modal-chart aria-label="Gráfica del indicador"></canvas>
            </div>
            <!-- CAMBIO 2: Checkbox para mostrar últimos 4 años (solo para monthly, quarterly, annual) -->
            ${['monthly', 'quarterly'].includes(type) ? `
              <div class="mt-3 flex justify-end">
                <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    data-show-historical
                    class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>Mostrar últimos 4 años</span>
                </label>
              </div>
            ` : ''}
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Detalle del periodo</h3>
            </div>
            <div class="max-h-72 overflow-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  ${headerMarkup}
                </thead>
                <tbody>${bodyMarkup}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

async function openIndicatorModal({ label, dataKey, type, scenario, defaultChartType }) {
  const root = ensureModalContainer();
  
  root.innerHTML = `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div class="rounded-2xl bg-white p-8 shadow-2xl">
        <div class="flex items-center gap-3 text-slate-600">
          <svg class="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>Cargando datos del indicador...</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.classList.add('overflow-hidden');

  try {
    if (cachedIndicators === null) {
      const fetchedIndicators = await getIndicators();
      cachedIndicators = Array.isArray(fetchedIndicators) ? fetchedIndicators : [];
    }

    const indicators = Array.isArray(cachedIndicators) ? cachedIndicators : [];
    const foundIndicator = findIndicatorByDataKey(indicators, dataKey);

    if (!foundIndicator) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
            <div class="text-center">
              <i class="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Indicador no encontrado</h3>
              <p class="text-sm text-slate-600 mb-4">No se encontró un indicador configurado para esta opción.</p>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                data-modal-close
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const closeBtn = root.querySelector('[data-modal-close]');
      closeBtn?.addEventListener('click', closeIndicatorModal);
      return;
    }

    const realData = await getIndicatorRealData(foundIndicator.id);
    
    if (!realData || !realData.history.length) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
            <div class="text-center">
              <i class="fa-solid fa-chart-simple text-4xl text-slate-300 mb-4"></i>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Sin datos disponibles</h3>
              <p class="text-sm text-slate-600 mb-4">No hay datos históricos registrados para este indicador.</p>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                data-modal-close
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const closeBtn = root.querySelector('[data-modal-close]');
      closeBtn?.addEventListener('click', closeIndicatorModal);
      return;
    }

    let selectedScenario = type === 'scenario' ? normalizeScenarioValue(scenario) : null;
    const normalizedDefaultChartType = (() => {
      const normalized = (defaultChartType ?? '').toString().trim().toLowerCase();
      return normalized === 'bar' || normalized === 'line' ? normalized : null;
    })();

    if (type === 'scenario') {
      const defaultScenario = getIndicatorDefaultScenario(realData?.indicator, scenario);
      if (!selectedScenario && defaultScenario) {
        selectedScenario = normalizeScenarioValue(defaultScenario);
      }
    }

    // CAMBIO: Agregar estado para el checkbox de histórico y la tendencia
    let currentChartType =
      normalizedDefaultChartType ?? (type === 'quarterly' ? 'bar' : 'line');
    let showHistorical = false;
    let showTrend = false;

    const supportsTrend = type === 'monthly' || type === 'scenario';
    const forecastData = computeForecastData(realData, type);
    const hasForecast = Boolean(forecastData?.rows?.length);

    const renderModal = (chartType, historical, trend) => {
      let scenarioOptionList = [];
      let effectiveScenario = null;

      if (type === 'scenario') {
        scenarioOptionList = getIndicatorScenarioOptions(realData?.indicator, selectedScenario);
        if (!selectedScenario && scenarioOptionList.length) {
          selectedScenario = scenarioOptionList[0].value;
        }
        effectiveScenario = normalizeScenarioValue(selectedScenario);
      }

      const normalizedTrend = historical ? false : Boolean(trend);
      showHistorical = historical;
      showTrend = normalizedTrend;
      currentChartType = chartType;

      const trendEnabled = supportsTrend && hasForecast && !historical;
      const trendHelperText = supportsTrend
        ? !hasForecast
          ? 'Sin datos suficientes'
          : historical
          ? 'Desactive el histórico para ver la tendencia'
          : ''
        : '';
      const effectiveTrend = normalizedTrend && trendEnabled;

      root.innerHTML = buildModalMarkup({
        label: foundIndicator.nombre,
        realData,
        type,
        scenario: effectiveScenario,
        scenarioOptions: scenarioOptionList,
        chartType,
        showHistorical: historical,
        showTrend: effectiveTrend,
        forecastData,
        hasForecast,
        trendEnabled,
        trendHelperText
      });

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButton = root.querySelector('[data-modal-close]');
      const canvas = root.querySelector('[data-modal-chart]');
      const chartToggle = root.querySelector('[data-chart-toggle]');
      const historicalCheckbox = root.querySelector('[data-show-historical]'); // NUEVO
      const trendToggle = root.querySelector('[data-toggle-trend]');

      const handleClose = () => {
        overlay?.removeEventListener('click', overlayListener);
        closeButton?.removeEventListener('click', handleClose);
        document.removeEventListener('keydown', escListener);
        closeIndicatorModal();
      };

      const overlayListener = event => {
        if (event.target === overlay) {
          handleClose();
        }
      };

      const escListener = event => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };

      overlay?.addEventListener('click', overlayListener);
      closeButton?.addEventListener('click', handleClose);
      document.addEventListener('keydown', escListener);

      // Evento para cambiar tipo de gráfica
      if (chartToggle) {
        chartToggle.querySelectorAll('[data-chart-type]').forEach(btn => {
          btn.addEventListener('click', () => {
            const newChartType = btn.dataset.chartType;
            if (newChartType !== currentChartType) {
              currentChartType = newChartType;
              renderModal(newChartType, showHistorical, showTrend);
            }
          });
        });
      }

      // NUEVO: Evento para checkbox de histórico
      if (historicalCheckbox) {
        historicalCheckbox.checked = historical;
        historicalCheckbox.addEventListener('change', event => {
          const nextHistorical = event.target.checked;
          const nextTrend = nextHistorical ? false : showTrend;
          renderModal(currentChartType, nextHistorical, nextTrend);
        });
      }

      if (trendToggle) {
        trendToggle.checked = effectiveTrend;
        trendToggle.disabled = !trendEnabled;
        trendToggle.addEventListener('change', event => {
          const nextTrend = event.target.checked;
          renderModal(currentChartType, showHistorical, nextTrend);
        });
      }

      if (type === 'scenario') {
        const scenarioToggle = root.querySelector('[data-scenario-toggle]');
        if (scenarioToggle) {
          scenarioToggle.querySelectorAll('[data-scenario-option]').forEach(button => {
            button.addEventListener('click', () => {
              const nextScenario = normalizeScenarioValue(button.dataset.scenarioOption);
              if (!nextScenario || nextScenario === selectedScenario) {
                return;
              }
              selectedScenario = nextScenario;
              renderModal(currentChartType, showHistorical, showTrend);
            });
          });
        }
      }

      // Renderizar gráfica inicial
      const chartConfig = buildChartConfig(realData, type, effectiveScenario, chartType, {
        showHistorical: historical,
        showTrend: effectiveTrend,
        forecastData
      });
      if (chartConfig) {
        renderModalChart(canvas, chartConfig);
      }
    };

    renderModal(currentChartType, showHistorical, showTrend);

  } catch (error) {
    console.error('Error al abrir modal:', error);
    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
          <div class="text-center">
            <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Error al cargar datos</h3>
            <p class="text-sm text-slate-600 mb-4">${escapeHtml(error.message || 'Ocurrió un error inesperado')}</p>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              data-modal-close
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const closeBtn = root.querySelector('[data-modal-close]');
    closeBtn?.addEventListener('click', closeIndicatorModal);
  }
}

function openDirectionIndicatorPlaceholderModal({ name, subtitle, code }) {
  const root = ensureModalContainer();

  document.body.classList.add('overflow-hidden');

  const codeMarkup = code
    ? `<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">${escapeHtml(code)}</span>`
    : '';
  const subtitleMarkup = subtitle
    ? `<p class="text-sm text-slate-500">${escapeHtml(subtitle)}</p>`
    : '';

  root.innerHTML = `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
      <div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            ${codeMarkup}
            <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(name)}</h3>
            ${subtitleMarkup}
          </div>
          <button
            type="button"
            class="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
            data-modal-close
          >
            <span class="sr-only">Cerrar</span>
            <i class="fa-solid fa-xmark h-4 w-4"></i>
          </button>
        </div>
        <div class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          <p>El detalle del indicador estará disponible próximamente.</p>
        </div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('[data-modal-overlay]');
  const closeBtn = root.querySelector('[data-modal-close]');

  const handleClose = () => {
    overlay?.removeEventListener('click', handleOverlayClick);
    closeBtn?.removeEventListener('click', handleClose);
    closeIndicatorModal();
  };

  function handleOverlayClick(event) {
    if (event.target === overlay) {
      handleClose();
    }
  }

  overlay?.addEventListener('click', handleOverlayClick);
  closeBtn?.addEventListener('click', handleClose);
}
function buildOptionMarkup(option) {
  const iconClass = OPTION_ICON_CLASSES[option.type] ?? 'fa-solid fa-circle-dot';
  return `
    <li>
      <button
        type="button"
        class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-option-button
        data-option-id="${option.id}"
        data-option-type="${option.type}"
        data-option-scenario="${option.scenario ?? ''}"
        data-option-label="${escapeHtml(option.label)}"
        data-option-datakey="${option.dataKey ?? ''}"
      >
        <span class="mt-0.5 text-slate-500">
          <i class="${iconClass} h-4 w-4"></i>
        </span>
        <span>${escapeHtml(option.label)}</span>
      </button>
    </li>
  `;
}

function resolveOptionBlueprints(definition) {
  const baseBlueprints = Array.isArray(definition?.optionBlueprints)
    ? definition.optionBlueprints
    : OPTION_BLUEPRINTS;

  if (!Array.isArray(baseBlueprints) || !baseBlueprints.length) {
    return [];
  }

  return baseBlueprints;
}
function buildGroupMarkup(groupId, rootId) {
  const definition = GROUP_DEFINITIONS[groupId];
  if (!definition) return '';
  const blueprints = resolveOptionBlueprints(definition);
  const options = blueprints.map(blueprint => ({
    id: `${definition.id}-${blueprint.id}`,
    label: blueprint.buildLabel(definition.entity),
    type: blueprint.type,
    scenario: blueprint.scenario,
    dataKey: definition.dataKey
  }));

  // Soporte para vistas personalizadas
  const customViewsMarkup = definition.customViews 
    ? definition.customViews.map(view => `
        <li>
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
            data-custom-view-button
            data-view-type="${view.type}"
            data-view-id="${view.id}"
            data-view-title="${escapeHtml(view.title)}"
          >
            <span class="mt-0.5 text-slate-500">
              <i class="fa-solid fa-chart-column h-4 w-4"></i>
            </span>
            <div>
              <span class="font-medium">${escapeHtml(view.title)}</span>
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(view.description || '')}</p>
            </div>
          </button>
        </li>
      `).join('')
    : '';

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-group-button
        data-group-root="${rootId}"
        data-group-id="${definition.id}"
        aria-expanded="false"
      >
        <span class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <i class="${definition.iconClass} h-5 w-5"></i>
          </span>
          <span class="flex flex-col">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(definition.title)}</span>
            ${definition.subtitle ? `<span class="text-xs font-medium text-slate-500">${escapeHtml(definition.subtitle)}</span>` : ''}
          </span>
        </span>
        <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-group-chevron></i>
      </button>
      <div class="border-t border-slate-100 bg-slate-50/60 px-5 py-4" data-group-panel="${definition.id}" hidden>
        <ul class="space-y-2">
          ${options.map(buildOptionMarkup).join('')}
          ${customViewsMarkup}
        </ul>
      </div>
    </div>
  `;
}

function buildIndicatorSectionContent(section) {
  if (typeof section.buildContent === 'function') {
    return section.buildContent(section);
  }

  if (typeof section.content === 'string') {
    return section.content;
  }

  const groups = Array.isArray(section.groupIds) ? section.groupIds : [];
  const groupsMarkup = groups.map(groupId => buildGroupMarkup(groupId, section.id)).join('');

  return `
    <div class="space-y-3">
      ${groupsMarkup}
    </div>
  `;
}

function composeAccordionSections() {
  const baseSections = BASE_ACCORDION_SECTIONS.map(section => ({
    ...section,
    groupIds: Array.isArray(section.groupIds) ? [...section.groupIds] : []
  }));

  const operationsSection = baseSections.find(section => section.id === 'operativos') ?? null;
  const smsSection = baseSections.find(section => section.id === 'sms') ?? null;
  const fboSection = baseSections.find(section => section.id === 'fbo') ?? null;
  const remainingSections = baseSections.filter(section => !['operativos', 'sms', 'fbo'].includes(section.id));

  const sections = [];

  if (operationsSection) {
    sections.push(operationsSection);
  }

  if (smsSection) {
    sections.push(smsSection);
  }

  if (fboSection) {
    sections.push(fboSection);
  }

  sections.push(...remainingSections);

  return sections;
}

function buildSectionsMarkup(sections) {
  return sections.map(section => {
    const isInitiallyOpen = section.id === DEFAULT_ACCORDION_ID;
    const content = buildIndicatorSectionContent(section);

    return `
      <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-accordion-section="${
        section.id
      }">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
          data-accordion-button
          data-accordion-id="${section.id}"
          aria-expanded="${isInitiallyOpen ? 'true' : 'false'}"
        >
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <i class="${section.iconClass} h-6 w-6"></i>
            </span>
            <div>
              <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(section.title)}</h2>
            </div>
          </div>
          <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform ${
            isInitiallyOpen ? 'rotate-180' : ''
          }" data-accordion-chevron></i>
        </button>
        <div class="border-t border-slate-100 bg-slate-50/60 px-6 py-5" data-accordion-panel="${section.id}" ${
          isInitiallyOpen ? '' : 'hidden'
        }>
          ${content}
        </div>
      </section>
    `;
  }).join('');
}

function buildDashboardMarkup(sections = composeAccordionSections()) {
  return `
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900">Panel directivos</h1>
        <p class="text-sm text-slate-500">
          Seleccione una categoría para explorar las opciones de indicadores y direcciones disponibles.
        </p>
      </header>
      <div class="space-y-5" data-accordion-root data-accordion-default="${DEFAULT_ACCORDION_ID}">
        ${buildSectionsMarkup(sections)}
        <div class="space-y-5" data-direction-sections></div>
      </div>
    </div>
  `;
}
function initAccordionControls(container) {
  const root = container.querySelector('[data-accordion-root]');
  if (!root) return;

  const buttons = Array.from(root.querySelectorAll('[data-accordion-button]'));
  if (!buttons.length) return;

  const defaultId = root.dataset.accordionDefault ?? null;
  const hasDefault = buttons.some(button => button.dataset.accordionId === defaultId);
  let openId = hasDefault ? defaultId : buttons[0]?.dataset.accordionId ?? null;

  const applyState = () => {
    buttons.forEach(button => {
      const id = button.dataset.accordionId;
      const panel = root.querySelector(`[data-accordion-panel="${id}"]`);
      const chevron = button.querySelector('[data-accordion-chevron]');
      const isOpen = openId === id;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (panel) {
        if (isOpen) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
      }
    });
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.accordionId;
      openId = openId === id ? null : id;
      applyState();
    });
  });
  
  applyState();
}

function initGroupControls(container) {
  const groups = new Map();
  container.querySelectorAll('[data-group-button]').forEach(button => {
    const rootId = button.dataset.groupRoot;
    const groupId = button.dataset.groupId;
    if (!rootId || !groupId) return;
    if (!groups.has(rootId)) {
      groups.set(rootId, { openId: null, items: [] });
    }
    groups.get(rootId).items.push({ button, groupId });
  });
  const updateGroup = entry => {
    entry.items.forEach(({ button, groupId }) => {
      const panel = container.querySelector(`[data-group-panel="${groupId}"]`);
      const chevron = button.querySelector('[data-group-chevron]');
      const isOpen = entry.openId === groupId;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (panel) {
        if (isOpen) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
      }
    });
  };
  groups.forEach(entry => updateGroup(entry));
  groups.forEach(entry => {
    entry.items.forEach(({ button, groupId }) => {
      button.addEventListener('click', () => {
        entry.openId = entry.openId === groupId ? null : groupId;
        updateGroup(entry);
      });
    });
  });

  // Event listener para vistas personalizadas
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-custom-view-button]');
    if (!button) return;

    const viewType = button.dataset.viewType;
    const viewId = button.dataset.viewId;
    const viewTitle = button.dataset.viewTitle;

    if (viewType === 'fauna-capture') {
      await openFaunaCaptureModal(viewTitle);
    }
  });
}

function initOptionModals(container) {
  container.querySelectorAll('[data-option-button]').forEach(button => {
    button.addEventListener('click', async () => {
      const dataKey = button.dataset.optionDatakey;
      const type = button.dataset.optionType;
      const scenario = button.dataset.optionScenario || null;
      const label = button.dataset.optionLabel || button.textContent.trim();

      if (!dataKey || !type) {
        console.warn('Opción sin datos configurados', button);
        return;
      }

      await openIndicatorModal({ label, dataKey, type, scenario });
    });
  });
}

function initDirectionIndicatorButtons(container) {
  container.querySelectorAll('[data-direction-indicator-button]').forEach(button => {
    button.addEventListener('click', async () => {
      const name = button.dataset.indicatorName || 'Indicador';
      const subtitle = button.dataset.indicatorSubtitle || '';
      const code = button.dataset.indicatorCode || '';
      const dataKey = button.dataset.indicatorDatakey || '';
      const type = button.dataset.indicatorType || '';
      const scenarioValue = normalizeScenarioValue(button.dataset.indicatorScenario || null);
      const defaultChartType = button.dataset.indicatorDefaultChart || '';

      if (dataKey) {
        await openIndicatorModal({
          label: name,
          dataKey,
          type: type || 'scenario',
          scenario: scenarioValue,
          defaultChartType: defaultChartType || null
        });
        return;
      }

      openDirectionIndicatorPlaceholderModal({ name, subtitle, code });
    });
  });
}

function initSmsObjectiveAccordions(container) {
  const root = container.querySelector('[data-sms-objectives-root]');
  if (!root) return;

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-sms-objective-button]');
    if (!button || !root.contains(button)) return;

    const panelId = button.dataset.smsObjectivePanelTarget;
    if (!panelId) return;

    const panel = Array.from(root.querySelectorAll('[data-sms-objective-panel]')).find(
      element => element.dataset.smsObjectivePanel === panelId
    );
    if (!panel) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    button.setAttribute('aria-expanded', nextState ? 'true' : 'false');
    if (nextState) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }

    const chevron = button.querySelector('[data-sms-objective-chevron]');
    if (chevron) {
      chevron.classList.toggle('rotate-180', nextState);
    }
  });
}

function initSmsIndicatorLinks(container) {
  const links = container.querySelectorAll('[data-sms-indicator-link]');
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const indicatorId = link.getAttribute('data-sms-indicator-id');
      const indicatorName = link.getAttribute('data-sms-indicator-name');
      const indicatorSubtitle = link.getAttribute('data-sms-indicator-subtitle');
      
      const openModalFn = SMS_INDICATOR_MODAL_ROUTES[indicatorId];
      
      if (openModalFn) {
        openModalFn(indicatorId, indicatorName, indicatorSubtitle);
      } else {
        console.warn(`No hay modal configurado para el indicador: ${indicatorId}`);
      }
    });
  });
}

function normalizeDirectionName(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getDirectionPriority(node) {
  const normalized = normalizeDirectionName(node?.nombre);
  if (!normalized) return 100;

  const normalizedKey = normalizeMatchText(node?.clave);
  const isOperational =
    normalized.includes('indicadores operacionales') ||
    normalized.includes('indicadores operativos') ||
    normalized.includes('indicadores de operacion');
  const isFbo =
    normalized.includes('indicadores fbo') ||
    normalized.includes('aviacion general') ||
    normalized.includes('fbo') ||
    normalizedKey === 'fbo';

  if (isOperational) return 0;
  if (isFbo) return 1;
  return 100;
}

function buildAreaTree(areas) {
  if (!Array.isArray(areas)) return [];

  const filteredAreas = (areas ?? []).filter(area => {
    if (!area) return false;

    const normalizedName = normalizeAreaName(area?.nombre);

    if (!normalizedName) {
      return false;
    }

    if (normalizedName.includes('sin asignar')) {
      return false;
    }

    if (EXCLUDED_AREA_NAMES.has(normalizedName)) {
      return false;
    }

    return true;
  });

  const nodes = new Map();
  filteredAreas.forEach(area => {
    if (!area) return;
    nodes.set(area.id, { ...area, children: [] });
  });

  const roots = [];
  nodes.forEach(node => {
    if (node.parent_area_id && nodes.has(node.parent_area_id)) {
      nodes.get(node.parent_area_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (list, level = 0) => {
    list.sort((a, b) => {
      if (level === 0) {
        const priorityDiff = getDirectionPriority(a) - getDirectionPriority(b);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
      }

      const nameA = a?.nombre ?? '';
      const nameB = b?.nombre ?? '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });

    list.forEach(child => {
      if (Array.isArray(child.children) && child.children.length) {
        sortTree(child.children, level + 1);
      }
    });
  };

  sortTree(roots);
  return roots;
}

function collectAreaIds(node, accumulator = new Set()) {
  if (!node || typeof node !== 'object') {
    return accumulator;
  }

  const nodeId = node.id;
  if (nodeId !== null && nodeId !== undefined) {
    accumulator.add(String(nodeId));
  }

  if (Array.isArray(node.children) && node.children.length) {
    node.children.forEach(child => collectAreaIds(child, accumulator));
  }

  return accumulator;
}

function indicatorBelongsToAreaIds(indicator, areaIds) {
  if (!indicator || !areaIds?.size) return false;

  const candidates = [];

  if (indicator.area_id !== null && indicator.area_id !== undefined) {
    candidates.push(indicator.area_id);
  }

  if (indicator.areaId !== null && indicator.areaId !== undefined) {
    candidates.push(indicator.areaId);
  }

  if (indicator.area?.id !== null && indicator.area?.id !== undefined) {
    candidates.push(indicator.area.id);
  }

  return candidates.some(candidate => areaIds.has(String(candidate)));
}

function normalizeDirectionKey(direction) {
  return normalizeMatchText(direction?.clave);
}

function indicatorMatchesDirection(indicator, direction, areaIds) {
  if (!indicator || !direction) return false;

  if (indicatorBelongsToAreaIds(indicator, areaIds)) {
    return true;
  }

  const directionId = direction?.id !== null && direction?.id !== undefined ? String(direction.id) : null;
  const indicatorDirectionId = indicator?.direccion_id !== null && indicator?.direccion_id !== undefined
    ? String(indicator.direccion_id)
    : null;

  if (directionId && indicatorDirectionId && directionId === indicatorDirectionId) {
    return true;
  }

  const directionKey = normalizeDirectionKey(direction);
  const indicatorDirectionKey = normalizeMatchText(indicator?.direccion_clave);
  if (directionKey && indicatorDirectionKey && directionKey === indicatorDirectionKey) {
    return true;
  }

  const directionName = normalizeMatchText(direction?.nombre);
  const indicatorDirectionName = normalizeMatchText(indicator?.direccion_nombre);
  if (directionName && indicatorDirectionName && directionName === indicatorDirectionName) {
    return true;
  }

  return false;
}

function getIndicatorsForDirection(direction) {
  if (!direction) return [];

  const indicators = Array.isArray(cachedIndicators) ? cachedIndicators : [];
  if (!indicators.length) return [];

  const areaIds = collectAreaIds(direction);
  const seen = new Set();
  const matched = [];

  const directionKey = normalizeDirectionKey(direction);
  const normalizedDirectionName = normalizeMatchText(direction?.nombre);
  const isPlanningDirection =
    directionKey === 'dpe' || normalizedDirectionName.includes('direccion de planeacion estrategica');

  indicators.forEach(indicator => {
    if (!indicator?.id) return;
    if (seen.has(indicator.id)) return;
    if (indicatorMatchesDirection(indicator, direction, areaIds)) {
      seen.add(indicator.id);
      matched.push(indicator);
    }
  });

  let filteredIndicators = matched;

  if (isPlanningDirection) {
    filteredIndicators = matched.filter(indicator => {
      const code = getIndicatorCode(indicator);
      return code ? PLANNING_ALLOWED_CODES.has(code) : false;
    });
  }

  filteredIndicators.sort((a, b) => {
    if (isPlanningDirection) {
      const priorityDiff = getPlanningIndicatorPriority(a) - getPlanningIndicatorPriority(b);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
    }

    const orderDiff = getVisualizationOrder(a?.orden_visualizacion) - getVisualizationOrder(b?.orden_visualizacion);
    if (orderDiff !== 0) return orderDiff;

    const areaDiff = (a?.area_nombre ?? '').localeCompare(b?.area_nombre ?? '', 'es', { sensitivity: 'base' });
    if (areaDiff !== 0) return areaDiff;

    return (a?.nombre ?? '').localeCompare(b?.nombre ?? '', 'es', { sensitivity: 'base' });
  });

  return filteredIndicators;
}

function buildDirectionIndicatorGroupMarkup(indicator, rootId) {
  if (!indicator || !indicator.id) return '';

  const groupId = `${DIRECTION_GROUP_PREFIX}${indicator.id}`;
  const title = indicator?.nombre ?? 'Indicador sin nombre';
  const subtitle = indicator?.direccion_nombre ?? indicator?.area_nombre ?? null;
  const indicatorCode = getIndicatorCode(indicator);
  const code = indicatorCode ?? '';
  const hasDashboardData = indicatorHasDashboardData(indicator);
  const defaultScenario = hasDashboardData
    ? normalizeScenarioValue(getIndicatorDefaultScenario(indicator, 'MEDIO'))
    : null;
  const isPlanningPriority = indicatorCode ? PLANNING_ALLOWED_CODES.has(indicatorCode) : false;
  const datasetAttributes = [];

  if (hasDashboardData && indicator?.id) {
    datasetAttributes.push('data-indicator-has-data="true"');
    datasetAttributes.push(
      `data-indicator-datakey="${escapeHtml(`${DIRECT_INDICATOR_PREFIX}${indicator.id}`)}"`
    );
    datasetAttributes.push('data-indicator-type="scenario"');
    if (defaultScenario) {
      datasetAttributes.push(`data-indicator-scenario="${escapeHtml(defaultScenario)}"`);
    }
    if (isPlanningPriority) {
      datasetAttributes.push('data-indicator-default-chart="bar"');
    }
  }

  const datasetAttributesMarkup = datasetAttributes.length
    ? `
        ${datasetAttributes.join('\n        ')}`
    : '';

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-direction-indicator-button
        data-indicator-id="${escapeHtml(groupId)}"
        data-indicator-name="${escapeHtml(title)}"
        ${subtitle ? `data-indicator-subtitle="${escapeHtml(subtitle)}"` : ''}
        ${code ? `data-indicator-code="${escapeHtml(code)}"` : ''}
        ${datasetAttributesMarkup}
      >
        <span class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <i class="fa-solid fa-chart-line h-5 w-5"></i>
          </span>
          <span class="flex flex-col">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</span>
            ${subtitle ? `<span class="text-xs font-medium text-slate-500">${escapeHtml(subtitle)}</span>` : ''}
          </span>
        </span>
      </button>
    </div>
  `;
}

function buildDirectionIndicatorsMarkup(direction, rootId) {
  const indicators = getIndicatorsForDirection(direction);
  if (!indicators.length) return '';

  return indicators.map(indicator => buildDirectionIndicatorGroupMarkup(indicator, rootId)).join('');
}

function isGeneralDirection(area) {
  const name = area?.nombre?.toLowerCase?.() ?? '';
  const key = area?.clave?.toLowerCase?.() ?? '';

  if (!name && !key) return false;

  return name.includes('dirección general') || key === 'dg';
}

function extractDirectionRoots(tree) {
  if (!Array.isArray(tree)) return [];

  const directions = [];

  tree.forEach(node => {
    if (!node) return;

    if (isGeneralDirection(node) && Array.isArray(node.children) && node.children.length) {
      // Filtrar las direcciones hijas que queremos ocultar
      const filteredChildren = node.children.filter(child => !shouldHideDirection(child));
      directions.push(...filteredChildren);
      return;
    }

    // Solo agregar la dirección si no está en la lista de direcciones a ocultar
    if (!shouldHideDirection(node)) {
      directions.push(node);
    }
  });

  return directions;
}

function shouldHideDirection(direction) {
  if (!direction) return false;

  const normalizedName = normalizeMatchText(direction?.nombre);
  const normalizedKey = normalizeMatchText(direction?.clave);

  if (!normalizedName && !normalizedKey) return false;

  if (normalizedName === 'sin asignar' || normalizedName.includes('sin asignar')) {
    return true;
  }

  const condensedName = normalizedName.replace(/[\s-]+/g, '');
  const condensedKey = normalizedKey.replace(/[\s-]+/g, '');

  if (
    condensedName.includes('subdireccion') ||
    condensedKey.includes('subdireccion') ||
    normalizedName.includes('sub direccion')
  ) {
    return true;
  }

  return false;
}

function buildDirectionPanelContent(direction, rootId) {
  const sections = [];

  const indicatorsMarkup = buildDirectionIndicatorsMarkup(direction, rootId);
  if (indicatorsMarkup) {
    sections.push(`
      <div class="space-y-3">
        <p class="text-sm font-medium text-slate-700">Indicadores</p>
        <div class="space-y-3">
          ${indicatorsMarkup}
        </div>
      </div>
    `);
  }

  if (!sections.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay subdirecciones ni indicadores registrados.
      </div>
    `;
  }

  return `
    <div class="space-y-4">
      ${sections.join('')}
    </div>
  `;
}

function buildDirectionSection(direction) {
  const sectionId = `direction-${direction.id}`;
  const panelContent = buildDirectionPanelContent(direction, sectionId);

  return `
    <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-accordion-section="${escapeHtml(
      sectionId
    )}">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-accordion-button
        data-accordion-id="${escapeHtml(sectionId)}"
        aria-expanded="false"
      >
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <i class="fa-solid fa-sitemap h-6 w-6"></i>
          </span>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(direction?.nombre ?? '—')}</h2>
          </div>
        </div>
        <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-accordion-chevron></i>
      </button>
      <div class="border-t border-slate-100 bg-slate-50/60 px-6 py-5" data-accordion-panel="${escapeHtml(sectionId)}" hidden>
        ${panelContent}
      </div>
    </section>
  `;
}

function buildDirectionSectionsMarkup(tree) {
  const directions = extractDirectionRoots(tree);

  if (!directions.length) {
    return `
      <div class="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay direcciones registradas.
      </div>
    `;
  }

  return directions.map(buildDirectionSection).join('');
}

async function renderDirections(container) {
  if (!container) return;
  renderLoading(container, 'Cargando direcciones...');

  try {
    const areas = await getAreas();
    const tree = buildAreaTree(areas ?? []);
    container.innerHTML = buildDirectionSectionsMarkup(tree);

    initGroupControls(container);
    initDirectionIndicatorButtons(container);
    initOptionModals(container);
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}

async function openImpactosFaunaModal() {
  try {
    const root = ensureModalContainer();
    document.body.classList.add('overflow-hidden');

    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${IMPACTOS_FAUNA_MODAL_ID}">
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full">
          <div class="text-center space-y-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p class="text-sm text-slate-600">Cargando datos del indicador...</p>
          </div>
        </div>
      </div>
    `;

    const records = await getImpactosFauna();

    if (!records || !records.length) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${IMPACTOS_FAUNA_MODAL_ID}">
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full text-center space-y-4">
            <i class="fa-solid fa-chart-simple text-4xl text-slate-300"></i>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold text-slate-900">Sin datos disponibles</h3>
              <p class="text-sm text-slate-600">No se encontraron registros en la tabla de impactos con fauna.</p>
            </div>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
              data-modal-close
            >
              Cerrar
            </button>
          </div>
        </div>
      `;

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButtons = root.querySelectorAll('[data-modal-close]');
      const handleClose = () => {
        closeButtons.forEach(button => button.removeEventListener('click', handleClose));
        overlay?.removeEventListener('click', overlayListener);
        document.removeEventListener('keydown', escListener);
        closeIndicatorModal();
      };
      const overlayListener = event => {
        if (event.target === overlay) {
          handleClose();
        }
      };
      const escListener = event => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };

      overlay?.addEventListener('click', overlayListener);
      closeButtons.forEach(button => button.addEventListener('click', handleClose));
      document.addEventListener('keydown', escListener);
      return;
    }

    let showHistorical = false;
    let cleanup = () => {};

    const renderModal = () => {
      cleanup();
      const { config, filteredRecords } = buildImpactosFaunaChartView(records, { showHistorical });
      const summary = buildImpactosFaunaSummary(filteredRecords);
      const table = buildImpactosFaunaDetailTable(records, { showHistorical });

      root.innerHTML = buildImpactosFaunaModalMarkup({ showHistorical, summary, table });

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButtons = root.querySelectorAll('[data-modal-close]');
      const toggleButton = root.querySelector('[data-impactos-fauna-toggle]');
      const exportButton = root.querySelector('[data-impactos-fauna-export]');
      const canvas = root.querySelector('#chartImpactosFauna');

      const handleClose = () => {
        cleanup();
        closeIndicatorModal();
      };

      const overlayListener = event => {
        if (event.target === overlay) {
          handleClose();
        }
      };

      const escListener = event => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };

      overlay?.addEventListener('click', overlayListener);
      closeButtons.forEach(button => button.addEventListener('click', handleClose));
      document.addEventListener('keydown', escListener);

      cleanup = () => {
        overlay?.removeEventListener('click', overlayListener);
        closeButtons.forEach(button => button.removeEventListener('click', handleClose));
        document.removeEventListener('keydown', escListener);
      };

      if (config && canvas) {
        renderModalChart(canvas, config);
      } else if (canvas) {
        const emptyState = document.createElement('div');
        emptyState.className = 'flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500';
        emptyState.textContent = 'Sin datos disponibles para el periodo seleccionado.';
        canvas.replaceWith(emptyState);
      }

      if (toggleButton) {
        toggleButton.addEventListener('click', () => {
          showHistorical = !showHistorical;
          renderModal();
        });
      }

      if (exportButton) {
        const csv = buildImpactosFaunaCsv(records, { showHistorical });
        exportButton.disabled = !csv;
        exportButton.classList.toggle('opacity-50', !csv);
        exportButton.classList.toggle('pointer-events-none', !csv);

        if (csv) {
          exportButton.addEventListener('click', () => {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const suffix = showHistorical ? 'ultimos-4-anos' : 'anio-actual';
            link.href = url;
            link.download = `impactos-fauna-${suffix}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          });
        }
      }
    };

    renderModal();
  } catch (error) {
    console.error('Error al abrir modal de impactos de fauna:', error);
    const root = ensureModalContainer();
    document.body.classList.add('overflow-hidden');
    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${IMPACTOS_FAUNA_MODAL_ID}">
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full text-center space-y-4">
          <i class="fa-solid fa-circle-exclamation text-4xl text-red-500"></i>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-900">Error al cargar datos</h3>
            <p class="text-sm text-slate-600">${escapeHtml(error?.message || 'Ocurrió un error inesperado al consultar Supabase.')}</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            data-modal-close
          >
            Cerrar
          </button>
        </div>
      </div>
    `;

    const overlay = root.querySelector('[data-modal-overlay]');
    const closeButtons = root.querySelectorAll('[data-modal-close]');
    const handleClose = () => {
      closeButtons.forEach(button => button.removeEventListener('click', handleClose));
      overlay?.removeEventListener('click', overlayListener);
      document.removeEventListener('keydown', escListener);
      closeIndicatorModal();
    };
    const overlayListener = event => {
      if (event.target === overlay) {
        handleClose();
      }
    };
    const escListener = event => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    overlay?.addEventListener('click', overlayListener);
    closeButtons.forEach(button => button.addEventListener('click', handleClose));
    document.addEventListener('keydown', escListener);
  }
}

async function openPgpaFsModal() {
  try {
    const root = ensureModalContainer();
    document.body.classList.add('overflow-hidden');

    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${PGPAFS_MODAL_ID}">
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full">
          <div class="text-center space-y-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p class="text-sm text-slate-600">Cargando datos del indicador...</p>
          </div>
        </div>
      </div>
    `;

    // Cargar datos de PGPAFS y capturas
    const [smsRecords, capturesRecords] = await Promise.all([
      getSmsDocuments(),
      getCapturasFauna()
    ]);
    
    let showHistorical = false;
    let activeTab = 'pgpafs';
    let pgpafsChart = null;
    let capturesChart = null;
    let cleanup = () => {};

    const renderModal = () => {
      const chartView = buildPgpaFsChartView(smsRecords, { showHistorical });
      const summary = buildPgpaFsSummary(chartView.entries);
      const capturesView = buildCapturesChartView(capturesRecords, { showHistorical });

      // Destruir gráficas anteriores si existen
      if (pgpafsChart) {
        pgpafsChart.destroy();
        pgpafsChart = null;
      }
      if (capturesChart) {
        capturesChart.destroy();
        capturesChart = null;
      }

      root.innerHTML = buildPgpaFsModalMarkup({
        activeTab,
        hasData: Boolean(chartView.config),
        hasCapturesData: Boolean(capturesView.config),
        summary,
        periodLabel: summary?.periodLabel ?? '',
        showHistorical
      });

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButtons = root.querySelectorAll('[data-modal-close]');
      const tabButtons = root.querySelectorAll('[data-pgpafs-tab]');
      const panels = root.querySelectorAll('[data-pgpafs-panel]');
      const canvasPgpafs = root.querySelector('#chartPgpaFs');
      const canvasCapturas = root.querySelector('#chartCapturas');
      const pgpafsToggleButton = root.querySelector('[data-pgpafs-toggle]');
      const capturesToggleButton = root.querySelector('[data-captures-toggle]');
      const baseButtonClass =
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition';
      const tabHandlers = new Map();

      const Chart = typeof window !== 'undefined' ? window.Chart : null;

      const handleClose = () => {
        cleanup();
        if (pgpafsChart) {
          pgpafsChart.destroy();
          pgpafsChart = null;
        }
        if (capturesChart) {
          capturesChart.destroy();
          capturesChart = null;
        }
        closeIndicatorModal();
      };

      const overlayListener = event => {
        if (event.target === overlay) {
          handleClose();
        }
      };

      const escListener = event => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };

      const activateTab = tabId => {
        if (!tabId) {
          return;
        }

        activeTab = tabId;

        tabButtons.forEach(button => {
          const target = button.getAttribute('data-pgpafs-tab');
          const isActive = target === activeTab;
          button.className = `${baseButtonClass} ${
            isActive
              ? 'bg-primary-600 text-white shadow'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
          }`;
          button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(panel => {
          const target = panel.getAttribute('data-pgpafs-panel');
          if (target === activeTab) {
            panel.removeAttribute('hidden');
          } else {
            panel.setAttribute('hidden', '');
          }
        });

        // Renderizar gráfica según pestaña activa
        if (activeTab === 'pgpafs' && chartView.config && canvasPgpafs && Chart) {
          if (!pgpafsChart) {
            pgpafsChart = new Chart(canvasPgpafs, chartView.config);
          } else if (typeof pgpafsChart.resize === 'function') {
            pgpafsChart.resize();
          }
        } else if (activeTab === 'captures' && capturesView.config && canvasCapturas && Chart) {
          if (!capturesChart) {
            capturesChart = new Chart(canvasCapturas, capturesView.config);
          } else if (typeof capturesChart.resize === 'function') {
            capturesChart.resize();
          }
        }
      };

      closeButtons.forEach(button => button.addEventListener('click', handleClose));
      overlay?.addEventListener('click', overlayListener);
      document.addEventListener('keydown', escListener);

      tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-pgpafs-tab');
        const isActive = tabId === activeTab;
        button.className = `${baseButtonClass} ${
          isActive ? 'bg-primary-600 text-white shadow' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
        }`;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');

        const handler = () => activateTab(tabId);
        tabHandlers.set(button, handler);
        button.addEventListener('click', handler);
      });

      panels.forEach(panel => {
        const target = panel.getAttribute('data-pgpafs-panel');
        if (target === activeTab) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      // Handlers para los botones toggle
      if (pgpafsToggleButton) {
        pgpafsToggleButton.addEventListener('click', () => {
          showHistorical = !showHistorical;
          renderModal();
        });
      }

      if (capturesToggleButton) {
        capturesToggleButton.addEventListener('click', () => {
          showHistorical = !showHistorical;
          renderModal();
        });
      }

      cleanup = () => {
        closeButtons.forEach(button => button.removeEventListener('click', handleClose));
        overlay?.removeEventListener('click', overlayListener);
        document.removeEventListener('keydown', escListener);
        tabHandlers.forEach((handler, button) => button.removeEventListener('click', handler));
      };

      activateTab(activeTab);
    };

    renderModal();
  } catch (error) {
    console.error('Error al abrir modal PGPAFS:', error);
    const root = ensureModalContainer();
    document.body.classList.add('overflow-hidden');

    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${PGPAFS_MODAL_ID}">
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full text-center space-y-4">
          <i class="fa-solid fa-circle-exclamation text-4xl text-red-500"></i>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-900">Error al cargar datos</h3>
            <p class="text-sm text-slate-600">${escapeHtml(error?.message || 'Ocurrió un error inesperado al consultar Supabase.')}</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            data-modal-close
          >
            Cerrar
          </button>
        </div>
      </div>
    `;

    const overlay = root.querySelector('[data-modal-overlay]');
    const closeButtons = root.querySelectorAll('[data-modal-close]');

    const handleClose = () => {
      closeButtons.forEach(button => button.removeEventListener('click', handleClose));
      overlay?.removeEventListener('click', overlayListener);
      document.removeEventListener('keydown', escListener);
      closeIndicatorModal();
    };

    const overlayListener = event => {
      if (event.target === overlay) {
        handleClose();
      }
    };

    const escListener = event => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    overlay?.addEventListener('click', overlayListener);
    closeButtons.forEach(button => button.addEventListener('click', handleClose));
    document.addEventListener('keydown', escListener);
  }
}

async function openFaunaCaptureModal(title) {
  try {
    const root = ensureModalContainer();
    document.body.classList.add('overflow-hidden');

    // Mostrar loading
    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p class="text-sm text-slate-600">Cargando datos de capturas...</p>
          </div>
        </div>
      </div>
    `;

    // Obtener datos
    const captureData = await getCapturasFauna();
    
    if (!captureData || !captureData.length) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
            <div class="text-center">
              <i class="fa-solid fa-chart-simple text-4xl text-slate-300 mb-4"></i>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Sin datos disponibles</h3>
              <p class="text-sm text-slate-600 mb-4">No hay datos de capturas de fauna registrados.</p>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                data-modal-close
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const closeBtn = root.querySelector('[data-modal-close]');
      closeBtn?.addEventListener('click', closeIndicatorModal);
      return;
    }

    // Estado del modal
    let currentChartType = 'bar';
    let showHistorical = false;

    const renderModal = (chartType, historical) => {
      root.innerHTML = buildFaunaCaptureModalMarkup(title, captureData, chartType, historical);

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButton = root.querySelector('[data-modal-close]');
      const canvas = root.querySelector('[data-fauna-chart]');
      const chartToggle = root.querySelector('[data-chart-toggle]');
      const historicalCheckbox = root.querySelector('[data-show-historical]');

      const handleClose = () => {
        overlay?.removeEventListener('click', overlayListener);
        closeButton?.removeEventListener('click', handleClose);
        document.removeEventListener('keydown', escListener);
        closeIndicatorModal();
      };

      const overlayListener = event => {
        if (event.target === overlay) {
          handleClose();
        }
      };

      const escListener = event => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };

      overlay?.addEventListener('click', overlayListener);
      closeButton?.addEventListener('click', handleClose);
      document.addEventListener('keydown', escListener);

      // Evento para cambiar tipo de gráfica
      if (chartToggle) {
        chartToggle.querySelectorAll('[data-chart-type]').forEach(btn => {
          btn.addEventListener('click', () => {
            const newChartType = btn.dataset.chartType;
            if (newChartType !== currentChartType) {
              currentChartType = newChartType;
              renderModal(newChartType, showHistorical);
            }
          });
        });
      }

      // Evento para checkbox de histórico
      if (historicalCheckbox) {
        historicalCheckbox.checked = historical;
        historicalCheckbox.addEventListener('change', event => {
          showHistorical = event.target.checked;
          renderModal(currentChartType, showHistorical);
        });
      }

      // Renderizar gráfica
      const chartConfig = buildFaunaCaptureChartConfig(captureData, chartType, historical);
      if (chartConfig) {
        renderModalChart(canvas, chartConfig);
      }
    };

    renderModal(currentChartType, showHistorical);

  } catch (error) {
    console.error('Error al abrir modal de capturas de fauna:', error);
    const root = ensureModalContainer();
    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
          <div class="text-center">
            <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Error al cargar datos</h3>
            <p class="text-sm text-slate-600 mb-4">${escapeHtml(error.message || 'Ocurrió un error inesperado')}</p>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              data-modal-close
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const closeBtn = root.querySelector('[data-modal-close]');
    closeBtn?.addEventListener('click', closeIndicatorModal);
  }
}

function buildFaunaCaptureModalMarkup(title, captureData, chartType = 'bar', showHistorical = false) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  
  // Obtener últimos datos disponibles
  const latestData = getLatestFaunaData(captureData, currentYear);
  
  // Calcular variación año contra año
  const currentYearTotal = latestData.currentTotal;
  const previousYearTotal = latestData.previousTotal;
  const diff = currentYearTotal - previousYearTotal;
  const pct = previousYearTotal > 0 ? diff / previousYearTotal : null;
  
  const trendClasses = getTrendColorClasses(diff, { invert: true });
  const formattedDiff = formatSignedNumber(diff);
  const formattedPct = formatPercentage(pct);
  
  // Construir tabla con histórico opcional
  const { headerMarkup, bodyMarkup } = buildFaunaTableData(captureData, showHistorical);
  
  const chartToggle = buildChartTypeToggle(chartType, 'monthly');

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
      <div class="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
        <button
          type="button"
          class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          aria-label="Cerrar"
          data-modal-close
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="space-y-6 p-6">
          <header class="space-y-2">
            <p class="text-xs uppercase tracking-widest text-slate-400">Vista personalizada</p>
            <h2 class="text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h2>
            <div class="flex flex-wrap gap-3 text-sm text-slate-500">
              <span><strong>Área:</strong> Gestión del Peligro Aviario</span>
              <span><strong>Período:</strong> ${currentYear} vs ${previousYear}</span>
            </div>
          </header>

          <section class="space-y-4">
            <header class="flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Comparativo mensual (${latestData.monthName} ${currentYear})</h3>
              <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">Comparativo año contra año</span>
            </header>

            <div class="grid gap-4 sm:grid-cols-3">
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${currentYear}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatNumber(currentYearTotal)}</p>
              </article>
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${previousYear}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatNumber(previousYearTotal)}</p>
              </article>
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">Variación</p>
                <p class="mt-2 text-2xl font-semibold ${trendClasses.text}">${formattedPct}</p>
                <p class="mt-1 text-sm text-slate-600">(${formattedDiff})</p>
              </article>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between flex-wrap gap-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Visualización</h3>
              <div class="flex items-center gap-3">
                ${chartToggle}
              </div>
            </div>
            <div class="h-72">
              <canvas data-fauna-chart aria-label="Gráfica de capturas de fauna"></canvas>
            </div>
            <div class="mt-3 flex justify-end">
              <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  data-show-historical
                  class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Mostrar últimos 4 años</span>
              </label>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Detalle del periodo</h3>
            </div>
            <div class="max-h-72 overflow-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  ${headerMarkup}
                </thead>
                <tbody>${bodyMarkup}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function processMonthlyFaunaData(captureData, year) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // Filtrar datos del año actual
  const yearData = captureData.filter(item => item.anio === year);
  
  // Crear estructura mensual
  const monthlyData = months.map((monthName, index) => {
    const monthNumber = index + 1;
    const monthData = yearData.find(item => item.mes === monthNumber);
    
    return {
      month: monthName,
      aves: monthData?.aves || 0,
      mamiferos: monthData?.mamiferos || 0,
      reptiles: monthData?.reptiles || 0,
      total: (monthData?.aves || 0) + (monthData?.mamiferos || 0) + (monthData?.reptiles || 0)
    };
  });
  
  return monthlyData;
}

function getLatestFaunaData(captureData, year) {
  const currentYear = year;
  const previousYear = year - 1;
  
  // Obtener datos del año actual
  const currentYearData = captureData.filter(item => item.anio === currentYear);
  const previousYearData = captureData.filter(item => item.anio === previousYear);
  
  // Encontrar el último mes con datos en el año actual
  const currentMonths = currentYearData.map(item => item.mes).sort((a, b) => b - a);
  const latestMonth = currentMonths.length > 0 ? currentMonths[0] : 12;
  
  // Obtener totales acumulados hasta el último mes disponible
  const currentTotal = currentYearData
    .filter(item => item.mes <= latestMonth)
    .reduce((sum, item) => sum + (item.aves || 0) + (item.mamiferos || 0) + (item.reptiles || 0), 0);
    
  const previousTotal = previousYearData
    .filter(item => item.mes <= latestMonth)
    .reduce((sum, item) => sum + (item.aves || 0) + (item.mamiferos || 0) + (item.reptiles || 0), 0);
  
  const monthName = MONTHS[latestMonth - 1]?.label || `Mes ${latestMonth}`;
  
  return {
    currentTotal,
    previousTotal,
    latestMonth,
    monthName,
    currentYear,
    previousYear
  };
}

function buildFaunaTableData(captureData, showHistorical = false) {
  const currentYear = CURRENT_YEAR;
  const historicalYears = showHistorical
    ? Array.from({ length: 4 }, (_, index) => currentYear - (3 - index)).filter(year => year > 0)
    : [];
  const hasHistoricalYears = showHistorical && historicalYears.length > 0;

  let headerCells = ['<th class="px-4 py-2 text-left">Periodo</th>'];

  if (hasHistoricalYears) {
    headerCells = headerCells.concat(
      historicalYears.map((year, index, array) =>
        `<th class="px-4 py-2 text-right ${
          index === array.length - 1 ? 'text-slate-700' : 'text-slate-500'
        }">${year}</th>`
      )
    );
  } else {
    headerCells.push('<th class="px-4 py-2 text-right">Actual</th>');
    headerCells.push('<th class="px-4 py-2 text-right">Anterior</th>');
  }

  const variationNote = hasHistoricalYears
    ? `<div class="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">${
        currentYear - 1
      } → ${currentYear}</div>`
    : '';

  headerCells.push(
    hasHistoricalYears
      ? `<th class="px-4 py-2 text-right">Variación${variationNote}</th>`
      : '<th class="px-4 py-2 text-right">Variación</th>'
  );

  headerCells.push(
    hasHistoricalYears
      ? `<th class="px-4 py-2 text-right">% Variación${variationNote}</th>`
      : '<th class="px-4 py-2 text-right">% Variación</th>'
  );

  const totalColumns = headerCells.length;
  const headerMarkup = `<tr>${headerCells.join('')}</tr>`;

  if (!captureData || !captureData.length) {
    return {
      headerMarkup,
      bodyMarkup: `<tr><td colspan="${totalColumns}" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td></tr>`
    };
  }

  // Procesar datos por mes
  const currentData = captureData.filter(item => item.anio === currentYear);
  const previousData = captureData.filter(item => item.anio === (currentYear - 1));

  const currentMap = new Map();
  currentData.forEach(item => {
    const total = (item.aves || 0) + (item.mamiferos || 0) + (item.reptiles || 0);
    currentMap.set(item.mes, total);
  });

  const previousMap = new Map();
  previousData.forEach(item => {
    const total = (item.aves || 0) + (item.mamiferos || 0) + (item.reptiles || 0);
    previousMap.set(item.mes, total);
  });

  // Crear mapas históricos si es necesario
  const historicalMaps = new Map();
  if (hasHistoricalYears) {
    historicalYears.forEach(year => {
      const yearData = captureData.filter(item => item.anio === year);
      const monthMap = new Map();
      yearData.forEach(item => {
        const total = (item.aves || 0) + (item.mamiferos || 0) + (item.reptiles || 0);
        monthMap.set(item.mes, total);
      });
      historicalMaps.set(year, monthMap);
    });
  }

  const monthsToRender = showHistorical
    ? Array.from({ length: 12 }, (_, index) => index + 1)
    : Array.from(new Set([...currentMap.keys(), ...previousMap.keys()])).sort((a, b) => a - b);

  const bodyMarkup = monthsToRender
    .map(monthNumber => {
      const current = currentMap.get(monthNumber) || 0;
      const previous = previousMap.get(monthNumber) || 0;
      const diff = current - previous;
      const pct = previous > 0 ? diff / previous : null;

      const historicalCells = showHistorical
        ? historicalYears
            .map((year, index, array) => {
              const map = historicalMaps.get(year);
              const value = map?.get(monthNumber) || 0;
              return `<td class="px-4 py-2 text-right text-sm ${
                index === array.length - 1 ? 'font-semibold text-slate-800' : 'text-slate-500'
              }">${formatNumber(value)}</td>`;
            })
            .join('')
        : `<td class="px-4 py-2 text-right text-sm font-semibold text-slate-800">${formatNumber(current)}</td><td class="px-4 py-2 text-right text-sm text-slate-600">${formatNumber(previous)}</td>`;

      const variationClass = diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-500';

      return `
        <tr class="border-b border-slate-100">
          <td class="px-4 py-2 text-left text-sm text-slate-600">${escapeHtml(MONTHS[monthNumber - 1]?.label || `Mes ${monthNumber}`)}</td>
          ${historicalCells}
          <td class="px-4 py-2 text-right text-sm font-semibold ${variationClass}">
            <div>${formatSignedNumber(diff)}</div>
          </td>
          <td class="px-4 py-2 text-right text-sm text-slate-600">
            <div>${formatPercentage(pct)}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return { headerMarkup, bodyMarkup };
}

function buildFaunaCaptureChartConfig(captureData, chartType = 'bar', showHistorical = false) {
  const currentYear = new Date().getFullYear();
  
  // Determinar años a mostrar
  const yearsToShow = showHistorical ? 4 : 1;
  const startYear = currentYear - (yearsToShow - 1);
  
  const months = MONTHS.map(month => month.short);
  const datasets = [];
  const colors = [
    { aves: '#3B82F6', mamiferos: '#F59E0B', reptiles: '#10B981' }, // Año actual
    { aves: '#60A5FA', mamiferos: '#FBBF24', reptiles: '#34D399' }, // Año -1
    { aves: '#93C5FD', mamiferos: '#FCD34D', reptiles: '#6EE7B7' }, // Año -2
    { aves: '#DBEAFE', mamiferos: '#FEF3C7', reptiles: '#D1FAE5' }  // Año -3
  ];
  
  for (let yearIndex = 0; yearIndex < yearsToShow; yearIndex++) {
    const year = startYear + yearIndex;
    const yearData = captureData.filter(item => item.anio === year);
    
    // Crear arrays para cada tipo de fauna
    const avesData = Array(12).fill(0);
    const mamiferosData = Array(12).fill(0);
    const reptilesData = Array(12).fill(0);
    
    yearData.forEach(item => {
      if (item.mes >= 1 && item.mes <= 12) {
        const monthIndex = item.mes - 1;
        avesData[monthIndex] = item.aves || 0;
        mamiferosData[monthIndex] = item.mamiferos || 0;
        reptilesData[monthIndex] = item.reptiles || 0;
      }
    });
    
    const yearSuffix = showHistorical ? ` (${year})` : '';
    const colorSet = colors[yearIndex] || colors[0];
    
    datasets.push(
      {
        label: `Aves${yearSuffix}`,
        data: avesData,
        backgroundColor: colorSet.aves,
        borderColor: colorSet.aves,
        borderWidth: chartType === 'line' ? 2 : 1,
        stack: showHistorical ? `stack${year}` : 'stack0'
      },
      {
        label: `Mamíferos${yearSuffix}`,
        data: mamiferosData,
        backgroundColor: colorSet.mamiferos,
        borderColor: colorSet.mamiferos,
        borderWidth: chartType === 'line' ? 2 : 1,
        stack: showHistorical ? `stack${year}` : 'stack0'
      },
      {
        label: `Reptiles${yearSuffix}`,
        data: reptilesData,
        backgroundColor: colorSet.reptiles,
        borderColor: colorSet.reptiles,
        borderWidth: chartType === 'line' ? 2 : 1,
        stack: showHistorical ? `stack${year}` : 'stack0'
      }
    );
  }
  
  const config = {
    type: chartType,
    data: {
      labels: months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: chartType === 'bar',
          grid: {
            display: false
          }
        },
        y: {
          stacked: chartType === 'bar',
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return Number.isInteger(value) ? value : '';
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            footer: function(tooltipItems) {
              if (chartType === 'bar' && !showHistorical) {
                let total = 0;
                tooltipItems.forEach(function(tooltipItem) {
                  total += tooltipItem.parsed.y;
                });
                return 'Total: ' + total;
              }
              return '';
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  };
  
  // Configuración específica para gráficas de línea
  if (chartType === 'line') {
    config.data.datasets.forEach(dataset => {
      dataset.tension = 0.3;
      dataset.fill = false;
      dataset.pointRadius = 3;
    });
  }
  
  return config;
}

export async function renderDashboard(container) {
  if (!container) return;

  renderLoading(container, 'Cargando panel de directivos...');

  try {
    const indicators = await getIndicators();
    cachedIndicators = Array.isArray(indicators) ? indicators : [];

    const sections = composeAccordionSections();

    container.innerHTML = buildDashboardMarkup(sections);

    initGroupControls(container);
    initOptionModals(container);
    initSmsObjectiveAccordions(container);
    initSmsIndicatorLinks(container);

    const directionsContainer = container.querySelector('[data-direction-sections]');
    if (directionsContainer) {
      await renderDirections(directionsContainer);
    }

    initAccordionControls(container);
  } catch (error) {
    console.error('Error al cargar el panel de directivos:', error);
    renderError(container, error);
  }
}

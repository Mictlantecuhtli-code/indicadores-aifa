import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const { createElement: h } = React;

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  VIEW_TYPES: {
    EXECUTIVE: 'executive',
    COMPARATIVE: 'comparative',
    TEMPORAL: 'temporal',
    HEATMAP: 'heatmap',
    TABLE: 'table'
  }
};

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES BÁSICAS
// ═══════════════════════════════════════════════════════════════════

function calculateIndicatorStatus(indicator) {
  const cumplimiento = indicator.cumplimiento || 0;
  if (cumplimiento >= 1.15) return 'excellent';
  if (cumplimiento >= 1.0) return 'success';
  if (cumplimiento >= 0.85) return 'warning';
  return 'critical';
}

function calculateMetrics(indicators) {
  const total = indicators.length;
  let critical = 0, warning = 0, success = 0, excellent = 0;
  let totalCompliance = 0;

  indicators.forEach(indicator => {
    const status = calculateIndicatorStatus(indicator);
    const compliance = indicator.cumplimiento || 0;
    totalCompliance += compliance * 100;

    switch (status) {
      case 'critical': critical++; break;
      case 'warning': warning++; break;
      case 'success': success++; break;
      case 'excellent': excellent++; break;
    }
  });

  return {
    total,
    critical,
    warning,
    success,
    excellent,
    averageCompliance: total > 0 ? Math.round(totalCompliance / total) : 0
  };
}

function exportToCSV(data) {
  const headers = ['Indicador', 'Área', 'Unidad', 'Escenario', 'Meta Objetivo', 'Promedio Real', 'Cumplimiento %', 'Estado'];
  const rows = data.map(ind => {
    const metaObjetivo = ind.meta_objetivo ?? Number(ind.meta_anual ?? 0);
    const promedioReal = ind.promedio_real ?? ind.valor_real ?? 0;

    const formatNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num.toFixed(2) : '';
    };

    return [
      ind.nombre || '',
      ind.area_nombre || '',
      ind.unidad_medida || '',
      ind.escenario_seleccionado === 'meta_anual' ? 'Meta anual del indicador' : ind.escenario_seleccionado || '',
      formatNumber(metaObjetivo),
      formatNumber(promedioReal),
      ((ind.cumplimiento || 0) * 100).toFixed(2),
      calculateIndicatorStatus(ind)
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `indicadores_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
// ═══════════════════════════════════════════════════════════════════
// HOOK PERSONALIZADO PARA CARGAR DATOS REALES
// ═══════════════════════════════════════════════════════════════════

function useIndicatorsData() {
  const [indicators, setIndicators] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // 1. Cargar indicadores
      const { data: indicatorsData, error: indError } = await supabase
        .from('indicadores')
        .select('id, nombre, descripcion, area_id, clave, unidad_medida, frecuencia, meta_anual, estado');

      if (indError) throw indError;

      // 2. Cargar áreas
      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('id, clave, nombre');

      if (areasError) throw areasError;

      // 3. Cargar mediciones del año actual
      const currentYear = new Date().getFullYear();
      const { data: measurementsData, error: measError } = await supabase
        .from('mediciones')
        .select('indicador_id, anio, mes, valor')
        .eq('anio', currentYear)
        .order('mes', { ascending: true });

      if (measError) throw measError;

      // 4. Cargar metas del año actual
      const { data: metasData, error: metasError } = await supabase
        .from('indicador_metas')
        .select('indicador_id, anio, mes, escenario, valor')
        .eq('anio', currentYear);

      if (metasError) throw metasError;

      // 5. Enriquecer indicadores con datos relacionados
      const availableScenarios = new Set();
      const enrichedIndicators = indicatorsData.map(ind => {
        // Encontrar área
        const area = areasData.find(a => a.id === ind.area_id);

        // Encontrar mediciones del indicador
        const indMeasurements = measurementsData.filter(m => m.indicador_id === ind.id);

        // Encontrar metas del indicador
        const indMetas = metasData.filter(m => m.indicador_id === ind.id);

        const metasPorEscenario = indMetas.reduce((acc, meta) => {
          const escenario = meta.escenario?.trim();
          if (!escenario) return acc;

          availableScenarios.add(escenario);

          if (!acc[escenario]) {
            acc[escenario] = { total: 0, count: 0 };
          }

          acc[escenario].total += Number(meta.valor) || 0;
          acc[escenario].count += 1;
          return acc;
        }, {});

        const metasPromedioPorEscenario = Object.entries(metasPorEscenario).reduce((acc, [escenario, info]) => {
          acc[escenario] = info.count > 0 ? info.total / info.count : 0;
          return acc;
        }, {});

        // Calcular promedio de valores reales
        const avgReal = indMeasurements.length > 0
          ? indMeasurements.reduce((sum, m) => sum + (Number(m.valor) || 0), 0) / indMeasurements.length
          : 0;

        return {
          ...ind,
          area_nombre: area?.nombre || 'Sin área',
          area_clave: area?.clave || 'N/A',
          valor_real: avgReal,
          promedio_real: avgReal,
          mediciones: indMeasurements,
          metas: indMetas,
          metas_por_escenario: metasPromedioPorEscenario
        };
      });

      setIndicators(enrichedIndicators);
      setScenarios(Array.from(availableScenarios).sort((a, b) => a.localeCompare(b, 'es-MX', { sensitivity: 'base' })));

    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { indicators, scenarios, loading, error, reload: loadData };
}
// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function AdvancedVisualization() {
  const { indicators, scenarios, loading, error, reload } = useIndicatorsData();

  const [currentView, setCurrentView] = useState(CONFIG.VIEW_TYPES.EXECUTIVE);
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedScenario, setSelectedScenario] = useState('meta_anual');

  useEffect(() => {
    if (selectedScenario !== 'meta_anual' && !scenarios.includes(selectedScenario)) {
      setSelectedScenario('meta_anual');
    }
  }, [scenarios, selectedScenario]);

  const scenarioAdjustedIndicators = useMemo(() => {
    return indicators.map(ind => {
      const promedioReal = ind.promedio_real ?? ind.valor_real ?? 0;

      let metaObjetivo = Number(ind.meta_anual) || 0;
      if (selectedScenario !== 'meta_anual') {
        const metaEscenario = ind.metas_por_escenario?.[selectedScenario];
        if (metaEscenario !== undefined) {
          metaObjetivo = Number(metaEscenario) || 0;
        }
      }

      const cumplimiento = metaObjetivo > 0 ? promedioReal / metaObjetivo : 0;

      return {
        ...ind,
        meta_objetivo: metaObjetivo,
        promedio_real: promedioReal,
        cumplimiento,
        escenario_seleccionado: selectedScenario
      };
    });
  }, [indicators, selectedScenario]);

  // Filtrar datos
  const filteredData = useMemo(() => {
    let filtered = [...scenarioAdjustedIndicators];

    if (selectedArea !== 'all') {
      filtered = filtered.filter(ind => String(ind.area_id) === selectedArea);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(ind => {
        const categoria = (ind.categoria || '').toLowerCase();
        const nombre = (ind.nombre || '').toLowerCase();
        return categoria.includes(selectedType) || nombre.includes(selectedType);
      });
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(ind => calculateIndicatorStatus(ind) === selectedStatus);
    }

    return filtered;
  }, [scenarioAdjustedIndicators, selectedArea, selectedType, selectedStatus]);

  // Calcular métricas
  const metrics = useMemo(() => calculateMetrics(filteredData), [filteredData]);

  // Extraer áreas únicas
  const areas = useMemo(() => {
    const areasMap = new Map([['all', 'Todas las áreas']]);
    indicators.forEach(ind => {
      const id = String(ind.area_id || 'sin-area');
      const name = ind.area_nombre || 'Sin área';
      if (!areasMap.has(id)) areasMap.set(id, name);
    });
    return Array.from(areasMap.entries());
  }, [indicators]);

  // ESTADO DE CARGA
  if (loading) {
    return h('div', { className: 'flex h-screen items-center justify-center' },
      h('div', { className: 'text-center' },
        h('div', { className: 'inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600' }),
        h('p', { className: 'mt-4 text-sm text-slate-500' }, 'Cargando indicadores...')
      )
    );
  }

  // ESTADO DE ERROR
  if (error) {
    return h('div', { className: 'rounded-2xl border border-red-200 bg-red-50 p-8 text-center' },
      h('i', { className: 'fa-solid fa-triangle-exclamation text-4xl text-red-500' }),
      h('h3', { className: 'mt-4 text-lg font-semibold text-red-900' }, 'Error al cargar datos'),
      h('p', { className: 'mt-2 text-sm text-red-600' }, error),
      h('button', {
        onClick: reload,
        className: 'mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700'
      }, 'Reintentar')
    );
  }

  // VISTA PRINCIPAL
  return h('div', { className: 'space-y-6' },
    // Header
    h(Header, { onExport: () => exportToCSV(filteredData), onRefresh: reload }),
    
    // Filtros
    h(Filters, {
      areas,
      selectedArea,
      setSelectedArea,
      selectedType,
      setSelectedType,
      selectedStatus,
      setSelectedStatus,
      scenarios,
      selectedScenario,
      setSelectedScenario
    }),
    
    // Selector de Vistas
    h(ViewSelector, { currentView, onViewChange: setCurrentView }),
    
    // Métricas Rápidas
    h(QuickMetrics, { metrics }),
    
    // Contenido de la Vista Actual
    h(ViewRenderer, { currentView, data: filteredData, selectedScenario })
  );
}
// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: HEADER
// ═══════════════════════════════════════════════════════════════════

function Header({ onExport, onRefresh }) {
  return h('div', { className: 'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between' },
    h('div', null,
      h('h1', { className: 'text-3xl font-bold text-slate-900' }, 
        'Visualización Avanzada de Indicadores'
      ),
      h('p', { className: 'mt-1 text-sm text-slate-500' },
        'Sistema integral de análisis y monitoreo de indicadores estratégicos'
      )
    ),
    h('div', { className: 'flex items-center gap-2' },
      h('button', {
        onClick: onExport,
        className: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50'
      },
        h('i', { className: 'fa-solid fa-download' }),
        h('span', { className: 'hidden sm:inline' }, 'Exportar')
      ),
      h('button', {
        onClick: onRefresh,
        className: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50'
      },
        h('i', { className: 'fa-solid fa-arrows-rotate' }),
        h('span', { className: 'hidden sm:inline' }, 'Actualizar')
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: FILTROS
// ═══════════════════════════════════════════════════════════════════

function Filters({
  areas,
  selectedArea,
  setSelectedArea,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  scenarios,
  selectedScenario,
  setSelectedScenario
}) {
  return h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
    h('div', { className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' },
      
      // Filtro: Área
      h('div', { className: 'flex flex-col gap-2' },
        h('label', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-500' },
          h('i', { className: 'fa-solid fa-building mr-1' }),
          'Área'
        ),
        h('select', {
          value: selectedArea,
          onChange: (e) => setSelectedArea(e.target.value),
          className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        },
          areas.map(([id, name]) => h('option', { key: id, value: id }, name))
        )
      ),

      // Filtro: Tipo
      h('div', { className: 'flex flex-col gap-2' },
        h('label', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-500' },
          h('i', { className: 'fa-solid fa-filter mr-1' }),
          'Tipo'
        ),
        h('select', {
          value: selectedType,
          onChange: (e) => setSelectedType(e.target.value),
          className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        },
          h('option', { value: 'all' }, 'Todos los tipos'),
          h('option', { value: 'operativos' }, 'Operativos'),
          h('option', { value: 'fbo' }, 'FBO'),
          h('option', { value: 'financieros' }, 'Financieros')
        )
      ),

      // Filtro: Estado
      h('div', { className: 'flex flex-col gap-2' },
        h('label', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-500' },
          h('i', { className: 'fa-solid fa-signal mr-1' }),
          'Estado'
        ),
        h('select', {
          value: selectedStatus,
          onChange: (e) => setSelectedStatus(e.target.value),
          className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        },
          h('option', { value: 'all' }, 'Todos'),
          h('option', { value: 'critical' }, 'Críticos'),
          h('option', { value: 'warning' }, 'En advertencia'),
          h('option', { value: 'success' }, 'En meta'),
          h('option', { value: 'excellent' }, 'Sobresalientes')
        )
      ),

      // Filtro: Escenario de metas
      h('div', { className: 'flex flex-col gap-2' },
        h('label', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-500' },
          h('i', { className: 'fa-solid fa-bullseye mr-1' }),
          'Escenario de meta'
        ),
        h('select', {
          value: selectedScenario,
          onChange: (e) => setSelectedScenario(e.target.value),
          className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        },
          h('option', { value: 'meta_anual' }, 'Meta anual del indicador'),
          scenarios.length === 0
            ? null
            : scenarios.map(escenario => h('option', { key: escenario, value: escenario }, escenario))
        )
      )
    )
  );
}
// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: SELECTOR DE VISTAS
// ═══════════════════════════════════════════════════════════════════

function ViewSelector({ currentView, onViewChange }) {
  const views = [
    {
      id: CONFIG.VIEW_TYPES.EXECUTIVE,
      label: 'Resumen Ejecutivo',
      icon: 'fa-chart-line',
      description: 'KPIs principales'
    },
    {
      id: CONFIG.VIEW_TYPES.COMPARATIVE,
      label: 'Comparativa',
      icon: 'fa-chart-column',
      description: 'Comparación'
    },
    {
      id: CONFIG.VIEW_TYPES.TEMPORAL,
      label: 'Temporal',
      icon: 'fa-chart-area',
      description: 'Evolución'
    },
    {
      id: CONFIG.VIEW_TYPES.HEATMAP,
      label: 'Mapa de Calor',
      icon: 'fa-table-cells',
      description: 'Estado general'
    },
    {
      id: CONFIG.VIEW_TYPES.TABLE,
      label: 'Tabla',
      icon: 'fa-table',
      description: 'Datos completos'
    }
  ];

  return h('div', { className: 'overflow-x-auto' },
    h('div', { className: 'flex gap-2 pb-2' },
      views.map(view => 
        h('button', {
          key: view.id,
          onClick: () => onViewChange(view.id),
          className: `flex min-w-[160px] flex-col gap-1 rounded-xl border-2 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50 ${
            currentView === view.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-slate-200 bg-white'
          }`
        },
          h('div', { className: 'flex items-center gap-2' },
            h('i', {
              className: `fa-solid ${view.icon} text-lg ${
                currentView === view.id ? 'text-primary-600' : 'text-slate-400'
              }`
            }),
            h('span', { className: 'font-semibold text-slate-900' }, view.label)
          ),
          h('span', { className: 'text-xs text-slate-500' }, view.description)
        )
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MÉTRICAS RÁPIDAS
// ═══════════════════════════════════════════════════════════════════

function QuickMetrics({ metrics }) {
  return h('div', { className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' },
    
    // Total de indicadores
    h('div', { className: 'rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg' },
      h('div', { className: 'flex items-center justify-between' },
        h('div', null,
          h('p', { className: 'text-sm font-medium text-blue-100' }, 'Total Indicadores'),
          h('p', { className: 'mt-2 text-3xl font-bold' }, metrics.total)
        ),
        h('div', { className: 'rounded-full bg-white/20 p-3' },
          h('i', { className: 'fa-solid fa-chart-line text-2xl' })
        )
      )
    ),

    // Indicadores críticos
    h('div', { className: 'rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg' },
      h('div', { className: 'flex items-center justify-between' },
        h('div', null,
          h('p', { className: 'text-sm font-medium text-red-100' }, 'Críticos'),
          h('p', { className: 'mt-2 text-3xl font-bold' }, metrics.critical)
        ),
        h('div', { className: 'rounded-full bg-white/20 p-3' },
          h('i', { className: 'fa-solid fa-circle-exclamation text-2xl' })
        )
      )
    ),

    // Indicadores en meta
    h('div', { className: 'rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg' },
      h('div', { className: 'flex items-center justify-between' },
        h('div', null,
          h('p', { className: 'text-sm font-medium text-green-100' }, 'En Meta'),
          h('p', { className: 'mt-2 text-3xl font-bold' }, metrics.success)
        ),
        h('div', { className: 'rounded-full bg-white/20 p-3' },
          h('i', { className: 'fa-solid fa-circle-check text-2xl' })
        )
      )
    ),

    // Cumplimiento promedio
    h('div', { className: 'rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg' },
      h('div', { className: 'flex items-center justify-between' },
        h('div', null,
          h('p', { className: 'text-sm font-medium text-purple-100' }, 'Cumplimiento Prom.'),
          h('p', { className: 'mt-2 text-3xl font-bold' }, `${metrics.averageCompliance}%`)
        ),
        h('div', { className: 'rounded-full bg-white/20 p-3' },
          h('i', { className: 'fa-solid fa-percent text-2xl' })
        )
      )
    )
  );
}
// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: ROUTER DE VISTAS
// ═══════════════════════════════════════════════════════════════════

function ViewRenderer({ currentView, data, selectedScenario }) {
  if (!data || data.length === 0) {
    return h('div', { className: 'rounded-2xl bg-white p-12 text-center shadow-sm' },
      h('i', { className: 'fa-solid fa-inbox text-5xl text-slate-300' }),
      h('p', { className: 'mt-4 text-slate-500' }, 'No hay indicadores que mostrar con los filtros aplicados')
    );
  }

  switch (currentView) {
    case CONFIG.VIEW_TYPES.EXECUTIVE:
      return h(ExecutiveView, { data });
    case CONFIG.VIEW_TYPES.COMPARATIVE:
      return h(ComparativeView, { data });
    case CONFIG.VIEW_TYPES.TEMPORAL:
      return h(TemporalView, { data });
    case CONFIG.VIEW_TYPES.HEATMAP:
      return h(HeatmapView, { data });
    case CONFIG.VIEW_TYPES.TABLE:
      return h(TableView, { data, selectedScenario });
    default:
      return h('div', { className: 'rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm' },
        'Vista no reconocida'
      );
  }
}

// ═══════════════════════════════════════════════════════════════════
// VISTA EJECUTIVA
// ═══════════════════════════════════════════════════════════════════

function ExecutiveView({ data }) {
  // Agrupar por estado
  const byStatus = {
    critical: data.filter(ind => calculateIndicatorStatus(ind) === 'critical'),
    warning: data.filter(ind => calculateIndicatorStatus(ind) === 'warning'),
    success: data.filter(ind => calculateIndicatorStatus(ind) === 'success'),
    excellent: data.filter(ind => calculateIndicatorStatus(ind) === 'excellent')
  };

  // Top 5 y Bottom 5
  const sorted = [...data].sort((a, b) => (b.cumplimiento || 0) - (a.cumplimiento || 0));
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return h('div', { className: 'space-y-6' },
    
    // Distribución por estado
    h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
      h('h3', { className: 'mb-4 text-lg font-semibold text-slate-900' },
        h('i', { className: 'fa-solid fa-chart-pie mr-2 text-primary-600' }),
        'Distribución por Estado'
      ),
      h('div', { className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' },
        h(StatusCard, { label: 'Críticos', count: byStatus.critical.length, type: 'critical' }),
        h(StatusCard, { label: 'Advertencia', count: byStatus.warning.length, type: 'warning' }),
        h(StatusCard, { label: 'En Meta', count: byStatus.success.length, type: 'success' }),
        h(StatusCard, { label: 'Sobresalientes', count: byStatus.excellent.length, type: 'excellent' })
      )
    ),

    // Top y Bottom performers
    h('div', { className: 'grid gap-6 lg:grid-cols-2' },
      
      // Top 5
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
        h('h3', { className: 'mb-4 text-lg font-semibold text-slate-900' },
          h('i', { className: 'fa-solid fa-trophy mr-2 text-yellow-500' }),
          'Top 5 Indicadores'
        ),
        h('div', { className: 'space-y-3' },
          top5.map((ind, idx) => h(IndicatorRankCard, { key: ind.id, indicator: ind, rank: idx + 1, type: 'top' }))
        )
      ),

      // Bottom 5
      h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
        h('h3', { className: 'mb-4 text-lg font-semibold text-slate-900' },
          h('i', { className: 'fa-solid fa-triangle-exclamation mr-2 text-red-500' }),
          'Indicadores Críticos'
        ),
        h('div', { className: 'space-y-3' },
          bottom5.map((ind, idx) => h(IndicatorRankCard, { key: ind.id, indicator: ind, rank: idx + 1, type: 'bottom' }))
        )
      )
    )
  );
}

// Componente: Tarjeta de Estado
function StatusCard({ label, count, type }) {
  const colors = {
    critical: 'from-red-500 to-red-600',
    warning: 'from-orange-500 to-orange-600',
    success: 'from-green-500 to-green-600',
    excellent: 'from-blue-500 to-blue-600'
  };

  return h('div', { className: `rounded-xl bg-gradient-to-br ${colors[type]} p-4 text-white` },
    h('p', { className: 'text-sm font-medium opacity-90' }, label),
    h('p', { className: 'mt-2 text-3xl font-bold' }, count)
  );
}

// Componente: Tarjeta de Ranking
function IndicatorRankCard({ indicator, rank, type }) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const colorClass = type === 'top' ? 'text-green-600' : 'text-red-600';

  return h('div', { className: 'flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3' },
    h('span', { className: 'flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700' },
      rank
    ),
    h('div', { className: 'min-w-0 flex-1' },
      h('p', { className: 'truncate text-sm font-medium text-slate-900' },
        indicator.nombre || 'Sin nombre'
      ),
      h('p', { className: 'text-xs text-slate-500' },
        indicator.area_nombre || 'Sin área'
      )
    ),
    h('span', { className: `text-lg font-bold ${colorClass}` }, `${compliance}%`)
  );
}
// ═══════════════════════════════════════════════════════════════════
// VISTA COMPARATIVA
// ═══════════════════════════════════════════════════════════════════

function ComparativeView({ data }) {
  const limitedData = data.slice(0, 10);

  return h('div', { className: 'space-y-6' },
    h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
      h('div', { className: 'mb-4 flex items-center justify-between' },
        h('h3', { className: 'text-lg font-semibold text-slate-900' },
          h('i', { className: 'fa-solid fa-chart-column mr-2 text-primary-600' }),
          'Comparativa de Cumplimiento'
        ),
        h('span', { className: 'text-xs text-slate-500' }, `Mostrando ${limitedData.length} indicadores`)
      ),
      h('div', { className: 'overflow-x-auto' },
        h('table', { className: 'min-w-full divide-y divide-slate-200' },
          h('thead', { className: 'bg-slate-50' },
            h('tr', null,
              h('th', { className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Indicador'),
              h('th', { className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Área'),
              h('th', { className: 'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Cumplimiento'),
              h('th', { className: 'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Estado')
            )
          ),
          h('tbody', { className: 'divide-y divide-slate-200 bg-white' },
            limitedData.map(ind => h(ComparativeTableRow, { key: ind.id, indicator: ind }))
          )
        )
      )
    )
  );
}

function ComparativeTableRow({ indicator }) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  
  const statusConfig = {
    critical: { label: 'Crítico', class: 'bg-red-100 text-red-800' },
    warning: { label: 'Advertencia', class: 'bg-orange-100 text-orange-800' },
    success: { label: 'En Meta', class: 'bg-green-100 text-green-800' },
    excellent: { label: 'Sobresaliente', class: 'bg-blue-100 text-blue-800' }
  };

  const config = statusConfig[status] || statusConfig.warning;

  return h('tr', { className: 'hover:bg-slate-50' },
    h('td', { className: 'px-4 py-3 text-sm text-slate-900' }, indicator.nombre || 'Sin nombre'),
    h('td', { className: 'px-4 py-3 text-sm text-slate-600' }, indicator.area_nombre || 'Sin área'),
    h('td', { className: 'px-4 py-3 text-center' },
      h('span', { className: 'text-sm font-semibold text-slate-900' }, `${compliance}%`)
    ),
    h('td', { className: 'px-4 py-3 text-center' },
      h('span', { className: `inline-flex rounded-full px-3 py-1 text-xs font-medium ${config.class}` },
        config.label
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISTA TEMPORAL
// ═══════════════════════════════════════════════════════════════════

function TemporalView({ data }) {
  const [selectedId, setSelectedId] = useState(() =>
    data[0] ? String(data[0].id) : ''
  );

  useEffect(() => {
    if (!data || data.length === 0) return;
    const exists = data.some(ind => String(ind.id) === selectedId);
    if (!exists) {
      setSelectedId(String(data[0].id));
    }
  }, [data, selectedId]);

  const selectedIndicator = data.find(ind => String(ind.id) === selectedId) || data[0];
  const measurements = selectedIndicator?.mediciones || [];

  return h('div', { className: 'space-y-6' },
    h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
      h('label', { className: 'flex flex-col gap-2' },
        h('span', { className: 'text-sm font-semibold text-slate-700' },
          h('i', { className: 'fa-solid fa-chart-line mr-2 text-primary-600' }),
          'Seleccionar Indicador'
        ),
        h('select', {
          value: selectedId,
          onChange: (e) => setSelectedId(e.target.value),
          className: 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        },
          data.map(ind =>
            h('option', { key: ind.id, value: String(ind.id) }, ind.nombre || 'Sin nombre')
          )
        )
      )
    ),

    h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
      h('h3', { className: 'mb-4 text-lg font-semibold text-slate-900' },
        h('i', { className: 'fa-solid fa-chart-area mr-2 text-primary-600' }),
        'Mediciones del Año Actual'
      ),
      measurements.length > 0
        ? h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'min-w-full divide-y divide-slate-200' },
              h('thead', { className: 'bg-slate-50' },
                h('tr', null,
                  h('th', { className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Mes'),
                  h('th', { className: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Valor')
                )
              ),
              h('tbody', { className: 'divide-y divide-slate-200 bg-white' },
                measurements.map((m, idx) => h('tr', { key: idx, className: 'hover:bg-slate-50' },
                  h('td', { className: 'px-4 py-3 text-sm text-slate-900' }, `Mes ${m.mes}`),
                  h('td', { className: 'px-4 py-3 text-right text-sm font-semibold text-slate-900' }, 
                    (m.valor || 0).toLocaleString('es-MX')
                  )
                ))
              )
            )
          )
        : h('p', { className: 'py-8 text-center text-slate-500' }, 'No hay mediciones registradas para este indicador')
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISTA MAPA DE CALOR
// ═══════════════════════════════════════════════════════════════════

function HeatmapView({ data }) {
  const byArea = data.reduce((acc, ind) => {
    const area = ind.area_nombre || 'Sin área';
    if (!acc[area]) acc[area] = [];
    acc[area].push(ind);
    return acc;
  }, {});

  return h('div', { className: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
    h('div', { className: 'mb-6' },
      h('h3', { className: 'text-lg font-semibold text-slate-900' },
        h('i', { className: 'fa-solid fa-table-cells mr-2 text-primary-600' }),
        'Mapa de Calor - Estado de Indicadores'
      ),
      h('p', { className: 'mt-1 text-sm text-slate-500' }, 'Vista general del cumplimiento por área')
    ),

    h('div', { className: 'mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-4' },
      h('span', { className: 'text-sm font-medium text-slate-700' }, 'Leyenda:'),
      h(HeatmapLegend, { label: 'Crítico', color: '#EF4444' }),
      h(HeatmapLegend, { label: 'Advertencia', color: '#F59E0B' }),
      h(HeatmapLegend, { label: 'En Meta', color: '#10B981' }),
      h(HeatmapLegend, { label: 'Sobresaliente', color: '#3B82F6' })
    ),

    h('div', { className: 'space-y-6' },
      Object.entries(byArea).map(([area, indicators]) =>
        h('div', { key: area, className: 'space-y-3' },
          h('h4', { className: 'font-semibold text-slate-900' }, area),
          h('div', { className: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' },
            indicators.map(ind => h(HeatmapCell, { key: ind.id, indicator: ind }))
          )
        )
      )
    )
  );
}

function HeatmapLegend({ label, color }) {
  return h('div', { className: 'flex items-center gap-2' },
    h('div', { className: 'h-4 w-4 rounded', style: { backgroundColor: color } }),
    h('span', { className: 'text-xs text-slate-600' }, label)
  );
}

function HeatmapCell({ indicator }) {
  const status = calculateIndicatorStatus(indicator);
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  
  const colorMap = {
    critical: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    excellent: '#3B82F6'
  };

  const bgColor = colorMap[status];

  return h('div', {
    className: 'group relative cursor-pointer rounded-lg border-2 border-slate-200 p-3 transition hover:border-slate-400 hover:shadow-md',
    style: { backgroundColor: `${bgColor}20` },
    title: `${indicator.nombre || 'Sin nombre'} - ${compliance}%`
  },
    h('div', { className: 'flex items-center justify-between gap-2' },
      h('p', { className: 'flex-1 truncate text-sm font-medium text-slate-900' },
        (indicator.nombre || 'Sin nombre').substring(0, 30)
      ),
      h('span', { className: 'text-xs font-bold text-slate-700' }, `${compliance}%`)
    ),
    h('div', { className: 'mt-2 h-2 w-full overflow-hidden rounded-full bg-white/50' },
      h('div', {
        className: 'h-full rounded-full transition-all',
        style: { width: `${compliance}%`, backgroundColor: bgColor }
      })
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISTA DE TABLA
// ═══════════════════════════════════════════════════════════════════

function TableView({ data, selectedScenario }) {
  const scenarioLabel = selectedScenario === 'meta_anual'
    ? 'Comparando contra: Meta anual del indicador'
    : `Comparando contra: ${selectedScenario}`;

  return h('div', { className: 'rounded-2xl border border-slate-200 bg-white shadow-sm' },
    h('div', { className: 'border-b border-slate-200 p-6' },
      h('div', { className: 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' },
        h('div', null,
          h('h3', { className: 'text-lg font-semibold text-slate-900' },
            h('i', { className: 'fa-solid fa-table mr-2 text-primary-600' }),
            'Tabla Detallada de Indicadores'
          ),
          h('p', { className: 'mt-1 text-sm text-slate-500' },
            `${data.length} indicador${data.length !== 1 ? 'es' : ''} encontrado${data.length !== 1 ? 's' : ''}`
          ),
          h('div', { className: 'mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600' },
            h('i', { className: 'fa-solid fa-bullseye text-slate-500' }),
            scenarioLabel
          )
        ),
        h('button', {
          onClick: () => exportToCSV(data),
          className: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50'
        },
          h('i', { className: 'fa-solid fa-file-excel' }),
          'Exportar'
        )
      )
    ),

    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full divide-y divide-slate-200' },
        h('thead', { className: 'bg-slate-50' },
          h('tr', null,
            h('th', { className: 'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Indicador'),
            h('th', { className: 'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Área'),
            h('th', { className: 'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Unidad'),
            h('th', { className: 'px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Meta objetivo'),
            h('th', { className: 'px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Promedio real'),
            h('th', { className: 'px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Cumplimiento'),
            h('th', { className: 'px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Estado')
          )
        ),
        h('tbody', { className: 'divide-y divide-slate-200 bg-white' },
          data.map(ind => h(DetailedTableRow, { key: ind.id, indicator: ind }))
        )
      )
    ),

    h('div', { className: 'border-t border-slate-200 px-6 py-4' },
      h('div', { className: 'flex items-center justify-between text-sm text-slate-600' },
        h('span', null, `Mostrando ${data.length} indicadores`),
        h('span', null, `Última actualización: ${new Date().toLocaleDateString('es-MX')}`)
      )
    )
  );
}

function DetailedTableRow({ indicator }) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  
  const statusConfig = {
    critical: { label: 'Crítico', class: 'bg-red-100 text-red-800', icon: 'fa-circle-exclamation' },
    warning: { label: 'Advertencia', class: 'bg-orange-100 text-orange-800', icon: 'fa-triangle-exclamation' },
    success: { label: 'En Meta', class: 'bg-green-100 text-green-800', icon: 'fa-circle-check' },
    excellent: { label: 'Sobresaliente', class: 'bg-blue-100 text-blue-800', icon: 'fa-star' }
  };

  const config = statusConfig[status] || statusConfig.warning;

  const metaObjetivoRaw = indicator.meta_objetivo ?? indicator.meta_anual;
  const promedioRealRaw = indicator.promedio_real ?? indicator.valor_real;

  const formatNumber = (value) => Number.isFinite(value) ? value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) : '-';

  const metaObjetivoDisplay = formatNumber(Number(metaObjetivoRaw));
  const promedioRealDisplay = formatNumber(Number(promedioRealRaw));

  return h('tr', { className: 'transition hover:bg-slate-50' },
    h('td', { className: 'px-6 py-4 text-sm font-medium text-slate-900' }, indicator.nombre || 'Sin nombre'),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-sm text-slate-600' }, indicator.area_nombre || 'Sin área'),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-sm text-slate-600' }, indicator.unidad_medida || '-'),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600' }, metaObjetivoDisplay),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600' }, promedioRealDisplay),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-center' },
      h('span', { className: 'text-sm font-bold text-slate-900' }, `${compliance}%`)
    ),
    h('td', { className: 'whitespace-nowrap px-6 py-4 text-center' },
      h('span', { className: `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${config.class}` },
        h('i', { className: `fa-solid ${config.icon}` }),
        config.label
      )
    )
  );
}

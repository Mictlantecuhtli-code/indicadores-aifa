import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

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
  },
  PERIODS: {
    CURRENT_MONTH: 'current_month',
    CURRENT_QUARTER: 'current_quarter',
    CURRENT_YEAR: 'current_year',
    LAST_6_MONTHS: 'last_6_months',
    LAST_12_MONTHS: 'last_12_months',
    CUSTOM: 'custom'
  },
  ALERT_LEVELS: {
    CRITICAL: { threshold: 0.7, color: '#EF4444' },
    WARNING: { threshold: 0.85, color: '#F59E0B' },
    SUCCESS: { threshold: 1.0, color: '#10B981' },
    EXCELLENT: { threshold: 1.15, color: '#3B82F6' }
  }
};

// ═══════════════════════════════════════════════════════════════════
// HOOK PERSONALIZADO PARA DATOS
// ═══════════════════════════════════════════════════════════════════

function useIndicators() {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadIndicators();
  }, []);

  async function loadIndicators() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('indicadores')
        .select(`
          *,
          areas:area_id(id, nombre)
        `);

      if (error) throw error;

      const normalized = data.map(ind => ({
        ...ind,
        area_nombre: ind.areas?.nombre || 'Sin área',
        area_id: ind.area_id || ind.areas?.id
      }));

      setIndicators(normalized);
    } catch (err) {
      console.error('Error cargando indicadores:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { indicators, loading, error, reload: loadIndicators };
}

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════

function calculateIndicatorStatus(indicator) {
  const cumplimiento = indicator.cumplimiento || indicator.porcentaje_cumplimiento || 0;
  if (cumplimiento >= 1.15) return 'excellent';
  if (cumplimiento >= 1.0) return 'success';
  if (cumplimiento >= 0.85) return 'warning';
  return 'critical';
}

function calculateMetrics(indicators) {
  const total = indicators.length;
  let critical = 0, warning = 0, success = 0, excellent = 0, totalCompliance = 0;

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
  const headers = ['ID', 'Nombre', 'Área', 'Unidad', 'Frecuencia', 'Estado', 'Cumplimiento %'];
  const rows = data.map(ind => [
    ind.id || '',
    ind.nombre || '',
    ind.area_nombre || '',
    ind.unidad_medida || '',
    ind.frecuencia || '',
    calculateIndicatorStatus(ind),
    ((ind.cumplimiento || 0) * 100).toFixed(2)
  ]);

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
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function AdvancedVisualization() {
  const { indicators, loading, error, reload } = useIndicators();
  
  const [currentView, setCurrentView] = useState(CONFIG.VIEW_TYPES.EXECUTIVE);
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(CONFIG.PERIODS.CURRENT_YEAR);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Filtrar datos
  const filteredData = useMemo(() => {
    let filtered = [...indicators];

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
  }, [indicators, selectedArea, selectedType, selectedStatus]);

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600"></div>
          <p className="mt-4 text-sm text-slate-500">Cargando indicadores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
        <h3 className="mt-4 text-lg font-semibold text-red-900">Error al cargar datos</h3>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          onClick={reload}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Header onExport={() => exportToCSV(filteredData)} onRefresh={reload} />

      {/* FILTROS */}
      <Filters
        areas={areas}
        selectedArea={selectedArea}
        setSelectedArea={setSelectedArea}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        showCustomDate={showCustomDate}
        setShowCustomDate={setShowCustomDate}
      />

      {/* SELECTOR DE VISTAS */}
      <ViewSelector currentView={currentView} onViewChange={setCurrentView} />

      {/* MÉTRICAS */}
      <QuickMetrics metrics={metrics} />

      {/* VISTA ACTUAL */}
      <ViewRenderer
        currentView={currentView}
        data={filteredData}
        allIndicators={indicators}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: HEADER
// ═══════════════════════════════════════════════════════════════════

function Header({ onExport, onRefresh }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Visualización Avanzada de Indicadores
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sistema integral de análisis y monitoreo de indicadores estratégicos
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <i className="fa-solid fa-download"></i>
          <span className="hidden sm:inline">Exportar</span>
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <i className="fa-solid fa-arrows-rotate"></i>
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: FILTROS
// ═══════════════════════════════════════════════════════════════════

function Filters({
  areas,
  selectedArea,
  setSelectedArea,
  selectedPeriod,
  setSelectedPeriod,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  showCustomDate,
  setShowCustomDate
}) {
  const handlePeriodChange = (e) => {
    const value = e.target.value;
    setSelectedPeriod(value);
    setShowCustomDate(value === 'custom');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Filtro: Área */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i className="fa-solid fa-building mr-1"></i>
            Área
          </label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {areas.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Filtro: Periodo */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i className="fa-solid fa-calendar mr-1"></i>
            Periodo
          </label>
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="current_year">Año actual</option>
            <option value="current_quarter">Trimestre actual</option>
            <option value="current_month">Mes actual</option>
            <option value="last_12_months">Últimos 12 meses</option>
            <option value="last_6_months">Últimos 6 meses</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {/* Filtro: Tipo */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i className="fa-solid fa-filter mr-1"></i>
            Tipo
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">Todos los tipos</option>
            <option value="operativos">Operativos</option>
            <option value="fbo">FBO</option>
            <option value="financieros">Financieros</option>
          </select>
        </div>

        {/* Filtro: Estado */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i className="fa-solid fa-signal mr-1"></i>
            Estado
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">Todos</option>
            <option value="critical">Críticos</option>
            <option value="warning">En advertencia</option>
            <option value="success">En meta</option>
            <option value="excellent">Sobresalientes</option>
          </select>
        </div>
      </div>

      {/* Rango de fechas personalizado */}
      {showCustomDate && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fecha inicio
              </label>
              <input
                type="date"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fecha fin
              </label>
              <input
                type="date"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
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
      description: 'KPIs principales y tendencias'
    },
    {
      id: CONFIG.VIEW_TYPES.COMPARATIVE,
      label: 'Comparativa',
      icon: 'fa-chart-column',
      description: 'Comparación entre indicadores'
    },
    {
      id: CONFIG.VIEW_TYPES.TEMPORAL,
      label: 'Análisis Temporal',
      icon: 'fa-chart-area',
      description: 'Evolución histórica'
    },
    {
      id: CONFIG.VIEW_TYPES.HEATMAP,
      label: 'Mapa de Calor',
      icon: 'fa-table-cells',
      description: 'Estado general'
    },
    {
      id: CONFIG.VIEW_TYPES.TABLE,
      label: 'Tabla Detallada',
      icon: 'fa-table',
      description: 'Datos completos'
    }
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 pb-2">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`flex min-w-[180px] flex-col gap-1 rounded-xl border-2 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50 ${
              currentView === view.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <i
                className={`fa-solid ${view.icon} text-lg ${
                  currentView === view.id ? 'text-primary-600' : 'text-slate-400'
                }`}
              ></i>
              <span className="font-semibold text-slate-900">{view.label}</span>
            </div>
            <span className="text-xs text-slate-500">{view.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MÉTRICAS RÁPIDAS
// ═══════════════════════════════════════════════════════════════════

function QuickMetrics({ metrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      
      {/* Total de indicadores */}
      <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">Total Indicadores</p>
            <p className="mt-2 text-3xl font-bold">{metrics.total}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <i className="fa-solid fa-chart-line text-2xl"></i>
          </div>
        </div>
      </div>

      {/* Indicadores críticos */}
      <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-100">Críticos</p>
            <p className="mt-2 text-3xl font-bold">{metrics.critical}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <i className="fa-solid fa-circle-exclamation text-2xl"></i>
          </div>
        </div>
      </div>

      {/* Indicadores en meta */}
      <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-100">En Meta</p>
            <p className="mt-2 text-3xl font-bold">{metrics.success}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <i className="fa-solid fa-circle-check text-2xl"></i>
          </div>
        </div>
      </div>

      {/* Cumplimiento promedio */}
      <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-100">Cumplimiento Prom.</p>
            <p className="mt-2 text-3xl font-bold">{metrics.averageCompliance}%</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <i className="fa-solid fa-percent text-2xl"></i>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: RENDERIZADOR DE VISTAS
// ═══════════════════════════════════════════════════════════════════

function ViewRenderer({ currentView, data, allIndicators }) {
  switch (currentView) {
    case CONFIG.VIEW_TYPES.EXECUTIVE:
      return <ExecutiveView data={data} />;
    case CONFIG.VIEW_TYPES.COMPARATIVE:
      return <ComparativeView data={data} />;
    case CONFIG.VIEW_TYPES.TEMPORAL:
      return <TemporalView data={data} />;
    case CONFIG.VIEW_TYPES.HEATMAP:
      return <HeatmapView data={data} />;
    case CONFIG.VIEW_TYPES.TABLE:
      return <TableView data={data} />;
    default:
      return (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
          Vista no reconocida
        </div>
      );
  }
}

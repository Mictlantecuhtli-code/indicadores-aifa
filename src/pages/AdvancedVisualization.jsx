import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.js';

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
// ═══════════════════════════════════════════════════════════════════
// VISTA EJECUTIVA
// ═══════════════════════════════════════════════════════════════════

function ExecutiveView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <i className="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p className="mt-4 text-slate-500">No hay indicadores que mostrar</p>
      </div>
    );
  }

  // Agrupar por estado
  const byStatus = {
    critical: data.filter(ind => calculateIndicatorStatus(ind) === 'critical'),
    warning: data.filter(ind => calculateIndicatorStatus(ind) === 'warning'),
    success: data.filter(ind => calculateIndicatorStatus(ind) === 'success'),
    excellent: data.filter(ind => calculateIndicatorStatus(ind) === 'excellent')
  };

  // Top 5 mejores y peores
  const sorted = [...data].sort((a, b) => (b.cumplimiento || 0) - (a.cumplimiento || 0));
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return (
    <div className="space-y-6">
      
      {/* Distribución por estado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          <i className="fa-solid fa-chart-pie mr-2 text-primary-600"></i>
          Distribución por Estado
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard label="Críticos" count={byStatus.critical.length} type="critical" />
          <StatusCard label="Advertencia" count={byStatus.warning.length} type="warning" />
          <StatusCard label="En Meta" count={byStatus.success.length} type="success" />
          <StatusCard label="Sobresalientes" count={byStatus.excellent.length} type="excellent" />
        </div>
      </div>

      {/* Gráfica de distribución */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          <i className="fa-solid fa-chart-bar mr-2 text-primary-600"></i>
          Distribución de Cumplimiento
        </h3>
        <div className="h-80">
          <DistributionChart byStatus={byStatus} />
        </div>
      </div>

      {/* Top y Bottom performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Top 5 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            <i className="fa-solid fa-trophy mr-2 text-yellow-500"></i>
            Top 5 Indicadores
          </h3>
          <div className="space-y-3">
            {top5.map((ind, idx) => (
              <IndicatorRankCard key={ind.id} indicator={ind} rank={idx + 1} type="top" />
            ))}
          </div>
        </div>

        {/* Bottom 5 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500"></i>
            Indicadores Críticos
          </h3>
          <div className="space-y-3">
            {bottom5.map((ind, idx) => (
              <IndicatorRankCard key={ind.id} indicator={ind} rank={idx + 1} type="bottom" />
            ))}
          </div>
        </div>

      </div>

    </div>
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

  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[type]} p-4 text-white`}>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="mt-2 text-3xl font-bold">{count}</p>
    </div>
  );
}

// Componente: Tarjeta de Ranking
function IndicatorRankCard({ indicator, rank, type }) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const colorClass = type === 'top' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {indicator.nombre || 'Sin nombre'}
        </p>
        <p className="text-xs text-slate-500">{indicator.area_nombre || 'Sin área'}</p>
      </div>
      <span className={`text-lg font-bold ${colorClass}`}>{compliance}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISTA COMPARATIVA
// ═══════════════════════════════════════════════════════════════════

function ComparativeView({ data }) {
  const limitedData = data.slice(0, 10);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <i className="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p className="mt-4 text-slate-500">No hay indicadores que comparar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Gráfica comparativa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            <i className="fa-solid fa-chart-column mr-2 text-primary-600"></i>
            Comparativa de Cumplimiento
          </h3>
          <span className="text-xs text-slate-500">Mostrando {limitedData.length} indicadores</span>
        </div>
        <div className="h-96">
          <ComparativeBarChart data={limitedData} />
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          <i className="fa-solid fa-table mr-2 text-primary-600"></i>
          Detalles Comparativos
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Indicador
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Área
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Cumplimiento
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {limitedData.map(ind => (
                <ComparativeTableRow key={ind.id} indicator={ind} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// Componente: Fila de Tabla Comparativa
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

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm text-slate-900">
        {indicator.nombre || 'Sin nombre'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {indicator.area_nombre || 'Sin área'}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-semibold text-slate-900">{compliance}%</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${config.class}`}>
          {config.label}
        </span>
      </td>
    </tr>
  );
}
// ═══════════════════════════════════════════════════════════════════
// VISTA TEMPORAL
// ═══════════════════════════════════════════════════════════════════

function TemporalView({ data }) {
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(data[0]?.id || null);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <i className="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p className="mt-4 text-slate-500">No hay datos históricos disponibles</p>
      </div>
    );
  }

  const selectedIndicator = data.find(ind => ind.id === selectedIndicatorId) || data[0];
  const temporalData = generateTemporalData(selectedIndicator);

  return (
    <div className="space-y-6">
      
      {/* Selector de indicador */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-700">
            <i className="fa-solid fa-chart-line mr-2 text-primary-600"></i>
            Seleccionar Indicador
          </span>
          <select
            value={selectedIndicatorId}
            onChange={(e) => setSelectedIndicatorId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {data.map(ind => (
              <option key={ind.id} value={ind.id}>
                {ind.nombre || 'Sin nombre'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Gráfica temporal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          <i className="fa-solid fa-chart-area mr-2 text-primary-600"></i>
          Evolución Temporal
        </h3>
        <div className="h-96">
          <TemporalLineChart data={temporalData} />
        </div>
      </div>

      {/* Estadísticas temporales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TemporalStatCard label="Promedio" value="87.5%" icon="fa-calculator" color="blue" />
        <TemporalStatCard label="Máximo" value="95.2%" icon="fa-arrow-up" color="green" />
        <TemporalStatCard label="Mínimo" value="78.3%" icon="fa-arrow-down" color="red" />
        <TemporalStatCard label="Tendencia" value="+2.3%" icon="fa-chart-line" color="purple" />
      </div>

    </div>
  );
}

// Componente: Tarjeta de Estadística Temporal
function TemporalStatCard({ label, value, icon, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} p-4 text-white`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-90">
        <i className={`fa-solid ${icon}`}></i>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

// Función: Generar datos temporales simulados
function generateTemporalData(indicator) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const baseValue = (indicator.cumplimiento || 0.85) * 100;
  
  return months.map((month, idx) => {
    const variation = (Math.random() - 0.5) * 10;
    const value = Math.max(60, Math.min(120, baseValue + variation));
    return { label: month, value };
  });
}

// ═══════════════════════════════════════════════════════════════════
// VISTA MAPA DE CALOR
// ═══════════════════════════════════════════════════════════════════

function HeatmapView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <i className="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p className="mt-4 text-slate-500">No hay indicadores para visualizar</p>
      </div>
    );
  }

  // Agrupar por área
  const byArea = data.reduce((acc, ind) => {
    const area = ind.area_nombre || 'Sin área';
    if (!acc[area]) acc[area] = [];
    acc[area].push(ind);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">
          <i className="fa-solid fa-table-cells mr-2 text-primary-600"></i>
          Mapa de Calor - Estado de Indicadores
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Vista general del cumplimiento por área e indicador
        </p>
      </div>

      {/* Leyenda */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-4">
        <span className="text-sm font-medium text-slate-700">Leyenda:</span>
        <HeatmapLegendItem label="Crítico" color="#EF4444" />
        <HeatmapLegendItem label="Advertencia" color="#F59E0B" />
        <HeatmapLegendItem label="En Meta" color="#10B981" />
        <HeatmapLegendItem label="Sobresaliente" color="#3B82F6" />
      </div>

      {/* Mapa de calor */}
      <div className="space-y-6">
        {Object.entries(byArea).map(([area, indicators]) => (
          <HeatmapArea key={area} areaName={area} indicators={indicators} />
        ))}
      </div>
    </div>
  );
}

// Componente: Item de Leyenda
function HeatmapLegendItem({ label, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-4 rounded" style={{ backgroundColor: color }}></div>
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  );
}

// Componente: Área del Mapa de Calor
function HeatmapArea({ areaName, indicators }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-slate-900">{areaName}</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {indicators.map(ind => (
          <HeatmapCell key={ind.id} indicator={ind} />
        ))}
      </div>
    </div>
  );
}

// Componente: Celda del Mapa de Calor
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

  return (
    <div
      className="group relative cursor-pointer rounded-lg border-2 border-slate-200 p-3 transition hover:border-slate-400 hover:shadow-md"
      style={{ backgroundColor: `${bgColor}20` }}
      title={`${indicator.nombre || 'Sin nombre'} - ${compliance}%`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex-1 truncate text-sm font-medium text-slate-900">
          {(indicator.nombre || 'Sin nombre').substring(0, 30)}
        </p>
        <span className="text-xs font-bold text-slate-700">{compliance}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/50">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${compliance}%`, backgroundColor: bgColor }}
        ></div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// VISTA DE TABLA DETALLADA
// ═══════════════════════════════════════════════════════════════════

function TableView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <i className="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p className="mt-4 text-slate-500">No hay datos para mostrar en la tabla</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      
      {/* Header */}
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              <i className="fa-solid fa-table mr-2 text-primary-600"></i>
              Tabla Detallada de Indicadores
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {data.length} indicador{data.length !== 1 ? 'es' : ''} encontrado{data.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => exportToCSV(data)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i className="fa-solid fa-file-excel"></i>
            Exportar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Indicador
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Área
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Unidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Frecuencia
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Cumplimiento
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {data.map(ind => (
              <DetailedTableRow key={ind.id} indicator={ind} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Mostrando {data.length} indicadores</span>
          <span>Última actualización: {new Date().toLocaleDateString('es-MX')}</span>
        </div>
      </div>

    </div>
  );
}

// Componente: Fila de Tabla Detallada
function DetailedTableRow({ indicator }) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  
  const statusConfig = {
    critical: {
      label: 'Crítico',
      class: 'bg-red-100 text-red-800',
      icon: 'fa-circle-exclamation'
    },
    warning: {
      label: 'Advertencia',
      class: 'bg-orange-100 text-orange-800',
      icon: 'fa-triangle-exclamation'
    },
    success: {
      label: 'En Meta',
      class: 'bg-green-100 text-green-800',
      icon: 'fa-circle-check'
    },
    excellent: {
      label: 'Sobresaliente',
      class: 'bg-blue-100 text-blue-800',
      icon: 'fa-star'
    }
  };

  const config = statusConfig[status] || statusConfig.warning;

  return (
    <tr className="transition hover:bg-slate-50">
      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
        #{indicator.id || '-'}
      </td>
      <td className="px-6 py-4 text-sm text-slate-900">
        <div className="max-w-xs">
          <p className="font-medium">{indicator.nombre || 'Sin nombre'}</p>
          {indicator.descripcion && (
            <p className="mt-1 truncate text-xs text-slate-500">
              {indicator.descripcion.substring(0, 80)}...
            </p>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
        {indicator.area_nombre || 'Sin área'}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
        {indicator.unidad_medida || '-'}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
        {indicator.frecuencia || '-'}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold text-slate-900">{compliance}%</span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${
                status === 'critical' ? 'bg-red-500' :
                status === 'warning' ? 'bg-orange-500' :
                status === 'success' ? 'bg-green-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(compliance, 100)}%` }}
            ></div>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-center">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${config.class}`}>
          <i className={`fa-solid ${config.icon}`}></i>
          {config.label}
        </span>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE GRÁFICAS SVG
// ═══════════════════════════════════════════════════════════════════

// Gráfica de Distribución (Barras Horizontales)
function DistributionChart({ byStatus }) {
  const total = Object.values(byStatus).reduce((sum, arr) => sum + arr.length, 0);
  
  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        No hay datos
      </div>
    );
  }

  const data = [
    { label: 'Críticos', count: byStatus.critical.length, color: '#EF4444' },
    { label: 'Advertencia', count: byStatus.warning.length, color: '#F59E0B' },
    { label: 'En Meta', count: byStatus.success.length, color: '#10B981' },
    { label: 'Sobresalientes', count: byStatus.excellent.length, color: '#3B82F6' }
  ];

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barHeight = 60;
  const gap = 20;
  const chartHeight = (barHeight + gap) * data.length;

  return (
    <svg viewBox={`0 0 600 ${chartHeight}`} className="h-full w-full">
      {data.map((item, idx) => {
        const barWidth = (item.count / maxCount) * 450;
        const y = idx * (barHeight + gap);
        const percentage = ((item.count / total) * 100).toFixed(1);
        
        return (
          <g key={item.label}>
            <text x="0" y={y + 30} className="text-sm font-medium" fill="#64748B">
              {item.label}
            </text>
            <rect
              x="140"
              y={y + 10}
              width={barWidth}
              height={barHeight - 20}
              fill={item.color}
              rx="8"
            />
            <text x={140 + barWidth + 10} y={y + 35} className="text-sm font-bold" fill="#1E293B">
              {item.count} ({percentage}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Gráfica Comparativa (Barras Verticales)
function ComparativeBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        No hay datos
      </div>
    );
  }

  const maxCompliance = Math.max(...data.map(d => (d.cumplimiento || 0) * 100), 100);
  const barWidth = 40;
  const gap = 20;
  const chartWidth = (barWidth + gap) * data.length;
  const chartHeight = 300;

  return (
    <svg viewBox={`0 0 ${chartWidth + 100} ${chartHeight + 100}`} className="h-full w-full">
      {/* Línea de referencia 100% */}
      <line
        x1="0"
        y1={chartHeight - 100}
        x2={chartWidth}
        y2={chartHeight - 100}
        stroke="#94A3B8"
        strokeDasharray="5,5"
        strokeWidth="1"
      />
      <text x={chartWidth + 5} y={chartHeight - 95} className="text-xs" fill="#64748B">
        100%
      </text>
      
      {data.map((ind, idx) => {
        const compliance = (ind.cumplimiento || 0) * 100;
        const barHeightVal = (compliance / maxCompliance) * (chartHeight - 100);
        const x = idx * (barWidth + gap);
        const status = calculateIndicatorStatus(ind);
        
        const colorMap = {
          critical: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          excellent: '#3B82F6'
        };
        
        return (
          <g key={ind.id}>
            <rect
              x={x}
              y={chartHeight - barHeightVal}
              width={barWidth}
              height={barHeightVal}
              fill={colorMap[status]}
              rx="4"
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight - barHeightVal - 5}
              textAnchor="middle"
              className="text-xs font-bold"
              fill="#1E293B"
            >
              {compliance.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Gráfica Temporal (Línea)
function TemporalLineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        No hay datos temporales
      </div>
    );
  }

  const width = 800;
  const height = 300;
  const padding = 50;
  const maxValue = Math.max(...data.map(d => d.value), 100);
  
  const points = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height + 50}`} className="h-full w-full">
      {/* Ejes */}
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#CBD5E1"
        strokeWidth="2"
      />
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#CBD5E1"
        strokeWidth="2"
      />
      
      {/* Línea de referencia 100% */}
      {maxValue >= 100 && (
        <>
          <line
            x1={padding}
            y1={height - padding - ((100 / maxValue) * (height - 2 * padding))}
            x2={width - padding}
            y2={height - padding - ((100 / maxValue) * (height - 2 * padding))}
            stroke="#F59E0B"
            strokeDasharray="5,5"
            strokeWidth="1"
          />
          <text
            x={width - padding + 5}
            y={height - padding - ((100 / maxValue) * (height - 2 * padding)) + 5}
            className="text-xs"
            fill="#F59E0B"
          >
            100%
          </text>
        </>
      )}
      
      {/* Área bajo la línea */}
      <polygon
        points={`${padding},${height - padding} ${points} ${padding + (data.length - 1) / (data.length - 1) * (width - 2 * padding)},${height - padding}`}
        fill="#3B82F6"
        opacity="0.1"
      />
      
      {/* Línea de datos */}
      <polyline
        points={points}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Puntos y labels */}
      {data.map((d, idx) => {
        const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
        
        return (
          <g key={idx}>
            <circle cx={x} cy={y} r="5" fill="#3B82F6" stroke="white" strokeWidth="2" />
            <text
              x={x}
              y={height - padding + 20}
              textAnchor="middle"
              className="text-xs"
              fill="#64748B"
            >
              {d.label}
            </text>
            <text
              x={x}
              y={y - 10}
              textAnchor="middle"
              className="text-xs font-bold"
              fill="#1E293B"
            >
              {d.value.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

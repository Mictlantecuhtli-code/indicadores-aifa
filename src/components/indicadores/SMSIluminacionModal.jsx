import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { getMedicionesLucesDetalle } from '../../lib/supabaseClient.js';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SUBSISTEMAS_ORDER = [
  'Sistema de iluminación de aproximación de precisión de Categoría II y III',
  'Los 450 m internos',
  'Luces de eje de pista',
  'Luces de umbral de pista',
  'Luces de borde de pista',
  'Luces de zona de toma de contacto',
  'Luces del sistema de iluminación de aproximación situadas más allá de 450 m del umbral',
  'Luces de extremo de pista'
];

const COLORS = [
  '#1E3A8A', '#3B82F6', '#06B6D4', '#10B981',
  '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'
];

function normalizeText(value) {
  return value
    ?.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function SMSIluminacionModal({ onClose }) {
  const [selectedPista, setSelectedPista] = useState('04C-22C');
  const [selectedYear, setSelectedYear] = useState(null);

  const {
    data: lucesData,
    isLoading,
    isError
  } = useQuery({
    queryKey: ['mediciones-luces', selectedPista],
    queryFn: () => getMedicionesLucesDetalle({ pista: selectedPista }),
    enabled: Boolean(selectedPista)
  });

  const availableYears = useMemo(() => {
    if (!lucesData?.length) return [];

    const uniqueYears = Array.from(
      new Set(
        lucesData
          .map(item => Number(item?.anio))
          .filter(year => Number.isFinite(year))
      )
    );

    return uniqueYears.sort((a, b) => a - b);
  }, [lucesData]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedYear(null);
      return;
    }

    setSelectedYear(prev => {
      if (prev != null && availableYears.includes(prev)) {
        return prev;
      }
      return availableYears[availableYears.length - 1];
    });
  }, [availableYears]);

  const filteredData = useMemo(() => {
    if (!lucesData?.length || !Number.isFinite(selectedYear)) return [];

    return lucesData.filter(item => Number(item?.anio) === selectedYear);
  }, [lucesData, selectedYear]);

  const subsistemasDisponibles = useMemo(() => {
    if (!filteredData.length) return [];

    const byNormalized = new Map();

    filteredData.forEach(item => {
      const name = item?.subsistema;
      if (!name) return;
      const normalized = normalizeText(name);
      if (!byNormalized.has(normalized)) {
        byNormalized.set(normalized, name);
      }
    });

    const ordered = [];
    SUBSISTEMAS_ORDER.forEach(expected => {
      const normalized = normalizeText(expected);
      if (byNormalized.has(normalized)) {
        ordered.push(byNormalized.get(normalized));
        byNormalized.delete(normalized);
      }
    });

    const remaining = Array.from(byNormalized.values()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    return [...ordered, ...remaining];
  }, [filteredData]);

  const chartData = useMemo(() => {
    if (!filteredData.length || !subsistemasDisponibles.length) return [];

    const normalizedMap = new Map(
      subsistemasDisponibles.map(name => [normalizeText(name), name])
    );

    const monthsData = Array.from({ length: 12 }, (_, index) => {
      const monthLabel = MONTH_LABELS[index];
      const entry = { month: monthLabel };

      subsistemasDisponibles.forEach(subsistema => {
        entry[subsistema] = 0;
      });

      return entry;
    });

    filteredData.forEach(item => {
      const month = Number(item?.mes);
      if (!Number.isFinite(month) || month < 1 || month > 12) return;

      const normalized = normalizeText(item?.subsistema);
      const key = normalizedMap.get(normalized);
      if (!key) return;

      const rawValue =
        item?.valor_confiabilidad ??
        item?.valor_disponibilidad ??
        item?.valor ??
        0;
      const numericValue = Number(rawValue);
      monthsData[month - 1][key] = Number.isFinite(numericValue) ? numericValue : 0;
    });

    return monthsData;
  }, [filteredData, subsistemasDisponibles]);

  const bars = useMemo(() => {
    if (!subsistemasDisponibles.length) return [];

    return subsistemasDisponibles.map((subsistema, index) => ({
      subsistema,
      color: COLORS[index % COLORS.length]
    }));
  }, [subsistemasDisponibles]);

  const yearLabel = Number.isFinite(selectedYear)
    ? selectedYear
    : availableYears[availableYears.length - 1];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="relative w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Índice de Confiabilidad y Disponibilidad de Pistas
              </h2>
              <p className="text-sm text-slate-500">
                Sistema de iluminación de ayudas visuales
                {yearLabel ? ` - ${yearLabel}` : ''}
              </p>
            </div>

            {/* Switch de pistas */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Pista:</span>
                <div className="flex rounded-lg border border-slate-200 p-1">
                  <button
                    onClick={() => setSelectedPista('04C-22C')}
                    className={`px-3 py-1 text-sm font-medium rounded transition ${
                      selectedPista === '04C-22C'
                        ? 'bg-aifa-blue text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    04C-22C
                  </button>
                  <button
                    onClick={() => setSelectedPista('04L-22R')}
                    className={`px-3 py-1 text-sm font-medium rounded transition ${
                      selectedPista === '04L-22R'
                        ? 'bg-aifa-blue text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    04L-22R
                  </button>
                </div>
              </div>

              {availableYears.length > 1 ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">Año:</span>
                  <div className="flex rounded-lg border border-slate-200 p-1">
                    {availableYears.map(year => (
                      <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1 text-sm font-medium rounded transition ${
                          year === selectedYear
                            ? 'bg-aifa-blue text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              ) : yearLabel ? (
                <div className="text-sm font-medium text-slate-600">
                  Año: {yearLabel}
                </div>
              ) : null}
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-slate-500">Cargando datos...</div>
            </div>
          ) : isError ? (
            <div className="flex h-96 items-center justify-center">
              <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                No se pudieron obtener las mediciones de iluminación.
              </div>
            </div>
          ) : !chartData.length ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-sm text-slate-500">No hay datos registrados para la pista seleccionada.</div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="month"
                    stroke="#1E293B"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    stroke="#1E293B"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="rect"
                  />

                  {bars.map(bar => (
                    <Bar
                      key={bar.subsistema}
                      dataKey={bar.subsistema}
                      name={bar.subsistema}
                      fill={bar.color}
                      barSize={6}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SMSIluminacionModal;

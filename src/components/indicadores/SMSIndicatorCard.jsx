import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  getIndicatorHistory,
  getIndicatorTargets
} from '../../lib/supabaseClient.js';
import { formatMonth, formatValueByUnit } from '../../utils/formatters.js';
import { isFaunaImpactRateIndicator, normalizeScenarioKey } from '../../utils/smsIndicators.js';
import IndicadorHeader from './IndicadorHeader.jsx';
import IndicadorDetalle from './IndicadorDetalle.jsx';
import SMSIluminacionModal from './SMSIluminacionModal.jsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import SMSCapturaFaunaCard from './SMSCapturaFaunaCard.jsx';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveObservaciones(record) {
  return (
    record?.observaciones ??
    record?.observacion ??
    record?.nota ??
    record?.notas ??
    record?.comentarios ??
    record?.comentario ??
    record?.observaciones_validacion ??
    ''
  );
}

function sortHistory(records = []) {
  return [...records]
    .filter(Boolean)
    .sort((a, b) => {
      if (a.anio === b.anio) {
        return (a.mes ?? 0) - (b.mes ?? 0);
      }
      return a.anio - b.anio;
    });
}

function extractMetaAnual(targets = [], fallback, { preferredScenario, targetYear } = {}) {
  const normalized = targets
    .map(item => ({
      ...item,
      valor: toNumber(item?.valor),
      mes: item?.mes ?? null,
      escenario: item?.escenario ?? '',
      scenarioKey: normalizeScenarioKey(item?.escenario),
      anio: Number(item?.anio) || null
    }))
    .filter(item => item.valor != null);

  const pool = (() => {
    if (!Number.isFinite(targetYear)) {
      return normalized;
    }
    const byYear = normalized.filter(item => item.anio === targetYear);
    return byYear.length ? byYear : normalized;
  })();

  const preferredScenarioValue = normalizeScenarioKey(preferredScenario);
  if (preferredScenarioValue) {
    const byPreferredScenario = pool.find(
      item => item.scenarioKey === preferredScenarioValue
    );
    if (byPreferredScenario) return byPreferredScenario.valor;
  }

  const byNullMonth = pool.find(item => item.mes === null || Number(item.mes) === 0);
  if (byNullMonth) return byNullMonth.valor;

  const byScenario = pool.find(item => {
    const text = (item.escenario ?? '').toString().toLowerCase();
    return text.includes('meta') || text.includes('objetivo') || text.includes('anual');
  });
  if (byScenario) return byScenario.valor;

  if (pool.length) {
    return pool[pool.length - 1].valor;
  }

  const fallbackValue = toNumber(fallback);
  return fallbackValue ?? null;
}

// Nueva función para extraer meta por escenario específico
function extractMetaByScenario(targets = [], scenario = 'bajo') {
  const normalized = targets
    .map(item => ({
      ...item,
      valor: toNumber(item?.valor),
      escenario: (item?.escenario ?? '').toString().toLowerCase()
    }))
    .filter(item => item.valor != null);

  const scenarioLower = scenario.toLowerCase();
  const metaEscenario = normalized.find(target => {
    const escenario = target.escenario;
    return escenario.includes(scenarioLower) || 
           (scenarioLower === 'bajo' && escenario.includes('low')) ||
           (scenarioLower === 'medio' && (escenario.includes('medium') || escenario.includes('med'))) ||
           (scenarioLower === 'alto' && escenario.includes('high'));
  });
  
  return metaEscenario ? metaEscenario.valor : null;
}

function buildChartData(history = [], year, metaAnual) {
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const rows = months.map(month => {
    const record = history.find(item => item.anio === year && (item.mes ?? 0) === month);
    const value = record ? toNumber(record.valor) : null;
    return {
      month,
      label: MONTH_LABELS[month - 1] ?? `${month}`,
      fullLabel: formatMonth(year, month),
      valor: value,
      observaciones: record ? resolveObservaciones(record) : '',
      meta: metaAnual ?? null
    };
  });

  return rows;
}

function calculateStatus(value, meta) {
  if (meta == null || value == null) {
    return {
      label: 'Sin meta registrada',
      badge: 'bg-slate-100 text-slate-600',
      text: 'text-slate-500'
    };
  }

  if (value >= meta) {
    return {
      label: 'En meta',
      badge: 'bg-emerald-100 text-emerald-700',
      text: 'text-aifa-green'
    };
  }

  if (value >= meta * 0.9) {
    return {
      label: 'Cercano a la meta',
      badge: 'bg-amber-100 text-amber-700',
      text: 'text-amber-600'
    };
  }

  return {
    label: 'Fuera de meta',
    badge: 'bg-rose-100 text-rose-700',
    text: 'text-rose-600'
  };
}

function SMSChartTooltip({ active, payload, label, unidadMedida }) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload ?? null;
  const valueEntry = payload.find(item => item.dataKey === 'valor');
  const value = valueEntry?.value ?? null;
  const observations = datum?.observaciones;

  return (
    <div className="min-w-[14rem] rounded-xl border border-slate-200 bg-gray-100/95 p-3 text-sm text-gray-800 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{datum?.fullLabel ?? label}</p>
      <p className="mt-1 text-lg font-bold text-aifa-blue">
        {value != null
          ? formatValueByUnit(value, unidadMedida, {
              numberDecimals: 2,
              percentageDecimals: 3,
              percentageScale: 'percentage'
            })
          : 'Sin dato'}
      </p>
      {observations ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{observations}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Sin observaciones registradas</p>
      )}
    </div>
  );
}

function normalizeIndicatorName(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const FAUNA_SPECIES_NAMES = new Set(
  [
    'capturas de aves realizadas',
    'capturas de mamiferos realizadas',
    'capturas de mamíferos realizadas',
    'capturas de reptiles realizadas'
  ].map(normalizeIndicatorName)
);

const FAUNA_SPECIES_KEYWORD_SETS = [
  ['captur', 'ave'],
  ['captur', 'mamif'],
  ['captur', 'reptil']
];

function isFaunaSpeciesIndicator(indicator) {
  const name = normalizeIndicatorName(indicator?.nombre);
  if (!name) return false;
  if (FAUNA_SPECIES_NAMES.has(name)) return true;

  return FAUNA_SPECIES_KEYWORD_SETS.some(keywords =>
    keywords.every(keyword => name.includes(keyword))
  );
}

export default function SMSIndicatorCard({ indicator }) {
  const [showIluminacionModal, setShowIluminacionModal] = useState(false);
  
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const latestYear = currentYear;
  const unidadMedida = indicator?.unidad_medida ?? 'Unidades';

  // Detectar si es el indicador SMS-03 para mostrar modal especializado
  const isIluminacionIndicator = indicator?.clave === 'SMS-03';

  const historyQuery = useQuery({
    queryKey: ['sms-indicator-history', indicator.id],
    queryFn: () => getIndicatorHistory(indicator.id),
    enabled: Boolean(indicator?.id),
    refetchOnWindowFocus: false
  });

  const targetsQuery = useQuery({
    queryKey: ['sms-indicator-targets', indicator.id],
    queryFn: () => getIndicatorTargets(indicator.id),
    enabled: Boolean(indicator?.id),
    refetchOnWindowFocus: false
  });

  const historySorted = useMemo(() => sortHistory(historyQuery.data), [historyQuery.data]);

  const latestRecord = useMemo(() => {
    const current = historySorted.filter(item => item.anio === latestYear);
    return current.length
      ? current.reduce((latest, record) => ((record.mes ?? 0) > (latest.mes ?? 0) ? record : latest))
      : null;
  }, [historySorted, latestYear]);

  const metaAnual = useMemo(() => {
    return extractMetaAnual(
      targetsQuery.data,
      indicator?.meta_anual,
      { targetYear: latestYear }
    );
  }, [targetsQuery.data, indicator?.meta_anual, latestYear]);

  // Nuevas metas por escenario solo para SMS-01
  const metasEscenarios = useMemo(() => {
    if (!isFaunaImpactRateIndicator(indicator)) {
      return { bajo: null, medio: null, alto: null };
    }
    
    return {
      bajo: extractMetaByScenario(targetsQuery.data, 'bajo'),
      medio: extractMetaByScenario(targetsQuery.data, 'medio'),
      alto: extractMetaByScenario(targetsQuery.data, 'alto')
    };
  }, [targetsQuery.data, indicator]);

  const status = useMemo(() => {
    const value = latestRecord?.valor != null ? toNumber(latestRecord.valor) : null;
    return calculateStatus(value, metaAnual);
  }, [latestRecord, metaAnual]);

  const chartData = useMemo(() => {
    return buildChartData(historySorted, latestYear, metaAnual);
  }, [historySorted, latestYear, metaAnual]);

  const detalleRegistros = useMemo(() => {
    return historySorted.filter(item => item.anio === latestYear);
  }, [historySorted, latestYear]);

  useEffect(() => {
    const handleRealtime = payload => {
      if (payload.table === 'mediciones' && payload.new?.indicador_id === indicator?.id) {
        queryClient.invalidateQueries(['sms-indicator-history', indicator.id]);
      }
    };

    const subscription = supabase
      .channel('sms-indicator-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mediciones' }, handleRealtime)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [indicator?.id, queryClient]);

  if (isFaunaSpeciesIndicator(indicator)) {
    return <SMSCapturaFaunaCard indicator={indicator} />;
  }

  if (historyQuery.isLoading || targetsQuery.isLoading) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-3/4 rounded bg-slate-100" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
            <div className="h-32 rounded bg-slate-100" />
          </div>
        </div>
      </article>
    );
  }

  if (historyQuery.error || targetsQuery.error) {
    return (
      <article className="rounded-2xl border border-red-200 bg-red-50 shadow-sm">
        <div className="p-6">
          <p className="text-sm text-red-700">Error al cargar los datos del indicador.</p>
        </div>
      </article>
    );
  }

  const handleCardClick = () => {
    if (isIluminacionIndicator) {
      setShowIluminacionModal(true);
    }
    // Si no es SMS-03, no hacer nada o agregar lógica para otros indicadores
  };

  return (
    <>
      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-6 p-6">
          <IndicadorHeader
            indicator={indicator}
            onClick={handleCardClick}
            latestRecord={latestRecord}
            metaAnual={metaAnual}
            year={latestYear}
          />

          {historySorted.length ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Último valor registrado</p>
                  <p className="mt-2 text-3xl font-bold text-aifa-blue">
                    {latestRecord?.valor != null
                      ? formatValueByUnit(latestRecord.valor, unidadMedida, {
                          numberDecimals: 2,
                          percentageDecimals: 3,
                          percentageScale: 'percentage'
                        })
                      : 'Sin dato'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {latestRecord ? formatMonth(latestRecord.anio, latestRecord.mes ?? 1) : 'Pendiente de captura'}
                  </p>
                </div>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                  <span className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
                    {status.label}
                  </span>
                  <p className={`text-sm font-semibold ${status.text}`}>
                    {metaAnual != null && latestRecord?.valor != null
                      ? `${formatValueByUnit(latestRecord.valor - metaAnual, unidadMedida, {
                          numberDecimals: 2,
                          percentageDecimals: 3,
                          percentageScale: 'percentage'
                        })} vs meta`
                      : 'Sin referencia'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Comportamiento mensual {latestYear}</h3>
                    <p className="text-xs text-slate-500">
                      Valores capturados del indicador durante el año en curso.
                      {isFaunaImpactRateIndicator(indicator) && (
                        <span className="ml-1 text-blue-600 font-medium">Incluye metas por escenario</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="h-72 transition-all duration-300">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="label"
                        stroke="#1E293B"
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        tickMargin={8}
                      />
                      <YAxis
                        stroke="#1E293B"
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        tickFormatter={value =>
                          formatValueByUnit(value, unidadMedida, {
                            numberDecimals: 0,
                            percentageDecimals: 3,
                            percentageScale: 'percentage'
                          })}
                        width={70}
                      />
                      <Tooltip content={<SMSChartTooltip unidadMedida={unidadMedida} />} />
                      
                      {/* Meta anual existente */}
                      {metaAnual != null ? (
                        <ReferenceLine
                          y={metaAnual}
                          stroke="#d9534f"
                          strokeDasharray="6 4"
                          label={{ value: 'Meta anual', fill: '#d9534f', fontSize: 11, position: 'insideTopRight' }}
                        />
                      ) : null}
                      
                      {/* NUEVAS LÍNEAS DE REFERENCIA PARA METAS POR ESCENARIO (solo SMS-01) */}
                      {isFaunaImpactRateIndicator(indicator) && metasEscenarios.bajo != null ? (
                        <ReferenceLine
                          y={metasEscenarios.bajo}
                          stroke="#F97316"
                          strokeDasharray="8 3"
                          label={{ 
                            value: 'Meta Escenario Bajo', 
                            fill: '#F97316', 
                            fontSize: 10, 
                            position: 'insideTopLeft' 
                          }}
                        />
                      ) : null}
                      
                      {isFaunaImpactRateIndicator(indicator) && metasEscenarios.medio != null ? (
                        <ReferenceLine
                          y={metasEscenarios.medio}
                          stroke="#0EA5E9"
                          strokeDasharray="8 3"
                          label={{ 
                            value: 'Meta Escenario Medio', 
                            fill: '#0EA5E9', 
                            fontSize: 10, 
                            position: 'insideBottomLeft' 
                          }}
                        />
                      ) : null}
                      
                      {isFaunaImpactRateIndicator(indicator) && metasEscenarios.alto != null ? (
                        <ReferenceLine
                          y={metasEscenarios.alto}
                          stroke="#059669"
                          strokeDasharray="8 3"
                          label={{ 
                            value: 'Meta Escenario Alto', 
                            fill: '#059669', 
                            fontSize: 10, 
                            position: 'insideBottom' 
                          }}
                        />
                      ) : null}
                      
                      <Line
                        type="monotone"
                        dataKey="valor"
                        name="Valor real"
                        stroke="#1E3A8A"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, stroke: '#1E3A8A', fill: '#fff' }}
                        activeDot={{ r: 6, stroke: '#1E3A8A', strokeWidth: 2, fill: '#3B82F6' }}
                        connectNulls={false}
                        isAnimationActive
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* NUEVO INDICADOR VISUAL PARA SMS-01 */}
                {isFaunaImpactRateIndicator(indicator) && Object.values(metasEscenarios).some(meta => meta != null) && (
                  <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">📊 Metas por Escenario</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {metasEscenarios.bajo != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-3 w-6 border-2 border-orange-500 border-dashed bg-orange-100"></div>
                          <span className="text-orange-800 font-medium">
                            Bajo: {formatValueByUnit(metasEscenarios.bajo, unidadMedida, {
                              numberDecimals: 2,
                              percentageDecimals: 3,
                              percentageScale: 'percentage'
                            })}
                          </span>
                        </div>
                      )}
                      {metasEscenarios.medio != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-3 w-6 border-2 border-sky-500 border-dashed bg-sky-100"></div>
                          <span className="text-sky-800 font-medium">
                            Medio: {formatValueByUnit(metasEscenarios.medio, unidadMedida, {
                              numberDecimals: 2,
                              percentageDecimals: 3,
                              percentageScale: 'percentage'
                            })}
                          </span>
                        </div>
                      )}
                      {metasEscenarios.alto != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-3 w-6 border-2 border-emerald-500 border-dashed bg-emerald-100"></div>
                          <span className="text-emerald-800 font-medium">
                            Alto: {formatValueByUnit(metasEscenarios.alto, unidadMedida, {
                              numberDecimals: 2,
                              percentageDecimals: 3,
                              percentageScale: 'percentage'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <IndicadorDetalle
                registros={detalleRegistros}
                year={latestYear}
                unidadMedida={unidadMedida}
                percentageScale="percentage"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Aún no hay datos para este indicador.
            </div>
          )}
        </div>
      </article>

      {/* Modal especializado para SMS-03 */}
      {showIluminacionModal && (
        <SMSIluminacionModal onClose={() => setShowIluminacionModal(false)} />
      )}
    </>
  );
}

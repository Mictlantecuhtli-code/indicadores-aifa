import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

function isRelationNotFound(error) {
  return error?.code === '42P01' || /relation .+ does not exist/i.test(error?.message ?? '');
}

function isFunctionNotFound(error) {
  return error?.code === '42883' || /function .+ does not exist/i.test(error?.message ?? '');
}

function normalizeMeasurement(record) {
  if (!record) return record;
  return {
    ...record,
    escenario: record.escenario ? record.escenario.toUpperCase() : null,
    fecha_captura: record.fecha_captura ?? record.creado_en ?? null,
    fecha_actualizacion:
      record.fecha_actualizacion ?? record.fecha_ultima_edicion ?? record.actualizado_en ?? null
  };
}

function normalizeTarget(record) {
  if (!record) return record;
  return {
    ...record,
    escenario: record.escenario ? record.escenario.toUpperCase() : null,
    fecha_captura: record.fecha_captura ?? record.creado_en ?? null,
    fecha_actualizacion:
      record.fecha_actualizacion ?? record.fecha_ultima_edicion ?? record.actualizado_en ?? null
  };
}

async function fetchFromRelations(relations, builder) {
  let lastError = null;
  for (const relation of relations) {
    const { data, error } = await builder(relation);
    if (!error) {
      return data ?? [];
    }
    if (!isRelationNotFound(error)) {
      throw error;
    }
    lastError = error;
  }
  if (lastError) {
    throw lastError;
  }
  return [];
}

function sanitizeScenario(payload) {
  if (!payload) return payload;
  if ('escenario' in payload && payload.escenario) {
    return { ...payload, escenario: payload.escenario.toUpperCase() };
  }
  if ('escenario' in payload) {
    return { ...payload, escenario: null };
  }
  return payload;
}

export async function getDashboardSummary() {
  return fetchFromRelations(['v_dashboard_resumen', 'vw_dashboard_resumen'], relation =>
    supabase.from(relation).select('*')
  );
}

export async function getDirectorsHighlights() {
  try {
    return await fetchFromRelations(
      ['v_indicadores_criticos', 'vw_indicadores_criticos', 'vw_indicadores_alertas', 'vw_indicadores_alerta'],
      relation => supabase.from(relation).select('*')
    );
  } catch (error) {
    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  const { data: indicators, error: indicatorsError } = await supabase
    .from('v_indicadores_area')
    .select('*');

  if (indicatorsError) {
    if (!isRelationNotFound(indicatorsError)) {
      throw indicatorsError;
    }
  } else if (indicators?.length) {
    const criticalIndicators = indicators.filter(record => {
      if (record == null || typeof record !== 'object') return false;
      if ('es_critico' in record) return Boolean(record.es_critico);
      if ('es_alerta' in record) return Boolean(record.es_alerta);
      if ('critico' in record) return Boolean(record.critico);
      if ('alerta' in record) return Boolean(record.alerta);
      const status =
        (record.nivel_alerta ?? record.estatus ?? record.estado ?? record.estatus_alerta ?? record.color_alerta ?? '')
          .toString()
          .toLowerCase();
      return ['critico', 'crítico', 'alerta', 'rojo'].includes(status);
    });

    return criticalIndicators.map(item => ({
      ...item,
      valor_actual: item.valor_actual ?? item.ultima_medicion_valor ?? item.valor ?? null,
      meta: item.meta ?? item.valor_meta ?? item.meta_actual ?? null,
      actualizado_en: item.actualizado_en ?? item.fecha_actualizacion ?? item.ultima_medicion_fecha ?? null,
      area: item.area ?? item.area_nombre ?? null
    }));
  }

  const { data, error } = await supabase.rpc('kpi_resumen_directivos');
  if (error) {
    if (isFunctionNotFound(error)) return [];
    throw error;
  }
  return data ?? [];
}

export async function getIndicators() {
  return fetchFromRelations(['v_indicadores_area', 'vw_indicadores_area', 'vw_indicadores_detalle'], relation =>
    supabase
      .from(relation)
      .select('*')
      .order('area_nombre', { ascending: true })
      .order('nombre', { ascending: true })
  );
}

export async function getIndicatorHistory(indicadorId, { limit = 24 } = {}) {
  if (!indicadorId) return [];
  const data = await fetchFromRelations(['v_mediciones_historico', 'mediciones'], relation =>
    supabase
      .from(relation)
      .select('*')
      .eq('indicador_id', indicadorId)
      .order('anio', { ascending: true })
      .order('mes', { ascending: true })
      .limit(limit)
  );

  return (data ?? []).map(normalizeMeasurement);
}

export async function getIndicatorTargets(indicadorId, { year } = {}) {
  if (!indicadorId) return [];
  let query = supabase
    .from('indicador_metas')
    .select('*')
    .eq('indicador_id', indicadorId)
    .order('anio', { ascending: true })
    .order('mes', { ascending: true });

  if (year) {
    query = query.eq('anio', year);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeTarget);
}

export async function saveMeasurement(payload) {
  const sanitized = sanitizeScenario(payload);
  const { data, error } = await supabase.from('mediciones').insert(sanitized).select().single();
  if (error) throw error;
  return normalizeMeasurement(data);
}

export async function updateMeasurement(id, payload) {
  const sanitized = sanitizeScenario(payload);
  const { data, error } = await supabase
    .from('mediciones')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeMeasurement(data);
}

export async function upsertTarget(payload) {
  const sanitized = sanitizeScenario(payload);
  const { data, error } = await supabase
    .from('indicador_metas')
    .upsert(sanitized, { onConflict: 'indicador_id,anio,mes,escenario' })
    .select()
    .single();
  if (error) throw error;
  return normalizeTarget(data);
}

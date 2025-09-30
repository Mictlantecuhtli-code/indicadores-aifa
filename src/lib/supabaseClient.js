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

function normalizeStatus(value) {
  const text = value?.toString().toLowerCase() ?? '';
  return typeof text.normalize === 'function'
    ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : text;
}

function normalizeMeasurement(record) {
  if (!record) return record;
  const status =
    record.estatus_validacion ??
    record.estado_validacion ??
    record.estatus ??
    (typeof record.validado === 'boolean'
      ? record.validado
        ? 'VALIDADO'
        : 'PENDIENTE'
      : null);

  return {
    ...record,
    escenario: record.escenario ? record.escenario.toUpperCase() : null,
    estatus_validacion: typeof status === 'string' ? status.toUpperCase() : status ?? 'PENDIENTE',
    fecha_captura: record.fecha_captura ?? record.creado_en ?? null,
    fecha_actualizacion:
      record.fecha_actualizacion ?? record.fecha_ultima_edicion ?? record.actualizado_en ?? null,
    fecha_validacion: record.fecha_validacion ?? record.validado_en ?? null,
    validado_por: record.validado_por ?? record.subdirector_id ?? null,
    observaciones_validacion:
      record.observaciones_validacion ?? record.validacion_observaciones ?? null,
    capturado_por: record.capturado_por ?? record.creado_por ?? null,
    editado_por: record.editado_por ?? record.actualizado_por ?? null
  };
}

function normalizeTarget(record) {
  if (!record) return record;
  return {
    ...record,
    escenario: record.escenario ? record.escenario.toUpperCase() : null,
    fecha_captura: record.fecha_captura ?? record.creado_en ?? null,
    fecha_actualizacion:
      record.fecha_actualizacion ?? record.fecha_ultima_edicion ?? record.actualizado_en ?? null,
    capturado_por: record.capturado_por ?? record.creado_por ?? null,
    editado_por: record.editado_por ?? record.actualizado_por ?? null
  };
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
  const relations = [
    'v_dashboard_resumen',
    'v_dashboard_resumen_v2',
    'vw_dashboard_resumen',
    'vw_dashboard_resumen_v2',
    'dashboard_resumen',
    'dashboard_resumen_view',
    'dashboard_resumen_vista',
    'dashboard_resumen_general',
    'resumen_dashboard',
    'vista_dashboard_resumen',
    'vista_dashboard_resumen_v2'
  ];

  for (const relation of relations) {
    const { data, error } = await supabase.from(relation).select('*');

    if (!error) {
      return data ?? [];
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  return [];
}

export async function getDirectorsHighlights() {
  const highlightRelations = [
    'v_indicadores_criticos',
    'v_indicadores_prioritarios',
    'vw_indicadores_criticos',
    'vw_indicadores_prioritarios',
    'vw_indicadores_alertas',
    'vw_indicadores_alerta',
    'indicadores_criticos',
    'indicadores_prioritarios',
    'indicadores_alertas',
    'indicadores_directivos_resumen',
    'resumen_indicadores_directivos',
    'resumen_indicadores_prioritarios',
    'vista_indicadores_criticos',
    'vista_indicadores_prioritarios'
  ];

  for (const relation of highlightRelations) {
    const { data, error } = await supabase.from(relation).select('*');

    if (!error) {
      return data ?? [];
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  const indicatorRelations = [
    'v_indicadores_area',
    'v_indicadores',
    'vw_indicadores_area',
    'vw_indicadores_detalle',
    'vw_indicadores',
    'indicadores_area',
    'indicadores',
    'vista_indicadores_area',
    'vista_indicadores'
  ];

  for (const relation of indicatorRelations) {
    const { data: indicators, error } = await supabase.from(relation).select('*');

    if (error) {
      if (isRelationNotFound(error)) {
        continue;
      }
      throw error;
    }

    if (indicators?.length) {
      const criticalIndicators = indicators.filter(record => {
        if (record == null || typeof record !== 'object') return false;
        if ('es_critico' in record) return Boolean(record.es_critico);
        if ('es_alerta' in record) return Boolean(record.es_alerta);
        if ('critico' in record) return Boolean(record.critico);
        if ('alerta' in record) return Boolean(record.alerta);
        const status =
          record.nivel_alerta ??
          record.estatus ??
          record.estado ??
          record.estatus_alerta ??
          record.color_alerta ??
          '';
        return ['critico', 'alerta', 'rojo'].includes(normalizeStatus(status));
      });

      if (criticalIndicators.length) {
        return criticalIndicators.map(item => ({
          ...item,
          valor_actual: item.valor_actual ?? item.ultima_medicion_valor ?? item.valor ?? null,
          meta: item.meta ?? item.valor_meta ?? item.meta_actual ?? null,
          actualizado_en: item.actualizado_en ?? item.fecha_actualizacion ?? item.ultima_medicion_fecha ?? null,
          area: item.area ?? item.area_nombre ?? null
        }));
      }
    }
  }

  const { data, error } = await supabase.rpc('kpi_resumen_directivos');
  if (error) {
    if (isFunctionNotFound(error)) return [];
    throw error;
  }
  return data ?? [];
}

export async function getIndicators() {
  const relations = [
    'v_indicadores_area',
    'v_indicadores',
    'vw_indicadores_area',
    'vw_indicadores_detalle',
    'vw_indicadores',
    'indicadores_area',
    'indicadores',
    'vista_indicadores_area',
    'vista_indicadores'
  ];

  for (const relation of relations) {
    const { data, error } = await supabase
      .from(relation)
      .select('*')
      .order('area_nombre', { ascending: true })
      .order('nombre', { ascending: true });

    if (!error) {
      return data ?? [];
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  return [];
}

export async function getAreas() {
  const { data, error } = await supabase
    .from('areas')
    .select('id,nombre,clave,color_hex,parent_area_id')
    .order('nombre', { ascending: true });

  if (error) {
    if (isRelationNotFound(error)) {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function getIndicatorHistory(indicadorId, { limit = 24 } = {}) {
  if (!indicadorId) return [];
  const relations = [
    'v_mediciones_historico',
    'v_mediciones_historico_v2',
    'mediciones_historico',
    'mediciones_historico_view',
    'vista_mediciones_historico',
    'vw_mediciones_historico',
    'mediciones'
  ];

  for (const relation of relations) {
    const { data, error } = await supabase
      .from(relation)
      .select('*')
      .eq('indicador_id', indicadorId)
      .order('anio', { ascending: true })
      .order('mes', { ascending: true })
      .limit(limit);

    if (!error) {
      return (data ?? []).map(normalizeMeasurement);
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  return [];
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
  const sanitized = sanitizeScenario(payload ? { ...payload } : payload);
  if (sanitized && !('estatus_validacion' in sanitized)) {
    sanitized.estatus_validacion = 'PENDIENTE';
  }
  if (sanitized && typeof sanitized.estatus_validacion === 'string') {
    sanitized.estatus_validacion = sanitized.estatus_validacion.toUpperCase();
  }
  const { data, error } = await supabase.from('mediciones').insert(sanitized).select().single();
  if (error) throw error;
  return normalizeMeasurement(data);
}

export async function updateMeasurement(id, payload) {
  const sanitized = sanitizeScenario(payload ? { ...payload } : payload);
  if (sanitized && typeof sanitized.estatus_validacion === 'string') {
    sanitized.estatus_validacion = sanitized.estatus_validacion.toUpperCase();
  }
  const { data, error } = await supabase
    .from('mediciones')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeMeasurement(data);
}

export async function validateMeasurement(id, { validado_por, observaciones = null } = {}) {
  if (!id) throw new Error('Se requiere un identificador de medición para validar.');
  const payload = {
    estatus_validacion: 'VALIDADO',
    validado_por: validado_por ?? null,
    fecha_validacion: new Date().toISOString()
  };
  if (observaciones !== undefined) {
    payload.observaciones_validacion = observaciones;
  }
  return updateMeasurement(id, payload);
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

function normalizeUser(record) {
  if (!record) return null;
  const email = record.email ?? record.correo ?? record.usuario?.email ?? record.usuario_email ?? null;
  const lastAccess =
    record.ultimo_acceso ?? record.ultima_conexion ?? record.ultimo_login ?? record.actualizado_en ?? null;
  return {
    id:
      record.id ??
      record.usuario_id ??
      email ??
      record.nombre_completo ??
      record.nombre ??
      `usuario-${Math.random().toString(36).slice(2)}`,
    nombre: record.nombre_completo ?? record.nombre ?? record.full_name ?? 'Sin nombre',
    puesto: record.puesto ?? record.cargo ?? null,
    rol: record.rol ?? record.perfil ?? record.tipo ?? null,
    email: email ?? '—',
    direccion: record.direccion ?? record.area ?? record.area_nombre ?? record.subdireccion ?? null,
    ultimo_acceso: lastAccess
  };
}

export async function getUsers() {
  const relationCandidates = [
    { relation: 'v_usuarios_sistema', select: 'id,nombre_completo,nombre,puesto,rol,correo,email,direccion,subdireccion,ultima_conexion,ultimo_acceso,usuario:usuarios(email,ultimo_acceso)' },
    { relation: 'vw_usuarios', select: 'id,nombre_completo,nombre,puesto,rol,correo,email,direccion,ultima_conexion' },
    { relation: 'usuarios_detalle', select: 'id,nombre_completo,nombre,puesto,rol,correo,email,direccion,ultima_conexion' },
    { relation: 'usuarios', select: 'id,nombre,correo,rol,ultimo_acceso' },
    { relation: 'perfiles', select: 'id,nombre_completo,nombre,puesto,rol,usuario:usuarios(email,ultimo_acceso)' }
  ];

  for (const candidate of relationCandidates) {
    const { data, error } = await supabase.from(candidate.relation).select(candidate.select);

    if (!error) {
      return (data ?? []).map(normalizeUser).filter(Boolean);
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  return [];
}

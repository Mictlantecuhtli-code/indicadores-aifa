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

const VALIDATION_STATES = ['PENDIENTE', 'VALIDADO', 'RECHAZADO'];

function normalizeValidationStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (!normalized) return null;
  if (VALIDATION_STATES.includes(normalized)) return normalized;
  if (normalized === 'APROBADO') return 'VALIDADO';
  if (normalized === 'RECHAZADA') return 'RECHAZADO';
  return normalized;
}

function syncValidationFields(record, fallbackStatus) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const candidateStatus =
    record.estatus_validacion ??
    record.estatus ??
    (typeof record.validado === 'boolean'
      ? record.validado
        ? 'VALIDADO'
        : 'PENDIENTE'
      : null) ??
    fallbackStatus ??
    null;
    
  const status = normalizeValidationStatus(candidateStatus);
  if (!status) return record;
  
  return {
    ...record,
    estatus_validacion: status,  // ✅ SOLO estatus_validacion
    // ❌ ELIMINAR: estado_validacion: status,
    // ❌ ELIMINAR: estatus: status,
    validado: status === 'VALIDADO'
  };
}

function stripValidationSynonyms(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  // Eliminar cualquier variante que NO sea estatus_validacion
  const { 
    estado_validacion: _estado_validacion,  // ❌ Eliminar esto
    estado: _estado, 
    estatus: _estatus, 
    status: _status, 
    ...cleaned 
  } = record;
  
  return cleaned;
}

const MEASUREMENT_WRITABLE_COLUMNS = new Set([
  'indicador_id',
  'anio',
  'mes',
  'escenario',
  'valor',
  'capturado_por',
  'editado_por',
  'validado_por',
  'fecha_captura',
  'fecha_ultima_edicion',
  'fecha_validacion',
  'estatus_validacion',
  'observaciones_validacion'
]);

function mergeMeasurementAliases(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const merged = { ...record };

  if (
    merged.observaciones_validacion === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'validacion_observaciones')
  ) {
    merged.observaciones_validacion = merged.validacion_observaciones;
  }

  if (
    merged.fecha_captura === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'creado_en') &&
    merged.creado_en !== undefined
  ) {
    merged.fecha_captura = merged.creado_en;
  }

  if (
    merged.fecha_ultima_edicion === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'fecha_actualizacion') &&
    merged.fecha_actualizacion !== undefined
  ) {
    merged.fecha_ultima_edicion = merged.fecha_actualizacion;
  }

  if (
    merged.fecha_ultima_edicion === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'actualizado_en') &&
    merged.actualizado_en !== undefined
  ) {
    merged.fecha_ultima_edicion = merged.actualizado_en;
  }

  if (
    merged.fecha_validacion === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'validado_en') &&
    merged.validado_en !== undefined
  ) {
    merged.fecha_validacion = merged.validado_en;
  }

  if (
    merged.capturado_por === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'creado_por')
  ) {
    merged.capturado_por = merged.creado_por;
  }

  if (
    merged.editado_por === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'actualizado_por')
  ) {
    merged.editado_por = merged.actualizado_por;
  }

  if (
    merged.validado_por === undefined &&
    Object.prototype.hasOwnProperty.call(merged, 'subdirector_id')
  ) {
    merged.validado_por = merged.subdirector_id;
  }

  return merged;
}

function prepareMeasurementPayload(payload, fallbackStatus) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  let sanitized = sanitizeScenario({ ...payload });
  sanitized = mergeMeasurementAliases(sanitized);
  sanitized = syncValidationFields(sanitized, fallbackStatus);
  
  // NO eliminar sinónimos si estamos validando explícitamente
  const isExplicitValidation = sanitized.estatus_validacion === 'VALIDADO' && sanitized.validado_por;
  if (!isExplicitValidation) {
    sanitized = stripValidationSynonyms(sanitized);
  }

  // Solo limpiar campos de validación si NO es una validación explícita
  if (sanitized.estatus_validacion !== 'VALIDADO' && !isExplicitValidation) {
    sanitized = {
      ...sanitized,
      validado_por: null,
      fecha_validacion: null
    };
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(sanitized)) {
    if (MEASUREMENT_WRITABLE_COLUMNS.has(key)) {
      // Asegurar que los valores no sean undefined
      cleaned[key] = value === undefined ? null : value;
    }
  }

  return cleaned;
}

function normalizeMeasurement(record) {
  if (!record) return record;
  const normalizedRecord = syncValidationFields(record);
  const status = normalizedRecord.estatus_validacion;

  return {
    ...normalizedRecord,
    escenario: normalizedRecord.escenario ? normalizedRecord.escenario.toUpperCase() : null,
    estatus_validacion: typeof status === 'string' ? status.toUpperCase() : status ?? 'PENDIENTE',
    fecha_captura: normalizedRecord.fecha_captura ?? normalizedRecord.creado_en ?? null,
    fecha_actualizacion:
      normalizedRecord.fecha_actualizacion ??
      normalizedRecord.fecha_ultima_edicion ??
      normalizedRecord.actualizado_en ??
      null,
    fecha_validacion: normalizedRecord.fecha_validacion ?? normalizedRecord.validado_en ?? null,
    validado_por: normalizedRecord.validado_por ?? normalizedRecord.subdirector_id ?? null,
    observaciones_validacion:
      normalizedRecord.observaciones_validacion ?? normalizedRecord.validacion_observaciones ?? null,
    capturado_por: normalizedRecord.capturado_por ?? normalizedRecord.creado_por ?? null,
    editado_por: normalizedRecord.editado_por ?? normalizedRecord.actualizado_por ?? null
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

export async function getMedicionesLucesDetalle({ year = null, pista = null } = {}) {
  let query = supabase
    .from('mediciones_luces_detalle')
    .select('*')
    .order('anio', { ascending: true })
    .order('mes', { ascending: true });

  if (Number.isFinite(year)) {
    query = query.eq('anio', year);
  }

  if (pista) {
    query = query.eq('pista', pista);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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

export async function getCapturasFaunaResumen({ year } = {}) {
  const relations = ['v_capturas_especie'];

  for (const relation of relations) {
    let query = supabase.from(relation).select('*');

    if (year) {
      query = query.eq('anio', year);
    }

    const { data, error } = await query
      .order('anio', { ascending: true })
      .order('mes', { ascending: true });

    if (!error) {
      return data ?? [];
    }

    if (!isRelationNotFound(error)) {
      throw error;
    }
  }

  return [];
}

export async function saveMeasurement(payload) {
  const sanitized = prepareMeasurementPayload(payload ? { ...payload } : payload, 'PENDIENTE');
  const { data, error } = await supabase.from('mediciones').insert(sanitized).select().single();
  if (error) throw error;
  return normalizeMeasurement(data);
}

export async function updateMeasurement(id, payload) {
  const sanitized = prepareMeasurementPayload(payload ? { ...payload } : payload);
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
  
  // Payload simple y directo - SOLO las columnas que existen en la BD
  const payload = {
    estatus_validacion: 'VALIDADO',  // ✅ Nombre correcto de columna
    validado_por: validado_por,
    fecha_validacion: new Date().toISOString()
  };
  
  if (observaciones !== undefined && observaciones !== null) {
    payload.observaciones_validacion = observaciones;
  }
  
  console.log('📦 Payload limpio:', payload);
  
  // Actualizar directamente sin procesar
  const { data, error } = await supabase
    .from('mediciones')
    .update(payload)  // ✅ Sin syncValidationFields ni stripValidationSynonyms
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error:', error);
    throw error;
  }
  
  console.log('✅ Actualizado:', data);
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

function normalizeUser(record) {
  if (!record) return null;
  const email = record.email ?? record.correo ?? record.usuario?.email ?? record.usuario_email ?? null;
  const lastAccess =
    record.ultimo_acceso ?? record.ultima_conexion ?? record.ultimo_login ?? record.actualizado_en ?? null;
  const profileId = record.id ?? record.perfil_id ?? null;
  const authUserId = record.usuario_id ?? record.user_id ?? record.auth_user_id ?? record.usuario?.id ?? null;

  return {
    id:
      profileId ??
      authUserId ??
      email ??
      record.nombre_completo ??
      record.nombre ??
      `usuario-${Math.random().toString(36).slice(2)}`,
    perfil_id: profileId ?? null,
    usuario_id: authUserId ?? null,
    nombre: record.nombre_completo ?? record.nombre ?? record.full_name ?? 'Sin nombre',
    puesto: record.puesto ?? record.cargo ?? null,
    rol: record.rol ?? record.perfil ?? record.tipo ?? record.rol_principal ?? null,
    rol_principal: record.rol_principal ?? record.rol ?? record.perfil ?? record.tipo ?? null,
    email: email ?? '—',
    direccion: record.direccion ?? record.area ?? record.area_nombre ?? record.subdireccion ?? null,
    ultimo_acceso: lastAccess,
    estado: record.estado ?? record.estatus ?? record.status ?? null
  };
}

export async function getUsers() {
  const relationCandidates = [
    {
      relation: 'v_usuarios_sistema',
      select:
        'id,usuario_id,nombre_completo,nombre,puesto,rol,rol_principal,estado,correo,email,direccion,subdireccion,ultima_conexion,ultimo_acceso,usuario:usuarios(id,email,ultimo_acceso)'
    },
    {
      relation: 'vw_usuarios',
      select: 'id,usuario_id,nombre_completo,nombre,puesto,rol,rol_principal,estado,correo,email,direccion,ultima_conexion'
    },
    {
      relation: 'usuarios_detalle',
      select: 'id,usuario_id,nombre_completo,nombre,puesto,rol,rol_principal,estado,correo,email,direccion,ultima_conexion'
    },
    {
      relation: 'usuarios',
      select: 'id,usuario_id,nombre,correo,rol,rol_principal,estado,ultimo_acceso'
    },
    {
      relation: 'perfiles',
      select:
        'id,usuario_id,nombre_completo,nombre,puesto,rol,rol_principal,estado,usuario:usuarios(id,email,ultimo_acceso)'
    }
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

export async function getUserById(userId) {
  if (!userId) throw new Error('userId es requerido');

  const selectFields = `
      id,
      usuario_id,
      email,
      nombre_completo,
      rol_principal,
      telefono,
      puesto,
      estado,
      ultimo_acceso,
      fecha_creacion,
      fecha_actualizacion,
      usuario_areas (
        id,
        area_id,
        rol,
        puede_capturar,
        puede_editar,
        puede_eliminar,
        estado,
        fecha_asignacion,
        areas (
          id,
          nombre,
          clave,
          color_hex,
          parent_area_id,
          nivel,
          path
        )
      )
    `;

  const { data: byProfile, error: byProfileError } = await supabase
    .from('perfiles')
    .select(selectFields)
    .eq('id', userId)
    .maybeSingle();

  if (byProfileError && byProfileError.code !== 'PGRST116') throw byProfileError;

  if (byProfile) {
    return byProfile;
  }

  const { data: byAuth, error: byAuthError } = await supabase
    .from('perfiles')
    .select(selectFields)
    .eq('usuario_id', userId)
    .maybeSingle();

  if (byAuthError && byAuthError.code !== 'PGRST116') throw byAuthError;

  return byAuth ?? null;
}

export async function updateUser(userId, userData) {
  if (!userId) throw new Error('userId es requerido');

  const allowedFields = {
    nombre_completo: userData.nombre_completo,
    rol_principal: userData.rol_principal,
    telefono: userData.telefono,
    puesto: userData.puesto,
    estado: userData.estado
  };

  const updateData = {};
  Object.entries(allowedFields).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value;
    }
  });

  const { data, error } = await supabase
    .from('perfiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteUser(userId) {
  if (!userId) throw new Error('userId es requerido');

  const identifierFields = 'id,usuario_id';

  const { data: profileById, error: profileByIdError } = await supabase
    .from('perfiles')
    .select(identifierFields)
    .eq('id', userId)
    .maybeSingle();

  if (profileByIdError && profileByIdError.code !== 'PGRST116') {
    throw profileByIdError;
  }

  let targetProfile = profileById ?? null;

  if (!targetProfile) {
    const { data: profileByAuth, error: profileByAuthError } = await supabase
      .from('perfiles')
      .select(identifierFields)
      .eq('usuario_id', userId)
      .maybeSingle();

    if (profileByAuthError && profileByAuthError.code !== 'PGRST116') {
      throw profileByAuthError;
    }

    targetProfile = profileByAuth ?? null;
  }

  const profileId = targetProfile?.id ?? null;
  const authUserId = targetProfile?.usuario_id ?? null;

  if (authUserId) {
    await supabase
      .from('usuario_areas')
      .delete()
      .eq('usuario_id', authUserId)
      .catch(() => {});
  }

  let deletedProfile = null;

  if (profileId) {
    const { data, error } = await supabase
      .from('perfiles')
      .delete()
      .eq('id', profileId)
      .select()
      .maybeSingle();

    if (error) throw error;

    deletedProfile = data ?? null;
  } else {
    const { data, error } = await supabase
      .from('perfiles')
      .delete()
      .eq('usuario_id', userId)
      .select()
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    deletedProfile = data ?? null;
  }

  const authIdForDeletion = authUserId ?? (profileId ? null : userId);

  if (authIdForDeletion) {
    try {
      await supabase.auth.admin.deleteUser(authIdForDeletion);
    } catch (adminError) {
      const message = adminError?.message ?? '';
      if (!/service role|admin access/i.test(message)) {
        throw adminError;
      }
    }
  }

  return deletedProfile;
}

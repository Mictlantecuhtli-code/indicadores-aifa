import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?bundle&target=es2022';

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

export async function signInWithEmail({ email, password }) {
  // 1. Autenticar con Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
    email, 
    password 
  });
  
  if (authError) throw authError;
  
  const userId = authData.user.id;
  
  // 2. Obtener perfil del usuario
  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, puesto, rol_principal')
    .eq('id', userId)
    .single();
  
  if (perfilError) {
    console.error('Error obteniendo perfil:', perfilError);
    throw new Error('No se pudo obtener el perfil del usuario');
  }
  
  // 3. Obtener áreas y permisos del usuario
  const { data: usuariosAreas, error: areasError } = await supabase
    .from('usuario_areas')
    .select('rol, puede_capturar, puede_editar, puede_eliminar, estado, areas(id, nombre)')
    .eq('id', userId)
    .eq('estado', 'ACTIVO');
  
  if (areasError) {
    console.error('Error obteniendo áreas:', areasError);
  }
  
  // 4. Consolidar información del usuario
  const userData = {
    user: authData.user,
    perfil: {
      id: perfil.id,
      nombre_completo: perfil.nombre_completo,
      puesto: perfil.puesto,
      rol_principal: perfil.rol_principal,
      email: authData.user.email
    },
    areas: usuariosAreas || [],
    permisos: {
      puede_capturar: usuariosAreas?.some(ua => ua.puede_capturar) || false,
      puede_editar: usuariosAreas?.some(ua => ua.puede_editar) || false,
      puede_eliminar: usuariosAreas?.some(ua => ua.puede_eliminar) || false
    }
  };
  
  return { data: userData };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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

export async function getIndicatorHistory(indicadorId, { limit = 24, year } = {}) {
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
    let query = supabase
      .from(relation)
      .select('*')
      .eq('indicador_id', indicadorId);
    
    // Filtrar por año si se proporciona
    if (year) {
      query = query.eq('anio', year);
    }
    
    const { data, error } = await query
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
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
  // ============================================
// FUNCIONES PARA ADMINISTRACIÓN DE USUARIOS
// ============================================

/**
 * Obtener todos los usuarios con su perfil y áreas
 */
export async function getAllUsers() {
  // 1. Obtener perfiles
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, puesto, rol_principal, email, telefono, estado')
    .order('nombre_completo', { ascending: true });

  if (perfilesError) throw perfilesError;

  // 2. Obtener áreas asignadas por usuario
  const { data: usuariosAreas, error: areasError } = await supabase
    .from('usuario_areas')
    .select(`
      usuario_id,
      rol,
      puede_capturar,
      puede_editar,
      puede_eliminar,
      estado,
      areas(id, nombre)
    `)
    .eq('estado', 'ACTIVO');

  if (areasError) {
    console.error('Error obteniendo áreas:', areasError);
  }

  // 3. Combinar información
  const usuarios = perfiles.map(perfil => {
    const areasUsuario = (usuariosAreas || []).filter(ua => ua.usuario_id === perfil.id);
    return {
      ...perfil,
      areas: areasUsuario,
      areas_count: areasUsuario.length,
      permisos: {
        puede_capturar: areasUsuario.some(ua => ua.puede_capturar),
        puede_editar: areasUsuario.some(ua => ua.puede_editar),
        puede_eliminar: areasUsuario.some(ua => ua.puede_eliminar)
      }
    };
  });

  return usuarios;
}

/**
 * Crear nuevo usuario
 */
export async function createUser({ email, password, nombre_completo, puesto, rol_principal, telefono }) {
  // 1. Crear usuario en Supabase Auth (requiere permisos de admin)
  // NOTA: Esto normalmente se hace desde una función del servidor (Edge Function)
  // Por ahora solo creamos el perfil, el admin debe crear el usuario Auth manualmente
  
  const { data, error } = await supabase
    .from('perfiles')
    .insert({
      email,
      nombre_completo,
      puesto,
      rol_principal,
      telefono,
      estado: 'ACTIVO'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualizar usuario
 */
export async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('perfiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Desactivar usuario
 */
export async function deactivateUser(userId) {
  const { data, error } = await supabase
    .from('perfiles')
    .update({ estado: 'INACTIVO' })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Asignar área a usuario
 */
export async function assignUserToArea({ 
  usuario_id, 
  area_id, 
  rol, 
  puede_capturar = false, 
  puede_editar = false, 
  puede_eliminar = false 
}) {
  const { data, error } = await supabase
    .from('usuario_areas')
    .insert({
      usuario_id,
      area_id,
      rol,
      puede_capturar,
      puede_editar,
      puede_eliminar,
      estado: 'ACTIVO'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualizar permisos de usuario en área
 */
export async function updateUserAreaPermissions(id, permissions) {
  const { data, error } = await supabase
    .from('usuario_areas')
    .update(permissions)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remover usuario de área
 */
export async function removeUserFromArea(usuario_id, area_id) {
  const { data, error } = await supabase
    .from('usuario_areas')
    .update({ estado: 'INACTIVO' })
    .eq('usuario_id', usuario_id)
    .eq('area_id', area_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtener áreas donde el usuario puede capturar
 */
// En supabaseClient.js, agrega estas funciones:

export async function getUserCaptureAreas(userId, userRole) {
  console.log('getUserCaptureAreas llamada con:', { userId, userRole });
  
  try {
    // Si es administrador, devolver todas las áreas
      const esAdmin = userRole?.toLowerCase().includes('admin');
      console.log('¿Es admin?', esAdmin, { userRole });
      
      if (esAdmin) {
      const { data, error } = await supabase
        .from('areas')
        .select('*, indicadores:indicadores(count)')
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(area => ({
        area_id: area.id,
        areas: area,
        puede_capturar: true
      }));
    }
    
    // Para usuarios normales, buscar en usuario_areas
    const { data, error } = await supabase
      .from('usuario_areas')
      .select('*, areas:area_id(*)')
      .eq('usuario_id', userId)
      .eq('puede_capturar', true)
      .order('areas(nombre)', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error en getUserCaptureAreas:', error);
    throw error;
  }
}
  /**
 * Obtener indicadores que el usuario puede capturar según sus áreas asignadas
 */

export async function getIndicatorsByUserAreas(userId, userRole) {
  console.log('getIndicatorsByUserAreas llamada con:', { userId, userRole });
  
  try {
    // Si es administrador, devolver todos los indicadores
    const esAdmin = userRole?.toLowerCase().includes('admin');
    console.log('getIndicatorsByUserAreas - ¿Es admin?', esAdmin, { userRole });

    if (esAdmin) {
      const { data, error } = await supabase
        .from('indicadores')
        .select('*, areas:area_id(*)')
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
    
    // Para usuarios normales, obtener sus áreas primero
    const { data: userAreas, error: areasError } = await supabase
      .from('usuario_areas')
      .select('area_id')
      .eq('usuario_id', userId)
      .eq('puede_capturar', true);
    
    if (areasError) throw areasError;
    
    if (!userAreas || userAreas.length === 0) {
      return [];
    }
    
    const areaIds = userAreas.map(ua => ua.area_id);
    
    // Obtener indicadores de esas áreas
    const { data, error } = await supabase
      .from('indicadores')
      .select('*, areas:area_id(*)')
      .in('area_id', areaIds)
      .order('nombre', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error en getIndicatorsByUserAreas:', error);
    throw error;
  }
}

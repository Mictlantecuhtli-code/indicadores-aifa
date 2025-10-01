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

/**
 * Obtiene un usuario por su ID con sus áreas asignadas
 */
export async function getUserById(userId) {
  if (!userId) throw new Error('userId es requerido');

  // Intentar obtener el perfil con sus áreas
  const { data: profile, error: profileError } = await supabase
    .from('perfiles')
    .select(`
      id,
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
    `)
    .eq('id', userId)
    .eq('usuario_areas.estado', 'ACTIVO')
    .single();

  if (profileError) {
    // Si no existe en perfiles, buscar en auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    if (authError) throw authError;
    
    // Retornar estructura básica si solo existe en auth
    return {
      id: authUser.id,
      email: authUser.email,
      nombre_completo: authUser.user_metadata?.full_name ?? authUser.email,
      rol_principal: null,
      telefono: null,
      puesto: null,
      estado: 'ACTIVO',
      usuario_areas: []
    };
  }

  return profile;
}

/**
 * Obtiene todas las áreas con su jerarquía completa
 */
export async function getAreaHierarchy() {
  const { data, error } = await supabase
    .from('areas')
    .select('id, nombre, clave, color_hex, parent_area_id, nivel, path, orden_visualizacion, estado')
    .eq('estado', 'ACTIVO')
    .order('path', { ascending: true });

  if (error) throw error;

  return data ?? [];
}

/**
 * Obtiene las áreas asignadas a un usuario con permisos
 */
export async function getUserAreas(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('usuario_areas')
    .select(`
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
    `)
    .eq('usuario_id', userId)
    .eq('estado', 'ACTIVO');

  if (error) throw error;

  return data ?? [];
}

/**
 * Obtiene las áreas que el usuario actual puede gestionar según su rol
 */
export async function getEditableAreasForUser(currentUserId) {
  if (!currentUserId) return [];

  // Obtener el perfil del usuario actual con sus áreas
  const currentUser = await getUserById(currentUserId);
  
  if (!currentUser) return [];

  // Si es ADMIN, puede editar todas las áreas
  if (currentUser.rol_principal === 'ADMIN') {
    return getAreaHierarchy();
  }

  // Obtener todas las áreas para construir el árbol
  const allAreas = await getAreaHierarchy();
  const userAreas = currentUser.usuario_areas || [];

  // Si no tiene áreas asignadas, no puede editar nada
  if (userAreas.length === 0) return [];

  const editableAreaIds = new Set();

  userAreas.forEach(userArea => {
    const area = userArea.areas;
    if (!area) return;

    const rol = userArea.rol || currentUser.rol_principal;

    switch (rol) {
      case 'DIRECTOR':
        // Puede editar su área y todas las subáreas
        editableAreaIds.add(area.id);
        // Agregar todas las áreas que son descendientes (usando path)
        allAreas.forEach(a => {
          if (a.path && area.path && a.path.startsWith(area.path + '.')) {
            editableAreaIds.add(a.id);
          }
        });
        break;

      case 'SUBDIRECTOR':
        // Puede editar su subdirección y gerencias debajo
        editableAreaIds.add(area.id);
        allAreas.forEach(a => {
          if (a.path && area.path && a.path.startsWith(area.path + '.')) {
            editableAreaIds.add(a.id);
          }
        });
        break;

      case 'CAPTURISTA':
        // No puede editar áreas (solo puede capturar en gerencias)
        break;

      default:
        break;
    }
  });

  // Filtrar solo las áreas editables
  return allAreas.filter(area => editableAreaIds.has(area.id));
}

/**
 * Actualiza los datos básicos de un usuario
 */
/**export async function updateUser(userId, userData) {
  if (!userId) throw new Error('userId es requerido');

  const allowedFields = {
    nombre_completo: userData.nombre_completo,
    rol_principal: userData.rol_principal,
    telefono: userData.telefono,
    puesto: userData.puesto,
    estado: userData.estado
  };

  // Filtrar solo los campos que vienen en userData
  const updateData = {};
  Object.keys(allowedFields).forEach(key => {
    if (allowedFields[key] !== undefined) {
      updateData[key] = allowedFields[key];
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
}*/

/**
 * Asigna un área a un usuario con permisos específicos
 */
export async function addUserArea(userId, areaAssignment) {
  if (!userId) throw new Error('userId es requerido');
  if (!areaAssignment.area_id) throw new Error('area_id es requerido');

  // Obtener usuario actual
  let currentUserId = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    currentUserId = user?.id || null;
  } catch (error) {
    console.warn('No se pudo obtener usuario actual:', error);
  }

  // 1. Verificar si ya existe una asignación (activa o inactiva)
  const { data: existing, error: checkError } = await supabase
    .from('usuario_areas')
    .select('id, estado')
    .eq('usuario_id', userId)
    .eq('area_id', areaAssignment.area_id)
    .maybeSingle();

  if (checkError) {
    console.error('Error verificando área existente:', checkError);
  }

  // 2. Si existe, actualizarla en lugar de insertar
  if (existing) {
    const updates = {
      rol: areaAssignment.rol || null,
      puede_capturar: areaAssignment.puede_capturar ?? false,
      puede_editar: areaAssignment.puede_editar ?? false,
      puede_eliminar: areaAssignment.puede_eliminar ?? false,
      estado: 'ACTIVO', // Reactivar si estaba inactiva
      asignado_por: currentUserId
    };

    const { data, error } = await supabase
      .from('usuario_areas')
      .update(updates)
      .eq('id', existing.id)
      .select(`
        id,
        area_id,
        rol,
        puede_capturar,
        puede_editar,
        puede_eliminar,
        estado,
        areas (
          id,
          nombre,
          clave,
          color_hex,
          nivel
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // 3. Si no existe, insertar nueva
  const payload = {
    usuario_id: userId,
    area_id: areaAssignment.area_id,
    rol: areaAssignment.rol || null,
    puede_capturar: areaAssignment.puede_capturar ?? false,
    puede_editar: areaAssignment.puede_editar ?? false,
    puede_eliminar: areaAssignment.puede_eliminar ?? false,
    estado: 'ACTIVO',
    asignado_por: currentUserId
  };

  const { data, error } = await supabase
    .from('usuario_areas')
    .insert(payload)
    .select(`
      id,
      area_id,
      rol,
      puede_capturar,
      puede_editar,
      puede_eliminar,
      estado,
      areas (
        id,
        nombre,
        clave,
        color_hex,
        nivel
      )
    `)
    .single();

  if (error) throw error;

  return data;
}

/**
 * Actualiza los permisos de un área asignada a un usuario
 */
export async function updateUserArea(userId, areaId, updates) {
  if (!userId || !areaId) throw new Error('userId y areaId son requeridos');

  const allowedUpdates = {
    rol: updates.rol,
    puede_capturar: updates.puede_capturar,
    puede_editar: updates.puede_editar,
    puede_eliminar: updates.puede_eliminar,
    estado: updates.estado
  };

  // Filtrar solo los campos que vienen en updates
  const updateData = {};
  Object.keys(allowedUpdates).forEach(key => {
    if (allowedUpdates[key] !== undefined) {
      updateData[key] = allowedUpdates[key];
    }
  });

  const { data, error } = await supabase
    .from('usuario_areas')
    .update(updateData)
    .eq('usuario_id', userId)
    .eq('area_id', areaId)
    .select(`
      id,
      area_id,
      rol,
      puede_capturar,
      puede_editar,
      puede_eliminar,
      estado,
      areas (
        id,
        nombre,
        clave,
        color_hex,
        nivel
      )
    `)
    .single();

  if (error) throw error;

  return data;
}

/**
 * Elimina la asignación de un área a un usuario (soft delete)
 */
export async function removeUserArea(userId, areaId) {
  if (!userId || !areaId) throw new Error('userId y areaId son requeridos');

  // Soft delete: cambiar estado a INACTIVO
  const { data, error } = await supabase
    .from('usuario_areas')
    .update({ estado: 'INACTIVO' })
    .eq('usuario_id', userId)
    .eq('area_id', areaId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Elimina TODAS las áreas asignadas a un usuario (dejar sin asignar)
 */
export async function removeAllUserAreas(userId) {
  if (!userId) throw new Error('userId es requerido');

  const { data, error } = await supabase
    .from('usuario_areas')
    .update({ estado: 'INACTIVO' })
    .eq('usuario_id', userId)
    .eq('estado', 'ACTIVO')
    .select();

  if (error) throw error;

  return data;
}

/**
 * Reemplaza todas las áreas de un usuario con una nueva lista
 */
export async function replaceUserAreas(userId, newAreas) {
  if (!userId) throw new Error('userId es requerido');

  // Primero, desactivar todas las áreas actuales
  await removeAllUserAreas(userId);

  // Luego, agregar las nuevas áreas
  const results = [];
  for (const areaAssignment of newAreas) {
    try {
      const result = await addUserArea(userId, areaAssignment);
      results.push(result);
    } catch (error) {
      console.error(`Error asignando área ${areaAssignment.area_id}:`, error);
      // Continuar con las demás áreas
    }
  }

  return results;
}
/**
 * Verifica si el usuario actual puede editar a otro usuario
 */
export async function canUserEditUser(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) return false;

  // Un usuario no puede editarse a sí mismo (cambiar su propio rol)
  if (currentUserId === targetUserId) return false;

  const currentUser = await getUserById(currentUserId);
  if (!currentUser) return false;

  // ADMIN puede editar a todos
  if (currentUser.rol_principal === 'ADMIN') return true;

  const targetUser = await getUserById(targetUserId);
  if (!targetUser) return false;

  // No se puede editar a un ADMIN
  if (targetUser.rol_principal === 'ADMIN') return false;

  const currentUserAreas = currentUser.usuario_areas || [];
  const targetUserAreas = targetUser.usuario_areas || [];

  // Si el usuario objetivo no tiene áreas, solo ADMIN puede editarlo
  if (targetUserAreas.length === 0) return false;

  // DIRECTOR puede editar usuarios en su jerarquía
  if (currentUser.rol_principal === 'DIRECTOR') {
    return targetUserAreas.some(targetArea => {
      return currentUserAreas.some(currentArea => {
        const currentPath = currentArea.areas?.path || '';
        const targetPath = targetArea.areas?.path || '';
        // El target debe estar en la jerarquía del current
        return targetPath.startsWith(currentPath);
      });
    });
  }

  // SUBDIRECTOR puede editar usuarios en su subdirección
  if (currentUser.rol_principal === 'SUBDIRECTOR') {
    return targetUserAreas.some(targetArea => {
      return currentUserAreas.some(currentArea => {
        const currentPath = currentArea.areas?.path || '';
        const targetPath = targetArea.areas?.path || '';
        // El target debe estar en la jerarquía del current
        return targetPath.startsWith(currentPath);
      });
    });
  }

  // CAPTURISTA no puede editar usuarios
  return false;
}

/**
 * Verifica si el usuario actual puede asignar un área específica
 */
export async function canUserAssignArea(currentUserId, areaId) {
  if (!currentUserId || !areaId) return false;

  const currentUser = await getUserById(currentUserId);
  if (!currentUser) return false;

  // ADMIN puede asignar cualquier área
  if (currentUser.rol_principal === 'ADMIN') return true;

  const editableAreas = await getEditableAreasForUser(currentUserId);
  
  return editableAreas.some(area => area.id === areaId);
}

/**
 * Obtiene las áreas donde un usuario puede capturar según su rol
 */
export async function getCapturableAreasForUser(userId) {
  if (!userId) return [];

  const user = await getUserById(userId);
  if (!user) return [];

  // ADMIN puede capturar en todas las áreas
  if (user.rol_principal === 'ADMIN') {
    return getAreaHierarchy();
  }

  const allAreas = await getAreaHierarchy();
  const userAreas = user.usuario_areas || [];

  // Si no tiene áreas asignadas, no puede capturar en ninguna
  if (userAreas.length === 0) return [];

  const capturableAreaIds = new Set();

  userAreas.forEach(userArea => {
    const area = userArea.areas;
    if (!area) return;

    const rol = userArea.rol || user.rol_principal;

    // Verificar si tiene permiso explícito de captura
    if (userArea.puede_capturar) {
      capturableAreaIds.add(area.id);
    }

    switch (rol) {
      case 'DIRECTOR':
        // Puede capturar en su área y todas las subáreas
        capturableAreaIds.add(area.id);
        allAreas.forEach(a => {
          if (a.path && area.path && a.path.startsWith(area.path + '.')) {
            capturableAreaIds.add(a.id);
          }
        });
        break;

      case 'SUBDIRECTOR':
        // Puede capturar en su subdirección y gerencias
        capturableAreaIds.add(area.id);
        allAreas.forEach(a => {
          if (a.path && area.path && a.path.startsWith(area.path + '.')) {
            capturableAreaIds.add(a.id);
          }
        });
        break;

      case 'CAPTURISTA':
        // Solo puede capturar en gerencias (nivel 3 o mayor)
        if (area.nivel >= 3) {
          capturableAreaIds.add(area.id);
        }
        // También en áreas donde tiene permiso explícito
        if (userArea.puede_capturar) {
          capturableAreaIds.add(area.id);
        }
        break;

      default:
        break;
    }
  });

  return allAreas.filter(area => capturableAreaIds.has(area.id));
}

/**
 * Obtiene los roles que el usuario actual puede asignar
 */
export async function getAssignableRoles(currentUserId) {
  if (!currentUserId) return [];

  const currentUser = await getUserById(currentUserId);
  if (!currentUser) return [];

  const allRoles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'SUBDIRECTOR', label: 'Subdirector' },
    { value: 'CAPTURISTA', label: 'Capturista' }
  ];

  switch (currentUser.rol_principal) {
    case 'ADMIN':
      // Puede asignar todos los roles
      return allRoles;
    
    case 'DIRECTOR':
      // Puede asignar SUBDIRECTOR y CAPTURISTA
      return allRoles.filter(r => ['SUBDIRECTOR', 'CAPTURISTA'].includes(r.value));
    
    case 'SUBDIRECTOR':
      // Solo puede asignar CAPTURISTA
      return allRoles.filter(r => r.value === 'CAPTURISTA');
    
    case 'CAPTURISTA':
      // No puede asignar roles
      return [];
    
    default:
      return [];
  }
}

/**
 * Valida si una asignación de área es válida según las reglas de negocio
 */
export async function validateAreaAssignment(userId, areaId, rol) {
  if (!userId || !areaId) {
    return { valid: false, error: 'userId y areaId son requeridos' };
  }

  const user = await getUserById(userId);
  if (!user) {
    return { valid: false, error: 'Usuario no encontrado' };
  }

  const allAreas = await getAreaHierarchy();
  const area = allAreas.find(a => a.id === areaId);
  
  if (!area) {
    return { valid: false, error: 'Área no encontrada' };
  }

  // Validar según el rol
  if (rol === 'CAPTURISTA' && area.nivel < 3) {
    return { 
      valid: false, 
      error: 'Los capturistas solo pueden ser asignados a gerencias (nivel 3 o superior)' 
    };
  }

  if (rol === 'SUBDIRECTOR' && area.nivel !== 2) {
    return { 
      valid: false, 
      error: 'Los subdirectores deben ser asignados a subdirecciones (nivel 2)' 
    };
  }

  if (rol === 'DIRECTOR' && area.nivel !== 1) {
    return { 
      valid: false, 
      error: 'Los directores deben ser asignados a direcciones (nivel 1)' 
    };
  }

  return { valid: true };
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

/**
 * Indicadores 2.0 - AIFA
 * Módulo de API - Funciones CRUD con Supabase
 * Maneja todas las operaciones de base de datos con políticas RLS
 */

/**
 * GESTIÓN DE USUARIOS Y PERFILES
 */

/**
 * Obtener todos los usuarios (solo admin)
 * @returns {Promise<Array>} - Lista de usuarios con perfiles
 */
async function getUsers() {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('users') // CORREGIDO: profiles → users
            .select(`
                *,
                roles!rol_id(id, nombre), // CORREGIDO: role:roles(id, name) → roles!rol_id(id, nombre)
                user_areas(
                    areas!area_id(id, nombre) // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                )
            `)
            .order('nombre'); // CORREGIDO: display_name → nombre

        if (error) {
            console.error('Error obteniendo usuarios:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getUsers:', error);
        throw error;
    }
}

/**
 * Crear nuevo usuario (solo admin)
 * @param {Object} userData - Datos del usuario
 * @returns {Promise<Object>} - Usuario creado
 */
async function createUser(userData) {
    try {
        const { email, password, nombre, rol_id } = userData; // CORREGIDO: display_name → nombre, role_id → rol_id

        // Validar email corporativo
        if (!window.supabaseClient.validateAifaEmail(email)) {
            throw new Error('Solo se permiten correos del dominio @aifa.aero');
        }

        // Crear usuario en auth
        const { data: authData, error: authError } = await window.supabaseClient.supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (authError) {
            console.error('Error creando usuario en auth:', authError);
            throw authError;
        }

        // Crear perfil en tabla users
        const { data: profile, error: profileError } = await window.supabaseClient.supabase
            .from('users') // CORREGIDO: profiles → users
            .insert([
                {
                    id: authData.user.id,
                    email: email,
                    nombre: nombre, // CORREGIDO: display_name → nombre
                    rol_id: rol_id, // CORREGIDO: role_id → rol_id
                    activo: true // CORREGIDO: is_active → activo
                }
            ])
            .select()
            .single();

        if (profileError) {
            console.error('Error creando perfil:', profileError);
            throw profileError;
        }

        return profile;
    } catch (error) {
        console.error('Error en createUser:', error);
        throw error;
    }
}

/**
 * Actualizar usuario existente
 * @param {string} userId - ID del usuario
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Usuario actualizado
 */
async function updateUser(userId, updateData) {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('users') // CORREGIDO: profiles → users
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error actualizando usuario:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en updateUser:', error);
        throw error;
    }
}

/**
 * Desactivar usuario (soft delete)
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function deactivateUser(userId) {
    try {
        const { error } = await window.supabaseClient.supabase
            .from('users') // CORREGIDO: profiles → users
            .update({ activo: false }) // CORREGIDO: is_active → activo
            .eq('id', userId);

        if (error) {
            console.error('Error desactivando usuario:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Error en deactivateUser:', error);
        throw error;
    }
}

/**
 * GESTIÓN DE ÁREAS DE USUARIOS
 */

/**
 * Asignar áreas a un usuario
 * @param {string} userId - ID del usuario
 * @param {Array} areaIds - Array de IDs de áreas
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function assignUserAreas(userId, areaIds) {
    try {
        // Primero eliminar asignaciones existentes
        await window.supabaseClient.supabase
            .from('user_areas')
            .delete()
            .eq('user_id', userId);

        // Insertar nuevas asignaciones
        if (areaIds && areaIds.length > 0) {
            const userAreas = areaIds.map(areaId => ({
                user_id: userId,
                area_id: areaId
            }));

            const { error } = await window.supabaseClient.supabase
                .from('user_areas')
                .insert(userAreas);

            if (error) {
                console.error('Error asignando áreas:', error);
                throw error;
            }
        }

        return true;
    } catch (error) {
        console.error('Error en assignUserAreas:', error);
        throw error;
    }
}
/**
 * GESTIÓN DE ROLES
 */

/**
 * Obtener todos los roles
 * @returns {Promise<Array>} - Lista de roles
 */
async function getRoles() {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('roles')
            .select('*')
            .order('id');

        if (error) {
            console.error('Error obteniendo roles:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getRoles:', error);
        throw error;
    }
}

/**
 * GESTIÓN DE ÁREAS
 */

/**
 * Obtener todas las áreas
 * @returns {Promise<Array>} - Lista de áreas
 */
async function getAreas() {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('areas')
            .select('*')
            .order('nombre'); // CORREGIDO: name → nombre

        if (error) {
            console.error('Error obteniendo áreas:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getAreas:', error);
        throw error;
    }
}

/**
 * Crear nueva área
 * @param {Object} areaData - Datos del área
 * @returns {Promise<Object>} - Área creada
 */
async function createArea(areaData) {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('areas')
            .insert([areaData])
            .select()
            .single();

        if (error) {
            console.error('Error creando área:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en createArea:', error);
        throw error;
    }
}

/**
 * Actualizar área existente
 * @param {number} areaId - ID del área
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Área actualizada
 */
async function updateArea(areaId, updateData) {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('areas')
            .update(updateData)
            .eq('id', areaId)
            .select()
            .single();

        if (error) {
            console.error('Error actualizando área:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en updateArea:', error);
        throw error;
    }
}

/**
 * Eliminar área
 * @param {number} areaId - ID del área
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function deleteArea(areaId) {
    try {
        const { error } = await window.supabaseClient.supabase
            .from('areas')
            .delete()
            .eq('id', areaId);

        if (error) {
            console.error('Error eliminando área:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Error en deleteArea:', error);
        throw error;
    }
}
/**
 * GESTIÓN DE INDICADORES
 */

/**
 * Obtener indicadores según permisos del usuario
 * @param {number} areaId - ID del área (opcional)
 * @returns {Promise<Array>} - Lista de indicadores
 */
async function getIndicators(areaId = null) {
    try {
        let query = window.supabaseClient.supabase
            .from('indicadores') // CORREGIDO: indicators → indicadores
            .select(`
                *,
                areas!area_id(id, nombre), // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                unidades!unidad_id(id, clave, descripcion), // AGREGADO: relación con unidades
                frecuencias!frecuencia_id(id, clave, descripcion) // AGREGADO: relación con frecuencias
            `)
            .order('nombre'); // CORREGIDO: name → nombre

        if (areaId) {
            query = query.eq('area_id', areaId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error obteniendo indicadores:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getIndicators:', error);
        throw error;
    }
}

/**
 * Crear nuevo indicador
 * @param {Object} indicatorData - Datos del indicador
 * @returns {Promise<Object>} - Indicador creado
 */
async function createIndicator(indicatorData) {
    try {
        // Mapear campos del frontend a la estructura de BD real
        const mappedData = {
            clave: indicatorData.code || indicatorData.clave, // CORREGIDO: code → clave
            nombre: indicatorData.name || indicatorData.nombre, // CORREGIDO: name → nombre
            area_id: indicatorData.area_id,
            unidad_id: indicatorData.unit_id || indicatorData.unidad_id, // CORREGIDO: unit → unidad_id
            frecuencia_id: indicatorData.periodicity_id || indicatorData.frecuencia_id, // CORREGIDO: periodicity → frecuencia_id
            objetivo: indicatorData.goal || indicatorData.objetivo, // CORREGIDO: goal → objetivo
            observaciones: indicatorData.notes || indicatorData.observaciones, // CORREGIDO: notes → observaciones
            activo: true
        };

        const { data, error } = await window.supabaseClient.supabase
            .from('indicadores') // CORREGIDO: indicators → indicadores
            .insert([mappedData])
            .select(`
                *,
                areas!area_id(id, nombre), // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                unidades!unidad_id(id, clave, descripcion),
                frecuencias!frecuencia_id(id, clave, descripcion)
            `)
            .single();

        if (error) {
            console.error('Error creando indicador:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en createIndicator:', error);
        throw error;
    }
}

/**
 * Actualizar indicador existente
 * @param {number} indicatorId - ID del indicador
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Indicador actualizado
 */
async function updateIndicator(indicatorId, updateData) {
    try {
        // Mapear campos del frontend a la estructura de BD real
        const mappedData = {};
        
        if (updateData.code !== undefined) mappedData.clave = updateData.code;
        if (updateData.name !== undefined) mappedData.nombre = updateData.name;
        if (updateData.area_id !== undefined) mappedData.area_id = updateData.area_id;
        if (updateData.unit_id !== undefined) mappedData.unidad_id = updateData.unit_id;
        if (updateData.periodicity_id !== undefined) mappedData.frecuencia_id = updateData.periodicity_id;
        if (updateData.goal !== undefined) mappedData.objetivo = updateData.goal;
        if (updateData.notes !== undefined) mappedData.observaciones = updateData.notes;
        if (updateData.active !== undefined) mappedData.activo = updateData.active;

        const { data, error } = await window.supabaseClient.supabase
            .from('indicadores') // CORREGIDO: indicators → indicadores
            .update(mappedData)
            .eq('id', indicatorId)
            .select(`
                *,
                areas!area_id(id, nombre), // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                unidades!unidad_id(id, clave, descripcion),
                frecuencias!frecuencia_id(id, clave, descripcion)
            `)
            .single();

        if (error) {
            console.error('Error actualizando indicador:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en updateIndicator:', error);
        throw error;
    }
}

/**
 * Eliminar indicador
 * @param {number} indicatorId - ID del indicador
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function deleteIndicator(indicatorId) {
    try {
        const { error } = await window.supabaseClient.supabase
            .from('indicadores') // CORREGIDO: indicators → indicadores
            .delete()
            .eq('id', indicatorId);

        if (error) {
            console.error('Error eliminando indicador:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Error en deleteIndicator:', error);
        throw error;
    }
}

/**
 * Obtener unidades disponibles
 * @returns {Promise<Array>} - Lista de unidades
 */
async function getUnidades() {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('unidades')
            .select('*')
            .order('clave');

        if (error) {
            console.error('Error obteniendo unidades:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getUnidades:', error);
        throw error;
    }
}

/**
 * Obtener frecuencias disponibles
 * @returns {Promise<Array>} - Lista de frecuencias
 */
async function getFrecuencias() {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('frecuencias')
            .select('*')
            .order('clave');

        if (error) {
            console.error('Error obteniendo frecuencias:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getFrecuencias:', error);
        throw error;
    }
}
/**
 * GESTIÓN DE MEDICIONES
 */

/**
 * Obtener mediciones con filtros
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Promise<Array>} - Lista de mediciones
 */
async function getMeasurements(filters = {}) {
    try {
        let query = window.supabaseClient.supabase
            .from('indicator_valores') // CORREGIDO: measurements → indicator_valores
            .select(`
                *,
                indicador:indicadores!indicador_id( // CORREGIDO: indicator:indicators → indicador:indicadores!indicador_id
                    id, nombre, clave, objetivo, // CORREGIDO: name, code, unit, goal → nombre, clave, objetivo
                    areas!area_id(id, nombre) // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                ),
                creator:users!created_by(nombre, email) // CORREGIDO: creator:profiles!created_by(display_name, email) → creator:users!created_by(nombre, email)
            `)
            .order('año', { ascending: false }) // CORREGIDO: period_date → año
            .order('mes', { ascending: false }) // AGREGADO: ordenar por mes también
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters.indicatorId) {
            query = query.eq('indicador_id', filters.indicatorId); // CORREGIDO: indicator_id → indicador_id
        }
        if (filters.areaId) {
            query = query.eq('indicador.area_id', filters.areaId); // CORREGIDO: indicator.area_id → indicador.area_id
        }
        if (filters.year) {
            query = query.eq('año', filters.year); // CORREGIDO: year → año
        }
        if (filters.month) {
            query = query.eq('mes', filters.month); // CORREGIDO: month → mes
        }
        // ELIMINADO: filtros startDate y endDate ya que usamos año/mes separados

        const { data, error } = await query;

        if (error) {
            console.error('Error obteniendo mediciones:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('Error en getMeasurements:', error);
        throw error;
    }
}

/**
 * Crear nueva medición
 * @param {Object} measurementData - Datos de la medición
 * @returns {Promise<Object>} - Medición creada
 */
async function createMeasurement(measurementData) {
    try {
        // Obtener usuario actual para created_by
        const user = await window.supabaseClient.getCurrentUser();
        if (!user) {
            throw new Error('Usuario no autenticado');
        }

        // Mapear datos del frontend a estructura de BD real
        const dataToInsert = {
            indicador_id: measurementData.indicator_id || measurementData.indicador_id, // CORREGIDO: indicator_id → indicador_id
            año: measurementData.year || measurementData.año, // CORREGIDO: Extraer año de period_date o usar año directo
            mes: measurementData.month || measurementData.mes, // CORREGIDO: Extraer mes de period_date o usar mes directo
            valor_num: measurementData.value_num || measurementData.valor_num, // CORREGIDO: Mantener valor_num
            estado: measurementData.estado || 'activo', // AGREGADO: estado por defecto
            fuente: measurementData.source || measurementData.fuente, // CORREGIDO: source → fuente
            created_by: user.id,
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient.supabase
            .from('indicator_valores') // CORREGIDO: measurements → indicator_valores
            .insert([dataToInsert])
            .select(`
                *,
                indicador:indicadores!indicador_id( // CORREGIDO: indicator:indicators → indicador:indicadores!indicador_id
                    id, nombre, clave, objetivo, // CORREGIDO: name, code, unit, goal → nombre, clave, objetivo
                    areas!area_id(id, nombre) // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                ),
                creator:users!created_by(nombre, email) // CORREGIDO: creator:profiles!created_by(display_name, email) → creator:users!created_by(nombre, email)
            `)
            .single();

        if (error) {
            console.error('Error creando medición:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en createMeasurement:', error);
        throw error;
    }
}

/**
 * Actualizar medición existente
 * @param {number} measurementId - ID de la medición
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Medición actualizada
 */
async function updateMeasurement(measurementId, updateData) {
    try {
        // Mapear datos del frontend a estructura de BD real
        const dataToUpdate = {
            updated_at: new Date().toISOString()
        };

        if (updateData.valor_num !== undefined) dataToUpdate.valor_num = updateData.valor_num;
        if (updateData.fuente !== undefined) dataToUpdate.fuente = updateData.fuente;
        if (updateData.estado !== undefined) dataToUpdate.estado = updateData.estado;
        if (updateData.año !== undefined) dataToUpdate.año = updateData.año;
        if (updateData.mes !== undefined) dataToUpdate.mes = updateData.mes;

        const { data, error } = await window.supabaseClient.supabase
            .from('indicator_valores') // CORREGIDO: measurements → indicator_valores
            .update(dataToUpdate)
            .eq('id', measurementId)
            .select(`
                *,
                indicador:indicadores!indicador_id( // CORREGIDO: indicator:indicators → indicador:indicadores!indicador_id
                    id, nombre, clave, objetivo, // CORREGIDO: name, code, unit, goal → nombre, clave, objetivo
                    areas!area_id(id, nombre) // CORREGIDO: area:areas(id, name, code) → areas!area_id(id, nombre)
                ),
                creator:users!created_by(nombre, email) // CORREGIDO: creator:profiles!created_by(display_name, email) → creator:users!created_by(nombre, email)
            `)
            .single();

        if (error) {
            console.error('Error actualizando medición:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error en updateMeasurement:', error);
        throw error;
    }
}

/**
 * Eliminar medición
 * @param {number} measurementId - ID de la medición
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function deleteMeasurement(measurementId) {
    try {
        const { error } = await window.supabaseClient.supabase
            .from('indicator_valores') // CORREGIDO: measurements → indicator_valores
            .delete()
            .eq('id', measurementId);

        if (error) {
            console.error('Error eliminando medición:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Error en deleteMeasurement:', error);
        throw error;
    }
}

/**
 * FUNCIONES DE ESTADÍSTICAS Y REPORTES
 */

/**
 * Obtener datos para histograma comparativo
 * @param {number} indicatorId - ID del indicador
 * @param {number} yearA - Primer año a comparar
 * @param {number} yearB - Segundo año a comparar
 * @returns {Promise<Object>} - Datos para gráfica
 */
async function getHistogramData(indicatorId, yearA, yearB) {
    try {
        const { data, error } = await window.supabaseClient.supabase
            .from('indicator_valores') // CORREGIDO: v_medicion → indicator_valores (usar tabla directa)
            .select('año, mes, valor_num') // CORREGIDO: year, month, value_num → año, mes, valor_num
            .eq('indicador_id', indicatorId) // CORREGIDO: indicator_id → indicador_id
            .in('año', [yearA, yearB]) // CORREGIDO: year → año
            .order('mes'); // CORREGIDO: month → mes

        if (error) {
            console.error('Error obteniendo datos para histograma:', error);
            throw error;
        }

        // Procesar datos para Chart.js
        const processedData = {
            yearA: Array(12).fill(0),
            yearB: Array(12).fill(0),
            labels: [
                'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
            ]
        };

        data.forEach(record => {
            const monthIndex = record.mes - 1; // CORREGIDO: month → mes
            if (record.año === yearA) { // CORREGIDO: year → año
                processedData.yearA[monthIndex] = record.valor_num || 0; // CORREGIDO: value_num → valor_num
            } else if (record.año === yearB) { // CORREGIDO: year → año
                processedData.yearB[monthIndex] = record.valor_num || 0; // CORREGIDO: value_num → valor_num
            }
        });

        return processedData;
    } catch (error) {
        console.error('Error en getHistogramData:', error);
        throw error;
    }
}

/**
 * Obtener estadísticas de dashboard
 * @returns {Promise<Object>} - Estadísticas generales
 */
async function getDashboardStats() {
    try {
        // Obtener áreas del usuario
        const userAreas = await window.supabaseClient.getUserAreas();
        const areaIds = userAreas.map(area => area.id);

        // Estadísticas básicas
        const [indicatorsData, measurementsData] = await Promise.all([
            // Total de indicadores
            window.supabaseClient.supabase
                .from('indicadores') // CORREGIDO: indicators → indicadores
                .select('id', { count: 'exact' })
                .in('area_id', areaIds),
            
            // Mediciones del mes actual
            window.supabaseClient.supabase
                .from('indicator_valores') // CORREGIDO: measurements → indicator_valores
                .select('id', { count: 'exact' })
                .eq('año', new Date().getFullYear()) // CORREGIDO: usar año actual en lugar de period_date
                .eq('mes', new Date().getMonth() + 1) // CORREGIDO: usar mes actual
                .in('indicador.area_id', areaIds) // CORREGIDO: indicator.area_id → indicador.area_id
        ]);

        return {
            totalIndicators: indicatorsData.count || 0,
            monthlyMeasurements: measurementsData.count || 0,
            userAreas: userAreas.length
        };
    } catch (error) {
        console.error('Error en getDashboardStats:', error);
        return {
            totalIndicators: 0,
            monthlyMeasurements: 0,
            userAreas: 0
        };
    }
}

// Exportar funciones para uso global
window.api = {
    // Usuarios
    getUsers,
    createUser,
    updateUser,
    deactivateUser,
    assignUserAreas,
    
    // Roles
    getRoles,
    
    // Áreas
    getAreas,
    createArea,
    updateArea,
    deleteArea,
    
    // Indicadores
    getIndicators,
    createIndicator,
    updateIndicator,
    deleteIndicator,
    getUnidades, // AGREGADO: función para unidades
    getFrecuencias, // AGREGADO: función para frecuencias
    
    // Mediciones
    getMeasurements,
    createMeasurement,
    updateMeasurement,
    deleteMeasurement,
    
    // Estadísticas
    getHistogramData,
    getDashboardStats
};

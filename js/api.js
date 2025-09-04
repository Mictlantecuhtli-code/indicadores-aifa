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
            .from('profiles')
            .select(`
                *,
                role:roles(id, name),
                user_areas(
                    area:areas(id, name, code)
                )
            `)
            .order('display_name');

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
        const { email, password, display_name, role_id } = userData;

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

        // Crear perfil
        const { data: profile, error: profileError } = await window.supabaseClient.supabase
            .from('profiles')
            .insert([
                {
                    id: authData.user.id,
                    email: email,
                    display_name: display_name,
                    role_id: role_id,
                    is_active: true
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
            .from('profiles')
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
            .from('profiles')
            .update({ is_active: false })
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
            .order('name');

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
            .from('indicators')
            .select(`
                *,
                area:areas(id, name, code)
            `)
            .order('name');

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
        const { data, error } = await window.supabaseClient.supabase
            .from('indicators')
            .insert([indicatorData])
            .select(`
                *,
                area:areas(id, name, code)
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
        const { data, error } = await window.supabaseClient.supabase
            .from('indicators')
            .update(updateData)
            .eq('id', indicatorId)
            .select(`
                *,
                area:areas(id, name, code)
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
            .from('indicators')
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
            .from('measurements')
            .select(`
                *,
                indicator:indicators(
                    id, name, code, unit, goal,
                    area:areas(id, name, code)
                ),
                creator:profiles!created_by(display_name, email)
            `)
            .order('period_date', { ascending: false })
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters.indicatorId) {
            query = query.eq('indicator_id', filters.indicatorId);
        }
        if (filters.areaId) {
            query = query.eq('indicator.area_id', filters.areaId);
        }
        if (filters.startDate) {
            query = query.gte('period_date', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('period_date', filters.endDate);
        }
        if (filters.year) {
            query = query.eq('year', filters.year);
        }
        if (filters.month) {
            query = query.eq('month', filters.month);
        }

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

        // Preparar datos con created_by
        const dataToInsert = {
            ...measurementData,
            created_by: user.id,
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient.supabase
            .from('measurements')
            .insert([dataToInsert])
            .select(`
                *,
                indicator:indicators(
                    id, name, code, unit, goal,
                    area:areas(id, name, code)
                ),
                creator:profiles!created_by(display_name, email)
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
        // Agregar timestamp de actualización
        const dataToUpdate = {
            ...updateData,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient.supabase
            .from('measurements')
            .update(dataToUpdate)
            .eq('id', measurementId)
            .select(`
                *,
                indicator:indicators(
                    id, name, code, unit, goal,
                    area:areas(id, name, code)
                ),
                creator:profiles!created_by(display_name, email)
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
            .from('measurements')
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
            .from('v_medicion')
            .select('*')
            .eq('indicator_id', indicatorId)
            .in('year', [yearA, yearB])
            .order('month');

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
            const monthIndex = record.month - 1;
            if (record.year === yearA) {
                processedData.yearA[monthIndex] = record.value_num || 0;
            } else if (record.year === yearB) {
                processedData.yearB[monthIndex] = record.value_num || 0;
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
                .from('indicators')
                .select('id', { count: 'exact' })
                .in('area_id', areaIds),
            
            // Mediciones del mes actual
            window.supabaseClient.supabase
                .from('measurements')
                .select('id', { count: 'exact' })
                .gte('period_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
                .in('indicator.area_id', areaIds)
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
    
    // Mediciones
    getMeasurements,
    createMeasurement,
    updateMeasurement,
    deleteMeasurement,
    
    // Estadísticas
    getHistogramData,
    getDashboardStats
};

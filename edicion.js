/**
 * edicion.js - Lógica de Edición de Datos
 * Sistema de Indicadores AIFA 2.0
 * 
 * Maneja la edición, eliminación y restauración de valores
 * Solo para usuarios con rol >= jefe_area
 */

// Variables globales
let currentUser = null;
let userRole = null;
let userAreas = [];
let currentData = [];
let selectedRows = new Set();
let currentPage = 1;
let pageSize = 25;
let totalRecords = 0;
let currentSort = { column: 'fecha', direction: 'desc' };
let currentFilters = {};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserInfo();
    await loadFiltersData();
    await loadData();
    setupEventListeners();
});

/**
 * Verificar autenticación y permisos
 */
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        location.href = './login.html';
        return;
    }
    currentUser = session.user;

    // Verificar permisos de edición
    const hasPermission = await checkEditPermissions();
    if (!hasPermission) {
        await notify('No tiene permisos para acceder a esta sección', 'error');
        location.href = './index.html';
        return;
    }
}

/**
 * Verificar permisos de edición
 */
async function checkEditPermissions() {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('roles(nombre)')
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;

        const role = userData.roles.nombre;
        return ['jefe_area', 'subdirector', 'director', 'admin'].includes(role);
    } catch (error) {
        console.error('Error verificando permisos:', error);
        return false;
    }
}

/**
 * Cargar información del usuario
 */
async function loadUserInfo() {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select(`
                id, username, nombre, activo,
                roles(nombre),
                user_areas(areas(id, nombre))
            `)
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;

        if (!userData.activo) {
            await notify('Tu cuenta está desactivada. Contacta al administrador.', 'error');
            await supabase.auth.signOut();
            location.href = './login.html';
            return;
        }

        userRole = userData.roles.nombre;
        userAreas = userData.user_areas.map(ua => ua.areas);

        // Actualizar información en la interfaz
        document.getElementById('userName').textContent = userData.nombre || userData.username;
        document.getElementById('userRole').textContent = userRole;

        const areasText = userAreas.map(area => area.nombre).join(', ');
        document.getElementById('userAreas').textContent = areasText || 'Todas';

        // Mostrar permisos específicos
        const permissions = getEditPermissions(userRole);
        document.getElementById('editPermissions').textContent = permissions;

    } catch (error) {
        console.error('Error cargando información del usuario:', error);
        await notify('Error cargando información del usuario', 'error');
    }
}

/**
 * Obtener descripción de permisos de edición
 */
function getEditPermissions(role) {
    switch (role) {
        case 'admin':
            return 'Todos los datos del sistema';
        case 'director':
            return 'Todos los indicadores';
        case 'subdirector':
            return 'Indicadores de múltiples áreas';
        case 'jefe_area':
            return 'Indicadores de su área';
        default:
            return 'Sin permisos de edición';
    }
}

/**
 * Cargar datos para filtros
 */
async function loadFiltersData() {
    try {
        // Cargar áreas (según permisos del usuario)
        await loadAreasFilter();
        
        // Cargar indicadores
        await loadIndicadoresFilter();
        
        // Cargar años
        await loadAniosFilter();

    } catch (error) {
        console.error('Error cargando datos de filtros:', error);
        await notify('Error cargando filtros', 'error');
    }
}

/**
 * Cargar áreas para filtro
 */
async function loadAreasFilter() {
    const areaFilter = document.getElementById('areaFilter');
    areaFilter.innerHTML = '<option value="">Todas las áreas</option>';

    // Si es admin o director, puede ver todas las áreas
    let query = supabase.from('areas').select('id, nombre').eq('activo', true);
    
    // Si no es admin/director, limitar a sus áreas
    if (!['admin', 'director'].includes(userRole) && userAreas.length > 0) {
        const areaIds = userAreas.map(area => area.id);
        query = query.in('id', areaIds);
    }

    const { data, error } = await query.order('nombre');
    
    if (error) throw error;

    data.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.nombre;
        areaFilter.appendChild(option);
    });
}

/**
 * Cargar indicadores para filtro
 */
async function loadIndicadoresFilter() {
    const indicadorFilter = document.getElementById('indicadorFilter');
    indicadorFilter.innerHTML = '<option value="">Todos los indicadores</option>';

    let query = supabase
        .from('indicadores')
        .select('id, clave, nombre, area_id, areas(nombre)')
        .eq('activo', true);

    // Limitar por áreas si no es admin/director
    if (!['admin', 'director'].includes(userRole) && userAreas.length > 0) {
        const areaIds = userAreas.map(area => area.id);
        query = query.in('area_id', areaIds);
    }

    const { data, error } = await query.order('areas(nombre), nombre');
    
    if (error) throw error;

    let currentArea = '';
    data.forEach(indicador => {
        if (indicador.areas.nombre !== currentArea) {
            if (currentArea) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─────────────────';
                indicadorFilter.appendChild(separator);
            }
            currentArea = indicador.areas.nombre;
            
            const header = document.createElement('option');
            header.disabled = true;
            header.textContent = `── ${currentArea} ──`;
            header.style.fontWeight = 'bold';
            indicadorFilter.appendChild(header);
        }

        const option = document.createElement('option');
        option.value = indicador.id;
        option.textContent = `${indicador.clave} - ${indicador.nombre}`;
        indicadorFilter.appendChild(option);
    });
}
/**
 * Cargar años para filtro
 */
async function loadAniosFilter() {
    const anioFilter = document.getElementById('anioFilter');
    anioFilter.innerHTML = '<option value="">Todos los años</option>';

    const { data, error } = await supabase
        .from('indicador_valores')
        .select('anio')
        .order('anio', { ascending: false });

    if (error) throw error;

    const uniqueYears = [...new Set(data.map(row => row.anio))];
    uniqueYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        anioFilter.appendChild(option);
    });
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.href = './login.html';
    });

    // Filtros
    document.getElementById('buscarBtn').addEventListener('click', applyFilters);
    document.getElementById('limpiarFiltrosBtn').addEventListener('click', clearFilters);
    
    // Filtros con búsqueda automática
    document.getElementById('areaFilter').addEventListener('change', () => {
        loadIndicadoresFilter(); // Recargar indicadores según área
        applyFilters();
    });

    // Tabla
    document.getElementById('selectAll').addEventListener('change', toggleSelectAll);
    document.getElementById('refreshBtn').addEventListener('click', () => loadData());
    document.getElementById('exportBtn').addEventListener('click', exportData);

    // Paginación
    document.getElementById('firstPageBtn').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPageBtn').addEventListener('click', () => goToPage(Math.ceil(totalRecords / pageSize)));
    document.getElementById('pageSizeSelect').addEventListener('change', changePageSize);

    // Acciones masivas
    document.getElementById('bulkEditBtn').addEventListener('click', bulkEdit);
    document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
    document.getElementById('bulkRestoreBtn').addEventListener('click', bulkRestore);
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);

    // Modales
    document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    
    document.getElementById('closeConfirmModalBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('cancelConfirmBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmActionBtn').addEventListener('click', executeConfirmedAction);

    // Contador de caracteres en modal de edición
    document.getElementById('editComentario').addEventListener('input', updateEditCommentCounter);

    // Ordenamiento de tabla
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            toggleSort(column);
        });
    });

    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeConfirmModal();
        }
    });
}

/**
 * Cargar datos principales
 */
async function loadData() {
    try {
        showLoading(true);
        clearSelection();

        // Construir query base
        let query = supabase
            .from('indicador_valores')
            .select(`
                id, anio, mes, valor_num, fuente, comentario, estado, deleted_at,
                created_at, updated_at,
                indicadores(id, clave, nombre, areas(id, nombre)),
                users!created_by(nombre, username)
            `, { count: 'exact' });

        // Aplicar filtros de permisos
        query = applyPermissionFilters(query);

        // Aplicar filtros de usuario
        query = applyUserFilters(query);

        // Aplicar ordenamiento
        query = applySorting(query);

        // Aplicar paginación
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        currentData = data || [];
        totalRecords = count || 0;

        populateTable();
        updatePagination();
        updateRecordCount();

    } catch (error) {
        console.error('Error cargando datos:', error);
        await notify('Error cargando datos: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Aplicar filtros de permisos según rol
 */
function applyPermissionFilters(query) {
    // Admin y director pueden ver todo
    if (['admin', 'director'].includes(userRole)) {
        return query;
    }

    // Otros roles solo ven datos de sus áreas
    if (userAreas.length > 0) {
        const areaIds = userAreas.map(area => area.id);
        query = query.in('indicadores.area_id', areaIds);
    }

    return query;
}

/**
 * Aplicar filtros de usuario
 */
function applyUserFilters(query) {
    if (currentFilters.area) {
        query = query.eq('indicadores.area_id', currentFilters.area);
    }

    if (currentFilters.indicador) {
        query = query.eq('indicador_id', currentFilters.indicador);
    }

    if (currentFilters.anio) {
        query = query.eq('anio', currentFilters.anio);
    }

    if (currentFilters.estado) {
        switch (currentFilters.estado) {
            case 'activos':
                query = query.is('deleted_at', null);
                break;
            case 'eliminados':
                query = query.not('deleted_at', 'is', null);
                break;
            case 'pendiente':
            case 'aprobado':
            case 'rechazado':
                query = query.eq('estado', currentFilters.estado);
                break;
        }
    }

    return query;
}

/**
 * Aplicar ordenamiento
 */
function applySorting(query) {
    let orderColumn = currentSort.column;
    const ascending = currentSort.direction === 'asc';

    switch (orderColumn) {
        case 'area':
            return query.order('areas(nombre)', { ascending, foreignTable: 'indicadores' });
        case 'indicador':
            return query.order('nombre', { ascending, foreignTable: 'indicadores' });
        case 'periodo':
            return query.order('anio', { ascending }).order('mes', { ascending });
        case 'valor':
            return query.order('valor_num', { ascending });
        case 'fecha':
            return query.order('created_at', { ascending });
        default:
            return query.order('created_at', { ascending: false });
    }
}

/**
 * Poblar tabla con datos
 */
function populateTable() {
    const tbody = document.getElementById('editTableBody');
    
    if (!currentData || currentData.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="9">
                    <div class="no-data-message">
                        <i class="fas fa-info-circle"></i>
                        No se encontraron datos con los filtros aplicados
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                   'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    tbody.innerHTML = currentData.map(row => {
        const isDeleted = row.deleted_at !== null;
        const periodo = `${meses[row.mes]} ${row.anio}`;
        const fecha = new Date(row.created_at).toLocaleDateString('es-MX');
        const area = row.indicadores?.areas?.nombre || 'N/A';
        const indicador = row.indicadores ? 
            `${row.indicadores.clave} - ${row.indicadores.nombre}` : 'N/A';
        
        const rowClass = isDeleted ? 'deleted-row' : '';
        const estadoBadge = getEstadoBadge(row.estado, isDeleted);
        
        return `
            <tr class="${rowClass}" data-id="${row.id}">
                <td>
                    <input type="checkbox" class="row-checkbox" value="${row.id}"
                           onchange="toggleRowSelection(${row.id})">
                </td>
                <td title="${area}">${truncateText(area, 20)}</td>
                <td title="${indicador}">${truncateText(indicador, 30)}</td>
                <td>${periodo}</td>
                <td class="text-right">${formatNumber(row.valor_num)}</td>
                <td title="${row.fuente || ''}">${truncateText(row.fuente || 'N/A', 20)}</td>
                <td>${estadoBadge}</td>
                <td>${fecha}</td>
                <td>
                    <div class="action-buttons">
                        ${!isDeleted ? `
                            <button class="btn btn-sm btn-primary" onclick="editRow(${row.id})"
                                    title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteRow(${row.id})"
                                    title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-success" onclick="restoreRow(${row.id})"
                                    title="Restaurar">
                                <i class="fas fa-undo"></i>
                            </button>
                        `}
                        <button class="btn btn-sm btn-info" onclick="viewRowDetails(${row.id})"
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Actualizar checkboxes seleccionados
    selectedRows.forEach(id => {
        const checkbox = tbody.querySelector(`input[value="${id}"]`);
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Obtener badge de estado
 */
function getEstadoBadge(estado, isDeleted) {
    if (isDeleted) {
        return '<span class="badge badge-dark">Eliminado</span>';
    }
    
    switch (estado?.toLowerCase()) {
        case 'pendiente':
            return '<span class="badge badge-warning">Pendiente</span>';
        case 'aprobado':
            return '<span class="badge badge-success">Aprobado</span>';
        case 'rechazado':
            return '<span class="badge badge-danger">Rechazado</span>';
        default:
            return '<span class="badge badge-secondary">Sin estado</span>';
    }
}

/**
 * Aplicar filtros
 */
function applyFilters() {
    currentFilters = {
        area: document.getElementById('areaFilter').value,
        indicador: document.getElementById('indicadorFilter').value,
        anio: document.getElementById('anioFilter').value,
        estado: document.getElementById('estadoFilter').value
    };

    currentPage = 1; // Resetear a primera página
    loadData();
}

/**
 * Limpiar filtros
 */
function clearFilters() {
    document.getElementById('areaFilter').value = '';
    document.getElementById('indicadorFilter').value = '';
    document.getElementById('anioFilter').value = '';
    document.getElementById('estadoFilter').value = '';
    
    currentFilters = {};
    currentPage = 1;
    loadData();
    
    // Recargar indicadores completos
    loadIndicadoresFilter();
}

/**
 * Manejar selección de filas
 */
function toggleRowSelection(id) {
    if (selectedRows.has(id)) {
        selectedRows.delete(id);
    } else {
        selectedRows.add(id);
    }
    updateSelectionUI();
}

/**
 * Toggle seleccionar todas las filas
 */
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');
    
    checkboxes.forEach(checkbox => {
        const id = parseInt(checkbox.value);
        checkbox.checked = selectAll.checked;
        
        if (selectAll.checked) {
            selectedRows.add(id);
        } else {
            selectedRows.delete(id);
        }
    });
    
    updateSelectionUI();
}

/**
 * Actualizar UI de selección
 */
function updateSelectionUI() {
    const selectedCount = selectedRows.size;
    const bulkActionsSection = document.getElementById('bulkActionsSection');
    const selectedCountSpan = document.getElementById('selectedCount');
    const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
    
    if (selectedCount > 0) {
        bulkActionsSection.style.display = 'block';
        selectedCountSpan.textContent = `${selectedCount} elemento${selectedCount > 1 ? 's' : ''} seleccionado${selectedCount > 1 ? 's' : ''}`;
        
        // Mostrar botón de restaurar si hay elementos eliminados seleccionados
        const hasDeletedSelected = Array.from(selectedRows).some(id => {
            const row = currentData.find(r => r.id === id);
            return row && row.deleted_at !== null;
        });
        
        bulkRestoreBtn.style.display = hasDeletedSelected ? 'inline-block' : 'none';
    } else {
        bulkActionsSection.style.display = 'none';
    }

    // Actualizar checkbox "select all"
    const totalCheckboxes = document.querySelectorAll('.row-checkbox').length;
    const selectAll = document.getElementById('selectAll');
    
    if (selectedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (selectedCount === totalCheckboxes) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

/**
 * Limpiar selección
 */
function clearSelection() {
    selectedRows.clear();
    updateSelectionUI();
    
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.getElementById('selectAll').checked = false;
    document.getElementById('selectAll').indeterminate = false;
}

/**
 * Editar fila individual
 */
function editRow(id) {
    const row = currentData.find(r => r.id === id);
    if (!row) return;

    // Llenar modal con datos actuales
    document.getElementById('editRecordId').value = id;
    document.getElementById('editIndicadorDisplay').textContent = 
        `${row.indicadores.clave} - ${row.indicadores.nombre}`;
    
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('editPeriodoDisplay').textContent = 
        `${meses[row.mes]} ${row.anio}`;
    
    document.getElementById('editValor').value = row.valor_num;
    document.getElementById('editFuente').value = row.fuente || '';
    document.getElementById('editComentario').value = row.comentario || '';
    document.getElementById('editEstado').value = row.estado || '';
    
    updateEditCommentCounter();
    document.getElementById('editModal').style.display = 'block';
}

/**
 * Guardar edición
 */
async function saveEdit() {
    const id = parseInt(document.getElementById('editRecordId').value);
    const valor = parseFloat(document.getElementById('editValor').value);
    const fuente = document.getElementById('editFuente').value.trim() || null;
    const comentario = document.getElementById('editComentario').value.trim() || null;
    const estado = document.getElementById('editEstado').value || null;

    if (isNaN(valor)) {
        await notify('Ingrese un valor numérico válido', 'error');
        return;
    }

    try {
        const { error } = await supabase
            .from('indicador_valores')
            .update({
                valor_num: valor,
                fuente: fuente,
                comentario: comentario,
                estado: estado,
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            })
            .eq('id', id);

        if (error) throw error;

        await notify('Valor actualizado exitosamente', 'success');
        closeEditModal();
        await loadData();

    } catch (error) {
        console.error('Error actualizando valor:', error);
        
        let errorMessage = 'Error actualizando el valor: ';
        if (error.message.includes('RLS')) {
            errorMessage += 'No tiene permisos para editar este registro';
        } else {
            errorMessage += error.message;
        }
        
        await notify(errorMessage, 'error');
    }
}

/**
 * Eliminar fila (soft delete)
 */
function deleteRow(id) {
    const row = currentData.find(r => r.id === id);
    if (!row) return;

    showConfirmModal(
        'Confirmar Eliminación',
        `¿Está seguro de que desea eliminar este valor?`,
        `Indicador: ${row.indicadores.clave} - ${row.indicadores.nombre}\nPeríodo: ${getMonthName(row.mes)} ${row.anio}\nValor: ${formatNumber(row.valor_num)}`,
        'soft-delete',
        [id]
    );
}

/**
 * Restaurar fila
 */
function restoreRow(id) {
    const row = currentData.find(r => r.id === id);
    if (!row) return;

    showConfirmModal(
        'Confirmar Restauración',
        `¿Está seguro de que desea restaurar este valor?`,
        `Indicador: ${row.indicadores.clave} - ${row.indicadores.nombre}\nPeríodo: ${getMonthName(row.mes)} ${row.anio}\nValor: ${formatNumber(row.valor_num)}`,
        'restore',
        [id]
    );
}

/**
 * Acciones masivas
 */
function bulkDelete() {
    if (selectedRows.size === 0) return;

    const activeRows = Array.from(selectedRows).filter(id => {
        const row = currentData.find(r => r.id === id);
        return row && row.deleted_at === null;
    });

    if (activeRows.length === 0) {
        notify('No hay registros activos seleccionados para eliminar', 'warning');
        return;
    }

    showConfirmModal(
        'Confirmar Eliminación Masiva',
        `¿Está seguro de que desea eliminar ${activeRows.length} registro${activeRows.length > 1 ? 's' : ''}?`,
        'Esta acción se puede revertir restaurando los registros.',
        'soft-delete',
        activeRows
    );
}

function bulkRestore() {
    if (selectedRows.size === 0) return;

    const deletedRows = Array.from(selectedRows).filter(id => {
        const row = currentData.find(r => r.id === id);
        return row && row.deleted_at !== null;
    });

    if (deletedRows.length === 0) {
        notify('No hay registros eliminados seleccionados para restaurar', 'warning');
        return;
    }

    showConfirmModal(
        'Confirmar Restauración Masiva',
        `¿Está seguro de que desea restaurar ${deletedRows.length} registro${deletedRows.length > 1 ? 's' : ''}?`,
        'Los registros volverán a estar activos en el sistema.',
        'restore',
        deletedRows
    );
}

/**
 * Ejecutar acción confirmada
 */
async function executeConfirmedAction() {
    const action = window.pendingAction;
    const ids = window.pendingActionIds;

    if (!action || !ids) return;

    try {
        closeConfirmModal();
        showLoading(true);

        let updateData = {};
        let successMessage = '';

        switch (action) {
            case 'soft-delete':
                updateData = { 
                    deleted_at: new Date().toISOString(),
                    updated_by: currentUser.id 
                };
                successMessage = `${ids.length} registro${ids.length > 1 ? 's eliminados' : ' eliminado'} exitosamente`;
                break;
            case 'restore':
                updateData = { 
                    deleted_at: null,
                    updated_by: currentUser.id 
                };
                successMessage = `${ids.length} registro${ids.length > 1 ? 's restaurados' : ' restaurado'} exitosamente`;
                break;
        }

        const { error } = await supabase
            .from('indicador_valores')
            .update(updateData)
            .in('id', ids);

        if (error) throw error;

        await notify(successMessage, 'success');
        clearSelection();
        await loadData();

    } catch (error) {
        console.error('Error ejecutando acción:', error);
        
        let errorMessage = 'Error ejecutando la acción: ';
        if (error.message.includes('RLS')) {
            errorMessage += 'No tiene permisos para realizar esta acción';
        } else {
            errorMessage += error.message;
        }
        
        await notify(errorMessage, 'error');
    } finally {
        showLoading(false);
        window.pendingAction = null;
        window.pendingActionIds = null;
    }
}

/**
 * Funciones de modal y UI
 */
function showConfirmModal(title, message, details, action, ids) {
    document.getElementById('confirmTitle').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDetails').textContent = details;
    
    window.pendingAction = action;
    window.pendingActionIds = ids;
    
    document.getElementById('confirmModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    window.pendingAction = null;
    window.pendingActionIds = null;
}

function updateEditCommentCounter() {
    const textarea = document.getElementById('editComentario');
    const counter = document.getElementById('editComentarioCounter');
    counter.textContent = textarea.value.length;
}

function showLoading(loading) {
    const tbody = document.getElementById('editTableBody');
    if (loading) {
        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="9">
                    <div class="loading-message">
                        <i class="fas fa-spinner fa-spin"></i>
                        Cargando datos...
                    </div>
                </td>
            </tr>
        `;
    }
}

/**
 * Paginación
 */
function goToPage(page) {
    if (page < 1 || page > Math.ceil(totalRecords / pageSize)) return;
    currentPage = page;
    loadData();
}

function changePageSize() {
    pageSize = parseInt(document.getElementById('pageSizeSelect').value);
    currentPage = 1;
    loadData();
}

function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    document.getElementById('firstPageBtn').disabled = currentPage === 1;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    document.getElementById('lastPageBtn').disabled = currentPage === totalPages;
    
    // Actualizar números de página
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        pageNumbers.appendChild(pageBtn);
    }
}

function updateRecordCount() {
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRecords);
    
    document.getElementById('recordCount').textContent = `(${totalRecords} registros)`;
    document.getElementById('paginationInfo').textContent = 
        `Mostrando ${from} a ${to} de ${totalRecords} registros`;
}

/**
 * Utilidades
 */
function toggleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // Actualizar indicadores visuales
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const activeHeader = document.querySelector(`.sortable[data-column="${column}"] i`);
    if (activeHeader) {
        activeHeader.className = currentSort.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
    
    loadData();
}

function getMonthName(mes) {
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes];
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(num);
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Funciones globales para onclick en HTML
window.toggleRowSelection = toggleRowSelection;
window.editRow = editRow;
window.deleteRow = deleteRow;
window.restoreRow = restoreRow;
window.viewRowDetails = function(id) {
    const row = currentData.find(r => r.id === id);
    if (!row) return;
    
    const details = `
Indicador: ${row.indicadores.clave} - ${row.indicadores.nombre}
Área: ${row.indicadores.areas.nombre}
Período: ${getMonthName(row.mes)} ${row.anio}
Valor: ${formatNumber(row.valor_num)}
Fuente: ${row.fuente || 'No especificada'}
Comentario: ${row.comentario || 'Sin comentarios'}
Estado: ${row.estado || 'Sin estado'}
Creado: ${new Date(row.created_at).toLocaleString('es-MX')}
Actualizado: ${row.updated_at ? new Date(row.updated_at).toLocaleString('es-MX') : 'No actualizado'}
Estado: ${row.deleted_at ? 'Eliminado el ' + new Date(row.deleted_at).toLocaleString('es-MX') : 'Activo'}
    `;
    
    alert(details);
};

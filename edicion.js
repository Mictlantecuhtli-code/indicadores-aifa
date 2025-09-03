/**
 * edicion.js - Parte 1/4 - Variables globales, inicialización y elementos DOM
 * Sistema de Indicadores AIFA 2.0
 */

// Variables globales
let supabase;
let currentUser = null;
let currentData = [];
let indicadoresData = [];
let areasData = [];
let currentPage = 1;
let itemsPerPage = 20;
let totalItems = 0;

// Elementos DOM
let filterElements = {};
let tableElements = {};
let modalElements = {};
let paginationElements = {};

// Estados
let isEditing = false;
let editingRecord = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar cliente Supabase
        supabase = createClient();
        
        // Obtener referencias DOM
        initializeElements();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Verificar permisos y autenticación
        await checkAuthenticationAndPermissions();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        notify('success', 'Sistema de edición inicializado correctamente');
        
    } catch (error) {
        console.error('Error durante inicialización:', error);
        notify('error', 'Error inicializando sistema: ' + error.message);
    }
});

/**
 * Inicializa referencias a elementos DOM
 */
function initializeElements() {
    // Elementos de filtros
    filterElements = {
        area: document.getElementById('area-filter'),
        indicador: document.getElementById('indicador-filter'),
        anio: document.getElementById('anio-filter'),
        mesDesde: document.getElementById('mes-desde'),
        mesHasta: document.getElementById('mes-hasta'),
        estado: document.getElementById('estado-filter'),
        incluirEliminados: document.getElementById('incluir-eliminados'),
        buscarBtn: document.getElementById('buscar-btn'),
        limpiarBtn: document.getElementById('limpiar-filtros-btn')
    };
    
    // Elementos de tabla y resultados
    tableElements = {
        resultsSection: document.getElementById('results-section'),
        resultsCount: document.getElementById('results-count'),
        exportBtn: document.getElementById('export-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        tableBody: document.getElementById('valores-tbody'),
        table: document.getElementById('valores-table')
    };
    
    // Elementos de paginación
    paginationElements = {
        pagination: document.getElementById('pagination'),
        prevBtn: document.getElementById('prev-page'),
        nextBtn: document.getElementById('next-page'),
        pageInfo: document.getElementById('page-info')
    };
    
    // Elementos de modales
    modalElements = {
        // Modal de edición
        editModal: document.getElementById('edit-modal'),
        editOverlay: document.getElementById('edit-modal-overlay'),
        editClose: document.getElementById('edit-modal-close'),
        editForm: document.getElementById('edit-form'),
        editSaveBtn: document.getElementById('edit-save-btn'),
        editCancelBtn: document.getElementById('edit-cancel-btn'),
        
        // Campos del modal de edición
        editId: document.getElementById('edit-id'),
        editIndicador: document.getElementById('edit-indicador'),
        editAnio: document.getElementById('edit-anio'),
        editMes: document.getElementById('edit-mes'),
        editValor: document.getElementById('edit-valor'),
        editEstado: document.getElementById('edit-estado'),
        editFuente: document.getElementById('edit-fuente'),
        editComentario: document.getElementById('edit-comentario'),
        editComentarioCounter: document.getElementById('edit-comentario-counter'),
        
        // Modal de confirmación
        confirmModal: document.getElementById('confirm-modal'),
        confirmOverlay: document.getElementById('confirm-modal-overlay'),
        confirmClose: document.getElementById('confirm-modal-close'),
        confirmTitle: document.getElementById('confirm-modal-title'),
        confirmMessage: document.getElementById('confirm-message'),
        confirmIcon: document.getElementById('confirm-icon'),
        confirmActionBtn: document.getElementById('confirm-action-btn'),
        confirmCancelBtn: document.getElementById('confirm-cancel-btn')
    };
    
    // Verificar elementos críticos
    const criticalElements = [
        filterElements.buscarBtn,
        tableElements.resultsSection,
        tableElements.tableBody,
        modalElements.editModal,
        modalElements.confirmModal
    ];
    
    const missingElements = criticalElements.filter(el => !el);
    if (missingElements.length > 0) {
        throw new Error('Faltan elementos DOM críticos');
    }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Filtros
    filterElements.buscarBtn.addEventListener('click', handleBuscarClick);
    filterElements.limpiarBtn?.addEventListener('click', handleLimpiarFiltros);
    
    // Cascada de filtros: área -> indicador
    filterElements.area?.addEventListener('change', handleAreaChange);
    
    // Enter en filtros
    Object.values(filterElements).forEach(element => {
        if (element && (element.tagName === 'SELECT' || element.tagName === 'INPUT')) {
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleBuscarClick();
                }
            });
        }
    });
    
    // Acciones de tabla
    tableElements.exportBtn?.addEventListener('click', handleExportClick);
    tableElements.refreshBtn?.addEventListener('click', handleRefreshClick);
    
    // Paginación
    paginationElements.prevBtn?.addEventListener('click', () => changePage(currentPage - 1));
    paginationElements.nextBtn?.addEventListener('click', () => changePage(currentPage + 1));
    
    // Modal de edición
    setupEditModal();
    setupConfirmModal();
    
    // Delegación de eventos para acciones de fila (ya que se generan dinámicamente)
    tableElements.tableBody?.addEventListener('click', handleTableAction);
}

/**
 * Configura modal de edición
 */
function setupEditModal() {
    // Cerrar modal
    [modalElements.editClose, modalElements.editOverlay, modalElements.editCancelBtn].forEach(element => {
        element?.addEventListener('click', closeEditModal);
    });
    
    // Escape para cerrar
    modalElements.editModal?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
    
    // Envío de formulario
    modalElements.editForm?.addEventListener('submit', handleEditSubmit);
    
    // Contador de caracteres
    modalElements.editComentario?.addEventListener('input', updateEditCharacterCounter);
    
    // Validación en tiempo real
    modalElements.editValor?.addEventListener('input', validateEditValor);
}

/**
 * Configura modal de confirmación
 */
function setupConfirmModal() {
    // Cerrar modal
    [modalElements.confirmClose, modalElements.confirmOverlay, modalElements.confirmCancelBtn].forEach(element => {
        element?.addEventListener('click', closeConfirmModal);
    });
    
    // Escape para cerrar
    modalElements.confirmModal?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeConfirmModal();
        }
    });
}

/**
 * Verifica autenticación y permisos
 */
async function checkAuthenticationAndPermissions() {
    try {
        currentUser = await getCurrentUser();
        
        if (!currentUser) {
            notify('warning', 'Debe iniciar sesión para acceder a la edición');
            return;
        }
        
        // Verificar si tiene permisos de edición (≥ jefe_area)
        const hasEditPermission = await hasPermission('indicador_valores', 'update');
        
        if (!hasEditPermission) {
            // Mostrar aviso de permisos limitados
            const permissionNotice = document.getElementById('permission-notice');
            if (permissionNotice) {
                permissionNotice.style.display = 'flex';
            }
            notify('info', 'Su rol solo permite visualizar datos, no editarlos');
        }
        
    } catch (error) {
        console.error('Error verificando autenticación:', error);
    }
}
/**
 * edicion.js - Parte 2/4 - Carga de datos, filtros y búsqueda
 * Sistema de Indicadores AIFA 2.0
 */

/**
 * Carga datos iniciales para filtros
 */
async function loadInitialData() {
    try {
        await Promise.all([
            loadAreas(),
            loadIndicadores()
        ]);
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        throw error;
    }
}

/**
 * Carga lista de áreas para filtro
 */
async function loadAreas() {
    try {
        const { data, error } = await supabase
            .from('areas')
            .select('id, nombre')
            .order('nombre');
        
        if (error) throw error;
        
        areasData = data || [];
        
        // Llenar select de áreas
        if (filterElements.area) {
            filterElements.area.innerHTML = '<option value="">Todas las áreas</option>';
            areasData.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.nombre;
                filterElements.area.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error cargando áreas:', error);
        notify('error', 'Error cargando áreas: ' + error.message);
    }
}

/**
 * Carga lista de indicadores para filtro
 */
async function loadIndicadores() {
    try {
        // Determinar si filtrar por áreas del usuario
        const soloAreasUsuario = currentUser && 
            currentUser.rol && 
            currentUser.rol.nombre === 'capturista';
        
        indicadoresData = await fetchIndicadores(soloAreasUsuario);
        
        // Llenar select de indicadores
        updateIndicadoresFilter();
        
    } catch (error) {
        console.error('Error cargando indicadores:', error);
        notify('error', 'Error cargando indicadores: ' + error.message);
    }
}

/**
 * Actualiza filtro de indicadores (puede ser filtrado por área)
 */
function updateIndicadoresFilter(areaId = null) {
    if (!filterElements.indicador) return;
    
    filterElements.indicador.innerHTML = '<option value="">Todos los indicadores</option>';
    
    const indicadoresFiltrados = areaId 
        ? indicadoresData.filter(ind => ind.area_id === parseInt(areaId))
        : indicadoresData;
    
    indicadoresFiltrados.forEach(indicador => {
        const option = document.createElement('option');
        option.value = indicador.id;
        option.textContent = `${indicador.areas.nombre} — ${indicador.nombre}`;
        filterElements.indicador.appendChild(option);
    });
}

/**
 * Maneja cambio en filtro de área
 */
function handleAreaChange() {
    const areaId = filterElements.area?.value;
    updateIndicadoresFilter(areaId);
    
    // Limpiar selección de indicador si es necesario
    if (filterElements.indicador) {
        filterElements.indicador.value = '';
    }
}

/**
 * Maneja clic en limpiar filtros
 */
function handleLimpiarFiltros() {
    // Limpiar todos los filtros
    Object.values(filterElements).forEach(element => {
        if (element && element.tagName === 'SELECT') {
            element.selectedIndex = 0;
        } else if (element && element.type === 'checkbox') {
            element.checked = false;
        }
    });
    
    // Actualizar filtro de indicadores
    updateIndicadoresFilter();
    
    notify('info', 'Filtros limpiados');
}

/**
 * Maneja clic en buscar
 */
async function handleBuscarClick() {
    try {
        setLoadingState(filterElements.buscarBtn, true);
        
        currentPage = 1;
        await searchValues();
        
        setLoadingState(filterElements.buscarBtn, false);
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        notify('error', 'Error realizando búsqueda: ' + error.message);
        setLoadingState(filterElements.buscarBtn, false);
    }
}

/**
 * Maneja clic en exportar
 */
function handleExportClick() {
    if (currentData.length === 0) {
        notify('warning', 'No hay datos para exportar');
        return;
    }
    
    try {
        // Preparar datos para exportación
        const exportData = currentData.map(record => ({
            'Área': record.indicadores?.areas?.nombre || 'N/A',
            'Indicador': record.indicadores?.nombre || 'N/A',
            'Año': record.anio,
            'Mes': getMonthName(record.mes),
            'Valor': record.valor_num,
            'Estado': record.estado,
            'Fuente': record.fuente || 'Sin especificar',
            'Comentario': record.comentario || 'Sin comentarios',
            'Creado': formatDate(record.created_at, 'datetime'),
            'Modificado': formatDate(record.updated_at, 'datetime'),
            'Eliminado': record.deleted_at ? 'Sí' : 'No'
        }));
        
        // Generar nombre de archivo con timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `indicadores_edicion_${timestamp}`;
        
        exportToCSV(exportData, filename);
        
    } catch (error) {
        console.error('Error exportando datos:', error);
        notify('error', 'Error exportando datos: ' + error.message);
    }
}

/**
 * Maneja clic en actualizar
 */
async function handleRefreshClick() {
    try {
        setLoadingState(tableElements.refreshBtn, true);
        await searchValues();
        setLoadingState(tableElements.refreshBtn, false);
        notify('info', 'Datos actualizados');
    } catch (error) {
        console.error('Error actualizando datos:', error);
        notify('error', 'Error actualizando datos: ' + error.message);
        setLoadingState(tableElements.refreshBtn, false);
    }
}

/**
 * Realiza búsqueda de valores con filtros aplicados
 */
async function searchValues() {
    try {
        const filters = getFilterValues();
        const offset = (currentPage - 1) * itemsPerPage;
        
        // Construir query base
        let query = supabase
            .from('indicador_valores')
            .select(`
                id, indicador_id, anio, mes, valor_num, estado, fuente, comentario,
                created_at, updated_at, deleted_at,
                indicadores(id, nombre, areas(id, nombre))
            `);
        
        // Aplicar filtros
        if (filters.indicadorId) {
            query = query.eq('indicador_id', filters.indicadorId);
        }
        
        if (filters.anio) {
            query = query.eq('anio', filters.anio);
        }
        
        if (filters.mesDesde) {
            query = query.gte('mes', filters.mesDesde);
        }
        
        if (filters.mesHasta) {
            query = query.lte('mes', filters.mesHasta);
        }
        
        if (filters.estado) {
            query = query.eq('estado', filters.estado);
        }
        
        // Filtro de eliminados
        if (!filters.incluirEliminados) {
            query = query.is('deleted_at', null);
        }
        
        // Si es capturista, filtrar por sus áreas
        if (currentUser && currentUser.rol && currentUser.rol.nombre === 'capturista') {
            const areaIds = currentUser.areas?.map(area => area.id) || [];
            if (areaIds.length > 0) {
                // Necesitamos un join más complejo para filtrar por áreas del usuario
                const { data: userIndicadores } = await supabase
                    .from('indicadores')
                    .select('id')
                    .in('area_id', areaIds);
                
                const indicadorIds = userIndicadores?.map(ind => ind.id) || [];
                if (indicadorIds.length > 0) {
                    query = query.in('indicador_id', indicadorIds);
                }
            }
        }
        
        // Paginación y orden
        query = query
            .order('anio', { ascending: false })
            .order('mes', { ascending: false })
            .order('updated_at', { ascending: false })
            .range(offset, offset + itemsPerPage - 1);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Obtener conteo total (query separada para performance)
        const { count: totalCount } = await getTotalCount(filters);
        
        currentData = data || [];
        totalItems = totalCount || 0;
        
        displayResults();
        updatePagination();
        
        // Mostrar sección de resultados
        if (tableElements.resultsSection) {
            tableElements.resultsSection.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        throw error;
    }
}

/**
 * Obtiene conteo total para paginación
 */
async function getTotalCount(filters) {
    let query = supabase
        .from('indicador_valores')
        .select('*', { count: 'exact', head: true });
    
    // Aplicar los mismos filtros
    if (filters.indicadorId) {
        query = query.eq('indicador_id', filters.indicadorId);
    }
    
    if (filters.anio) {
        query = query.eq('anio', filters.anio);
    }
    
    if (filters.mesDesde) {
        query = query.gte('mes', filters.mesDesde);
    }
    
    if (filters.mesHasta) {
        query = query.lte('mes', filters.mesHasta);
    }
    
    if (filters.estado) {
        query = query.eq('estado', filters.estado);
    }
    
    if (!filters.incluirEliminados) {
        query = query.is('deleted_at', null);
    }
    
    return await query;
}

/**
 * Obtiene valores actuales de los filtros
 */
function getFilterValues() {
    return {
        areaId: filterElements.area?.value ? parseInt(filterElements.area.value) : null,
        indicadorId: filterElements.indicador?.value ? parseInt(filterElements.indicador.value) : null,
        anio: filterElements.anio?.value ? parseInt(filterElements.anio.value) : null,
        mesDesde: filterElements.mesDesde?.value ? parseInt(filterElements.mesDesde.value) : null,
        mesHasta: filterElements.mesHasta?.value ? parseInt(filterElements.mesHasta.value) : null,
        estado: filterElements.estado?.value || null,
        incluirEliminados: filterElements.incluirEliminados?.checked || false
    };
}

/**
 * Actualiza información de paginación
 */
function updatePagination() {
    if (!paginationElements.pagination) return;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Actualizar información de página
    if (paginationElements.pageInfo) {
        paginationElements.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
    
    // Actualizar botones
    if (paginationElements.prevBtn) {
        paginationElements.prevBtn.disabled = currentPage <= 1;
    }
    
    if (paginationElements.nextBtn) {
        paginationElements.nextBtn.disabled = currentPage >= totalPages;
    }
    
    // Mostrar/ocultar paginación
    paginationElements.pagination.style.display = totalPages > 1 ? 'flex' : 'none';
}

/**
 * Cambia de página
 */
async function changePage(newPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (newPage < 1 || newPage > totalPages) {
        return;
    }
    
    currentPage = newPage;
    await searchValues();
}

/**
 * Trunca texto para mostrar en tabla
 */
function truncateText(text, maxLength) {
    if (!text) return 'Sin especificar';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
/**
 * edicion.js - Parte 3/4 - Visualización de resultados y manejo de tabla
 * Sistema de Indicadores AIFA 2.0
 */

/**
 * Muestra resultados en la tabla
 */
function displayResults() {
    if (!tableElements.tableBody) return;
    
    // Actualizar contador
    if (tableElements.resultsCount) {
        tableElements.resultsCount.textContent = `${totalItems} registro${totalItems !== 1 ? 's' : ''} encontrado${totalItems !== 1 ? 's' : ''}`;
    }
    
    // Limpiar tabla
    tableElements.tableBody.innerHTML = '';
    
    if (currentData.length === 0) {
        tableElements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--color-gray-500);">
                    No se encontraron registros con los filtros aplicados
                </td>
            </tr>
        `;
        return;
    }
    
    // Llenar tabla
    currentData.forEach(record => {
        const row = createTableRow(record);
        tableElements.tableBody.appendChild(row);
    });
}

/**
 * Crea fila de tabla para un registro
 */
function createTableRow(record) {
    const row = document.createElement('tr');
    
    // Determinar si el registro está eliminado
    const isDeleted = record.deleted_at !== null;
    if (isDeleted) {
        row.style.opacity = '0.6';
        row.style.textDecoration = 'line-through';
    }
    
    // Determinar acciones disponibles según permisos
    const canEdit = !isDeleted && currentUser && 
        (currentUser.rol?.nombre !== 'capturista');
    
    const indicadorNombre = record.indicadores?.nombre || 'Indicador no disponible';
    const areaNombre = record.indicadores?.areas?.nombre || 'Área no disponible';
    const mesNombre = getMonthName(record.mes);
    const fechaModificacion = formatDate(record.updated_at || record.created_at, 'datetime');
    
    row.innerHTML = `
        <td>${areaNombre} — ${indicadorNombre}</td>
        <td>${record.anio}</td>
        <td>${mesNombre}</td>
        <td style="font-family: monospace; text-align: right;">${formatNumber(record.valor_num)}</td>
        <td><span class="status-badge ${record.estado}">${record.estado}</span></td>
        <td title="${record.fuente || 'Sin fuente'}">${truncateText(record.fuente, 30)}</td>
        <td>${fechaModificacion}</td>
        <td class="actions-col">
            ${generateActionButtons(record, canEdit, isDeleted)}
        </td>
    `;
    
    // Agregar data attributes para acciones
    row.dataset.recordId = record.id;
    row.dataset.canEdit = canEdit;
    row.dataset.isDeleted = isDeleted;
    
    return row;
}

/**
 * Genera botones de acción para una fila
 */
function generateActionButtons(record, canEdit, isDeleted) {
    let buttons = [];
    
    if (isDeleted) {
        // Registro eliminado: solo restaurar
        if (canEdit) {
            buttons.push(`
                <button type="button" class="table-action-btn btn-success" 
                        data-action="restore" data-id="${record.id}" title="Restaurar">
                    ↺
                </button>
            `);
        }
    } else {
        // Registro activo: editar y eliminar
        if (canEdit) {
            buttons.push(`
                <button type="button" class="table-action-btn btn-primary" 
                        data-action="edit" data-id="${record.id}" title="Editar">
                    ✏️
                </button>
            `);
            buttons.push(`
                <button type="button" class="table-action-btn btn-danger" 
                        data-action="delete" data-id="${record.id}" title="Eliminar">
                    🗑️
                </button>
            `);
        }
        
        // Ver historial (todos los usuarios)
        buttons.push(`
            <button type="button" class="table-action-btn btn-outline" 
                    data-action="history" data-id="${record.id}" title="Ver historial">
                📋
            </button>
        `);
    }
    
    return buttons.join('');
}

/**
 * Maneja acciones de tabla (delegación de eventos)
 */
async function handleTableAction(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const recordId = parseInt(button.dataset.id);
    const record = currentData.find(r => r.id === recordId);
    
    if (!record) {
        notify('error', 'No se encontró el registro');
        return;
    }
    
    try {
        switch (action) {
            case 'edit':
                await handleEditAction(record);
                break;
            case 'delete':
                await handleDeleteAction(record);
                break;
            case 'restore':
                await handleRestoreAction(record);
                break;
            case 'history':
                await handleHistoryAction(record);
                break;
        }
    } catch (error) {
        console.error(`Error en acción ${action}:`, error);
        notify('error', `Error ejecutando acción: ${error.message}`);
    }
}

/**
 * Maneja acción de editar
 */
async function handleEditAction(record) {
    editingRecord = record;
    
    // Llenar formulario de edición
    if (modalElements.editId) modalElements.editId.value = record.id;
    
    if (modalElements.editIndicador) {
        const indicadorText = `${record.indicadores?.areas?.nombre} — ${record.indicadores?.nombre}`;
        modalElements.editIndicador.value = indicadorText;
    }
    
    if (modalElements.editAnio) modalElements.editAnio.value = record.anio;
    if (modalElements.editMes) modalElements.editMes.value = getMonthName(record.mes);
    if (modalElements.editValor) modalElements.editValor.value = record.valor_num;
    if (modalElements.editEstado) modalElements.editEstado.value = record.estado;
    if (modalElements.editFuente) modalElements.editFuente.value = record.fuente || '';
    if (modalElements.editComentario) {
        modalElements.editComentario.value = record.comentario || '';
        updateEditCharacterCounter();
    }
    
    // Mostrar modal
    openEditModal();
}

/**
 * Maneja acción de eliminar (soft delete)
 */
async function handleDeleteAction(record) {
    const indicadorText = `${record.indicadores?.areas?.nombre} — ${record.indicadores?.nombre}`;
    const periodo = `${getMonthName(record.mes)} ${record.anio}`;
    
    showConfirmModal(
        'Confirmar Eliminación',
        `¿Está seguro de eliminar el registro de "${indicadorText}" para ${periodo}?<br><br><em>Esta acción se puede deshacer posteriormente.</em>`,
        '🗑️',
        'btn-danger',
        'Eliminar',
        async () => {
            try {
                const { error } = await supabase
                    .from('indicador_valores')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', record.id);
                
                if (error) throw error;
                
                notify('success', 'Registro eliminado exitosamente');
                await searchValues();
                
            } catch (error) {
                console.error('Error eliminando registro:', error);
                notify('error', 'Error eliminando registro: ' + handleSupabaseError(error));
            }
        }
    );
}

/**
 * Maneja acción de restaurar
 */
async function handleRestoreAction(record) {
    const indicadorText = `${record.indicadores?.areas?.nombre} — ${record.indicadores?.nombre}`;
    const periodo = `${getMonthName(record.mes)} ${record.anio}`;
    
    showConfirmModal(
        'Confirmar Restauración',
        `¿Está seguro de restaurar el registro de "${indicadorText}" para ${periodo}?`,
        '↺',
        'btn-success',
        'Restaurar',
        async () => {
            try {
                const { error } = await supabase
                    .from('indicador_valores')
                    .update({ deleted_at: null })
                    .eq('id', record.id);
                
                if (error) throw error;
                
                notify('success', 'Registro restaurado exitosamente');
                await searchValues();
                
            } catch (error) {
                console.error('Error restaurando registro:', error);
                notify('error', 'Error restaurando registro: ' + handleSupabaseError(error));
            }
        }
    );
}

/**
 * Maneja acción de ver historial
 */
async function handleHistoryAction(record) {
    try {
        // Por ahora, mostrar información básica del registro
        // En implementación completa se consultaría la tabla de auditoría
        const indicadorText = `${record.indicadores?.areas?.nombre} — ${record.indicadores?.nombre}`;
        const periodo = `${getMonthName(record.mes)} ${record.anio}`;
        const creado = formatDate(record.created_at, 'datetime');
        const modificado = formatDate(record.updated_at, 'datetime');
        
        let historyInfo = `
            <strong>Registro:</strong> ${indicadorText}<br>
            <strong>Período:</strong> ${periodo}<br>
            <strong>Valor actual:</strong> ${formatNumber(record.valor_num)}<br>
            <strong>Estado:</strong> ${record.estado}<br>
            <strong>Creado:</strong> ${creado}<br>
            <strong>Modificado:</strong> ${modificado}<br>
        `;
        
        if (record.fuente) {
            historyInfo += `<strong>Fuente:</strong> ${record.fuente}<br>`;
        }
        
        if (record.comentario) {
            historyInfo += `<strong>Comentario:</strong> ${record.comentario}<br>`;
        }
        
        if (record.deleted_at) {
            historyInfo += `<br><em style="color: var(--color-danger);">Registro eliminado: ${formatDate(record.deleted_at, 'datetime')}</em>`;
        }
        
        showConfirmModal(
            'Historial del Registro',
            historyInfo,
            '📋',
            'btn-outline',
            'Cerrar',
            () => { /* Solo cerrar */ }
        );
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        notify('error', 'Error cargando historial: ' + error.message);
    }
}

/**
 * Maneja envío del formulario de edición
 */
async function handleEditSubmit(e) {
    e.preventDefault();
    
    if (!editingRecord) return;
    
    try {
        // Validar formulario
        if (!validateEditForm()) {
            return;
        }
        
        setLoadingState(modalElements.editSaveBtn, true);
        
        // Preparar datos de actualización
        const updateData = {
            valor_num: parseFloat(modalElements.editValor.value),
            estado: modalElements.editEstado.value,
            fuente: modalElements.editFuente.value.trim() || null,
            comentario: modalElements.editComentario.value.trim() || null,
            updated_at: new Date().toISOString()
        };
        
        // Actualizar registro
        const { error } = await supabase
            .from('indicador_valores')
            .update(updateData)
            .eq('id', editingRecord.id);
        
        if (error) throw error;
        
        notify('success', 'Registro actualizado exitosamente');
        closeEditModal();
        
        // Refrescar resultados
        await searchValues();
        
        setLoadingState(modalElements.editSaveBtn, false);
        
    } catch (error) {
        console.error('Error actualizando registro:', error);
        notify('error', 'Error actualizando registro: ' + handleSupabaseError(error));
        setLoadingState(modalElements.editSaveBtn, false);
    }
}

/**
 * Valida formulario de edición
 */
function validateEditForm() {
    let isValid = true;
    
    // Limpiar errores previos
    const errorEl = document.getElementById('edit-valor-error');
    if (errorEl) errorEl.textContent = '';
    
    // Validar valor
    const valor = parseFloat(modalElements.editValor.value);
    if (!isValidNumber(valor, 0.01)) {
        if (errorEl) errorEl.textContent = 'Ingrese un valor numérico mayor a cero';
        modalElements.editValor.focus();
        isValid = false;
    }
    
    // Validar longitud de fuente
    if (modalElements.editFuente.value && modalElements.editFuente.value.length > 200) {
        notify('error', 'La fuente no puede exceder 200 caracteres');
        modalElements.editFuente.focus();
        isValid = false;
    }
    
    // Validar longitud de comentario
    if (modalElements.editComentario.value && modalElements.editComentario.value.length > 500) {
        notify('error', 'El comentario no puede exceder 500 caracteres');
        modalElements.editComentario.focus();
        isValid = false;
    }
    
    return isValid;
}

/**
 * Actualiza contador de caracteres en modal de edición
 */
function updateEditCharacterCounter() {
    if (modalElements.editComentario && modalElements.editComentarioCounter) {
        const length = modalElements.editComentario.value.length;
        modalElements.editComentarioCounter.textContent = length;
        
        // Cambiar color si se acerca al límite
        if (length > 450) {
            modalElements.editComentarioCounter.style.color = 'var(--color-danger)';
        } else if (length > 400) {
            modalElements.editComentarioCounter.style.color = 'var(--color-warning)';
        } else {
            modalElements.editComentarioCounter.style.color = 'var(--color-gray-500)';
        }
    }
}

/**
 * Validación en tiempo real del campo valor
 */
function validateEditValor() {
    const valor = parseFloat(modalElements.editValor.value);
    const errorEl = document.getElementById('edit-valor-error');
    
    if (modalElements.editValor.value && !isValidNumber(valor, 0.01)) {
        if (errorEl) {
            errorEl.textContent = 'Debe ser un número mayor a cero';
        }
        modalElements.editValor.setCustomValidity('Valor inválido');
    } else {
        if (errorEl) {
            errorEl.textContent = '';
        }
        modalElements.editValor.setCustomValidity('');
    }
}

/**
 * edicion.js - Parte 4/4 - Utilidades de modal, estados de carga y finalización
 * Sistema de Indicadores AIFA 2.0
 */

/**
 * Abre modal de edición
 */
function openEditModal() {
    if (modalElements.editModal) {
        modalElements.editModal.setAttribute('aria-hidden', 'false');
        modalElements.editModal.style.display = 'flex';
        
        // Focus en primer campo editable
        setTimeout(() => {
            modalElements.editValor?.focus();
            modalElements.editValor?.select();
        }, 100);
        
        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Cierra modal de edición
 */
function closeEditModal() {
    if (modalElements.editModal) {
        modalElements.editModal.setAttribute('aria-hidden', 'true');
        modalElements.editModal.style.display = 'none';
        
        editingRecord = null;
        isEditing = false;
        
        // Limpiar formulario
        modalElements.editForm?.reset();
        
        // Limpiar errores
        const errorElements = modalElements.editForm?.querySelectorAll('.form-error');
        errorElements?.forEach(el => el.textContent = '');
        
        // Restaurar scroll del body
        document.body.style.overflow = '';
        
        updateLiveRegion('Modal de edición cerrado');
    }
}

/**
 * Muestra modal de confirmación
 */
function showConfirmModal(title, message, icon, buttonClass, buttonText, onConfirm) {
    if (!modalElements.confirmModal) return;
    
    // Configurar contenido del modal
    if (modalElements.confirmTitle) {
        modalElements.confirmTitle.textContent = title;
    }
    
    if (modalElements.confirmMessage) {
        modalElements.confirmMessage.innerHTML = message;
    }
    
    if (modalElements.confirmIcon) {
        modalElements.confirmIcon.textContent = icon;
    }
    
    if (modalElements.confirmActionBtn) {
        modalElements.confirmActionBtn.className = `btn ${buttonClass}`;
        const btnText = modalElements.confirmActionBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = buttonText;
        }
    }
    
    // Configurar acción de confirmación
    const handleConfirmAction = async () => {
        try {
            setLoadingState(modalElements.confirmActionBtn, true);
            await onConfirm();
            closeConfirmModal();
        } catch (error) {
            console.error('Error en acción confirmada:', error);
            notify('error', 'Error ejecutando acción: ' + error.message);
        } finally {
            setLoadingState(modalElements.confirmActionBtn, false);
        }
    };
    
    // Limpiar event listeners previos
    const newActionBtn = modalElements.confirmActionBtn.cloneNode(true);
    modalElements.confirmActionBtn.parentNode.replaceChild(newActionBtn, modalElements.confirmActionBtn);
    modalElements.confirmActionBtn = newActionBtn;
    
    // Agregar nuevo event listener
    modalElements.confirmActionBtn.addEventListener('click', handleConfirmAction);
    
    // Mostrar modal
    modalElements.confirmModal.setAttribute('aria-hidden', 'false');
    modalElements.confirmModal.style.display = 'flex';
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    // Focus en botón de cancelar por defecto
    setTimeout(() => {
        modalElements.confirmCancelBtn?.focus();
    }, 100);
    
    updateLiveRegion(`Modal de confirmación abierto: ${title}`);
}

/**
 * Cierra modal de confirmación
 */
function closeConfirmModal() {
    if (modalElements.confirmModal) {
        modalElements.confirmModal.setAttribute('aria-hidden', 'true');
        modalElements.confirmModal.style.display = 'none';
        
        // Restaurar scroll del body
        document.body.style.overflow = '';
        
        updateLiveRegion('Modal de confirmación cerrado');
    }
}

/**
 * Controla estados de carga de botones
 */
function setLoadingState(button, loading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'block';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}

/**
 * Utilidades varias para edición
 */

// Escuchar cambios de autenticación
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Escuchar cambios de autenticación de Supabase
        supabase?.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                await checkAuthenticationAndPermissions();
                await loadInitialData();
                notify('success', 'Sesión iniciada - datos actualizados');
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                // Limpiar datos sensibles
                currentData = [];
                indicadoresData = [];
                areasData = [];
                
                // Ocultar sección de resultados
                if (tableElements.resultsSection) {
                    tableElements.resultsSection.style.display = 'none';
                }
                
                notify('info', 'Sesión cerrada');
            }
        });
    });
}

// Prevenir cierre accidental de modales con cambios sin guardar
window.addEventListener('beforeunload', (e) => {
    if (isEditing && editingRecord) {
        e.preventDefault();
        e.returnValue = 'Hay cambios sin guardar. ¿Está seguro de salir?';
        return e.returnValue;
    }
});

// Manejo global de errores de red
window.addEventListener('online', () => {
    notify('success', 'Conexión restaurada');
});

window.addEventListener('offline', () => {
    notify('warning', 'Conexión perdida - las funciones pueden estar limitadas');
});

// Atajos de teclado
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + F para enfocar búsqueda
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.target.closest('.modal')) {
        e.preventDefault();
        filterElements.buscarBtn?.focus();
    }
    
    // Escape para cerrar cualquier modal abierto
    if (e.key === 'Escape') {
        if (modalElements.editModal?.style.display === 'flex') {
            closeEditModal();
        } else if (modalElements.confirmModal?.style.display === 'flex') {
            closeConfirmModal();
        }
    }
    
    // Enter en modales para confirmar (solo si no es textarea)
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
        if (modalElements.editModal?.style.display === 'flex') {
            e.preventDefault();
            modalElements.editForm?.requestSubmit();
        } else if (modalElements.confirmModal?.style.display === 'flex') {
            e.preventDefault();
            modalElements.confirmActionBtn?.click();
        }
    }
});

// Funciones de utilidad adicionales

/**
 * Reinicia el sistema de edición
 */
async function resetEditionSystem() {
    try {
        // Limpiar datos
        currentData = [];
        currentPage = 1;
        totalItems = 0;
        
        // Ocultar resultados
        if (tableElements.resultsSection) {
            tableElements.resultsSection.style.display = 'none';
        }
        
        // Cerrar modales
        closeEditModal();
        closeConfirmModal();
        
        // Recargar datos iniciales
        await loadInitialData();
        
        notify('info', 'Sistema reiniciado correctamente');
        
    } catch (error) {
        console.error('Error reiniciando sistema:', error);
        notify('error', 'Error reiniciando sistema: ' + error.message);
    }
}

/**
 * Valida estado general del sistema
 */
function validateSystemState() {
    const issues = [];
    
    // Verificar elementos críticos
    if (!tableElements.tableBody) {
        issues.push('Tabla de resultados no encontrada');
    }
    
    if (!filterElements.buscarBtn) {
        issues.push('Botón de búsqueda no encontrado');
    }
    
    if (!modalElements.editModal) {
        issues.push('Modal de edición no encontrado');
    }
    
    // Verificar autenticación
    if (!currentUser) {
        issues.push('Usuario no autenticado');
    }
    
    // Verificar datos básicos
    if (indicadoresData.length === 0) {
        issues.push('No hay indicadores disponibles');
    }
    
    if (issues.length > 0) {
        console.warn('Problemas del sistema detectados:', issues);
        notify('warning', `Se detectaron ${issues.length} problema(s) en el sistema`);
        return false;
    }
    
    return true;
}

/**
 * Limpia recursos y event listeners al salir
 */
function cleanup() {
    // Limpiar timers activos
    if (window.editionTimers) {
        Object.values(window.editionTimers).forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
    }
    
    // Cerrar modales
    closeEditModal();
    closeConfirmModal();
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
    
    // Limpiar variables globales
    currentData = [];
    indicadoresData = [];
    areasData = [];
    currentUser = null;
    editingRecord = null;
}

// Registrar cleanup al cerrar página
window.addEventListener('beforeunload', cleanup);

// Exposer funciones útiles al scope global para debugging
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.AIFAEdition = {
        resetSystem: resetEditionSystem,
        validateState: validateSystemState,
        getCurrentData: () => currentData,
        getCurrentUser: () => currentUser,
        cleanup: cleanup
    };
}

// Inicialización final automática
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
        // Refrescar datos cuando la página vuelve a ser visible
        if (currentData.length > 0) {
            searchValues().catch(error => {
                console.error('Error refrescando datos:', error);
            });
        }
    }
});

// Log de inicialización completa
console.log('🏗️ Sistema de edición AIFA 2.0 cargado completamente');
console.log('📊 Funciones disponibles: búsqueda, edición, eliminación, restauración, exportación');
console.log('🔐 RLS activado - permisos basados en roles y áreas');

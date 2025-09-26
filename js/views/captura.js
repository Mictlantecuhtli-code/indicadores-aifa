// =====================================================
// VISTA DE CAPTURA DE MEDICIONES
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, insertData, updateData, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber } from '../lib/ui.js';

// Estado del módulo de captura
const capturaState = {
    userProfile: null,
    availableAreas: [],
    availableIndicadores: [],
    selectedArea: null,
    selectedIndicador: null,
    selectedYear: new Date().getFullYear(),
    mediciones: [],
    editingMedicion: null
};

// =====================================================
// RENDERIZADO PRINCIPAL
// =====================================================

export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📝 Renderizando vista de captura');
        
        showLoading('Cargando módulo de captura...');
        
        // Obtener perfil del usuario
        capturaState.userProfile = await getCurrentProfile();
        if (!capturaState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Cargar áreas donde el usuario puede capturar
        await loadUserCaptureAreas();
        
        // Renderizar HTML
        container.innerHTML = createCapturaHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        hideLoading();
        
        if (DEBUG.enabled) console.log('✅ Vista de captura renderizada');
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error al renderizar vista de captura:', error);
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 class="text-lg font-medium text-red-800">Error al cargar captura</h3>
                <p class="text-red-600 mt-2">${error.message}</p>
            </div>
        `;
    }
}
// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Cargar áreas donde el usuario puede capturar
 */
async function loadUserCaptureAreas() {
    try {
        if (DEBUG.enabled) console.log('📂 Cargando áreas con permiso de captura...');
        
        // Si es ADMIN, puede capturar en todas las áreas
        if (capturaState.userProfile.rol_principal === 'ADMIN') {
            const { data: todasAreas } = await selectData('areas', {
                select: 'id, clave, nombre, color_hex',
                filters: { estado: 'ACTIVO' },
                orderBy: { column: 'nombre', ascending: true }
            });
            
            capturaState.availableAreas = todasAreas || [];
            
        } else {
            // Usuarios normales: solo áreas donde puede_capturar = true
            const { data: usuarioAreas } = await selectData('usuario_areas', {
                select: 'area_id, areas(id, clave, nombre, color_hex)',
                filters: { 
                    usuario_id: capturaState.userProfile.id,
                    puede_capturar: true,
                    estado: 'ACTIVO'
                }
            });
            
            capturaState.availableAreas = usuarioAreas 
                ? usuarioAreas.map(ua => ua.areas).filter(a => a !== null)
                : [];
        }
        
        if (DEBUG.enabled) {
            console.log(`✅ ${capturaState.availableAreas.length} áreas disponibles para captura`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar áreas de captura:', error);
        capturaState.availableAreas = [];
        showToast('Error al cargar áreas', 'error');
    }
}

/**
 * Cargar indicadores del área seleccionada
 */
async function loadAreaIndicadores(areaId) {
    try {
        if (DEBUG.enabled) console.log(`📊 Cargando indicadores del área ${areaId}...`);
        
        const { data } = await selectData('indicadores', {
            select: 'id, clave, nombre, descripcion, unidad_medida, meta_anual, frecuencia, es_acumulativo',
            filters: { 
                area_id: areaId,
                estado: 'ACTIVO'
            },
            orderBy: { column: 'orden_visualizacion', ascending: true }
        });
        
        capturaState.availableIndicadores = data || [];
        
        if (DEBUG.enabled) {
            console.log(`✅ ${capturaState.availableIndicadores.length} indicadores cargados`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar indicadores:', error);
        capturaState.availableIndicadores = [];
        showToast('Error al cargar indicadores', 'error');
    }
}

/**
 * Cargar mediciones existentes del indicador y año seleccionado
 */
async function loadMediciones(indicadorId, year) {
    try {
        if (DEBUG.enabled) console.log(`📈 Cargando mediciones de ${indicadorId} para ${year}...`);
        
        const { data } = await selectData('mediciones', {
            select: `
                id, mes, valor, meta_mensual, observaciones,
                capturado_por, editado_por,
                fecha_captura, fecha_ultima_edicion
            `,
            filters: {
                indicador_id: indicadorId,
                anio: year
            },
            orderBy: { column: 'mes', ascending: true }
        });
        
        capturaState.mediciones = data || [];
        
        if (DEBUG.enabled) {
            console.log(`✅ ${capturaState.mediciones.length} mediciones encontradas`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar mediciones:', error);
        capturaState.mediciones = [];
        showToast('Error al cargar mediciones existentes', 'error');
    }
}
// =====================================================
// GENERACIÓN DE HTML
// =====================================================

/**
 * Crear HTML principal de captura
 */
function createCapturaHTML() {
    return `
        <div class="space-y-6">
            <!-- Header -->
            <div class="bg-gradient-to-r from-green-600 to-green-500 rounded-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold mb-2">Captura de Mediciones</h1>
                        <p class="text-green-100">
                            Registre los valores mensuales de los indicadores
                        </p>
                    </div>
                    <div class="bg-white bg-opacity-20 rounded-lg p-4">
                        <div class="text-3xl font-bold">${capturaState.selectedYear}</div>
                        <div class="text-sm text-green-100">Año actual</div>
                    </div>
                </div>
            </div>

            <!-- Panel de selección -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i data-lucide="filter" class="w-5 h-5 mr-2 text-green-600"></i>
                    Seleccione indicador a capturar
                </h2>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Selector de Área -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Área <span class="text-red-500">*</span>
                        </label>
                        <select 
                            id="area-selector"
                            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="">Seleccione un área...</option>
                            ${capturaState.availableAreas.map(area => `
                                <option value="${area.id}">${area.nombre} (${area.clave})</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Selector de Indicador -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Indicador <span class="text-red-500">*</span>
                        </label>
                        <select 
                            id="indicador-selector"
                            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            disabled
                        >
                            <option value="">Primero seleccione un área...</option>
                        </select>
                    </div>

                    <!-- Selector de Año -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Año <span class="text-red-500">*</span>
                        </label>
                        <select 
                            id="year-selector"
                            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            ${generateYearOptions()}
                        </select>
                    </div>
                </div>

                ${capturaState.selectedIndicador ? createIndicadorInfoHTML() : ''}
            </div>

            <!-- Tabla de captura -->
            <div id="captura-table-container">
                ${capturaState.selectedIndicador ? createCapturaTableHTML() : createEmptyStateHTML()}
            </div>

            <!-- Historial de capturas -->
            ${capturaState.selectedIndicador ? createHistorialHTML() : ''}
        </div>
    `;
}

/**
 * Generar opciones de años (5 años atrás, año actual, 2 años adelante)
 */
function generateYearOptions() {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    for (let i = currentYear - 5; i <= currentYear + 2; i++) {
        years.push(i);
    }
    
    return years.map(year => `
        <option value="${year}" ${year === capturaState.selectedYear ? 'selected' : ''}>
            ${year}
        </option>
    `).join('');
}

/**
 * Estado vacío cuando no hay indicador seleccionado
 */
function createEmptyStateHTML() {
    return `
        <div class="bg-white rounded-lg shadow-sm border p-12 text-center">
            <i data-lucide="clipboard-list" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Seleccione un indicador</h3>
            <p class="text-gray-600">Elija un área e indicador para comenzar a capturar mediciones</p>
        </div>
    `;
}
/**
 * Mostrar información del indicador seleccionado
 */
function createIndicadorInfoHTML() {
    const indicador = capturaState.selectedIndicador;
    if (!indicador) return '';
    
    const metaMensual = indicador.meta_anual ? (indicador.meta_anual / 12).toFixed(2) : 'N/A';
    
    return `
        <div class="mt-6 bg-green-50 rounded-lg p-4 border border-green-200">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <span class="text-sm text-gray-600">Indicador:</span>
                    <p class="font-medium text-gray-900">${indicador.nombre}</p>
                </div>
                <div>
                    <span class="text-sm text-gray-600">Unidad:</span>
                    <p class="font-medium text-gray-900">${indicador.unidad_medida || 'N/A'}</p>
                </div>
                <div>
                    <span class="text-sm text-gray-600">Meta Anual:</span>
                    <p class="font-medium text-gray-900">${formatNumber(indicador.meta_anual) || 'N/A'}</p>
                </div>
                <div>
                    <span class="text-sm text-gray-600">Meta Mensual:</span>
                    <p class="font-medium text-gray-900">${metaMensual}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear tabla de captura mensual
 */
function createCapturaTableHTML() {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const indicador = capturaState.selectedIndicador;
    const metaMensual = indicador.meta_anual ? (indicador.meta_anual / 12) : null;
    
    return `
        <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-900">
                        Captura de Mediciones - ${capturaState.selectedYear}
                    </h3>
                    <button 
                        id="guardar-todos-btn"
                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="save" class="w-4 h-4"></i>
                        <span>Guardar Todo</span>
                    </button>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Mes
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Valor Real
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Meta Mensual
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                % Cumplimiento
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Observaciones
                            </th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${meses.map((mes, index) => {
                            const mesNum = index + 1;
                            const medicion = capturaState.mediciones.find(m => m.mes === mesNum);
                            const valor = medicion?.valor || '';
                            const observaciones = medicion?.observaciones || '';
                            const cumplimiento = calcularCumplimiento(valor, metaMensual);
                            
                            return `
                                <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        ${mes}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <input 
                                            type="number"
                                            step="0.01"
                                            id="valor-${mesNum}"
                                            value="${valor}"
                                            class="w-32 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ${metaMensual ? formatNumber(metaMensual) : 'N/A'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span id="cumplimiento-${mesNum}" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCumplimientoClass(cumplimiento)}">
                                            ${cumplimiento !== null ? cumplimiento + '%' : '-'}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4">
                                        <textarea 
                                            id="observaciones-${mesNum}"
                                            rows="2"
                                            class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            placeholder="Observaciones opcionales..."
                                        >${observaciones}</textarea>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <button 
                                            onclick="guardarMedicion(${mesNum})"
                                            class="text-green-600 hover:text-green-900 transition-colors"
                                            title="Guardar mes"
                                        >
                                            <i data-lucide="check-circle" class="w-5 h-5"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Calcular porcentaje de cumplimiento
 */
function calcularCumplimiento(valor, meta) {
    if (!valor || !meta || meta === 0) return null;
    return Math.round((parseFloat(valor) / parseFloat(meta)) * 100);
}

/**
 * Clase CSS según cumplimiento
 */
function getCumplimientoClass(cumplimiento) {
    if (cumplimiento === null) return 'bg-gray-100 text-gray-800';
    if (cumplimiento >= 100) return 'bg-green-100 text-green-800';
    if (cumplimiento >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
}
/**
 * Crear HTML del historial de capturas
 */
function createHistorialHTML() {
    if (capturaState.mediciones.length === 0) {
        return `
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Historial de Capturas</h3>
                <p class="text-gray-500 text-center py-4">No hay mediciones registradas para este año</p>
            </div>
        `;
    }
    
    return `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Historial de Capturas</h3>
            <div class="space-y-2">
                ${capturaState.mediciones.map(medicion => {
                    const mesNombre = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][medicion.mes - 1];
                    const indicador = capturaState.selectedIndicador;
                    const metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
                    const cumplimiento = calcularCumplimiento(medicion.valor, metaMensual);
                    
                    return `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div class="flex items-center space-x-4">
                                <div class="font-medium text-gray-900 w-12">${mesNombre}</div>
                                <div class="text-gray-700">
                                    Valor: <span class="font-semibold">${formatNumber(medicion.valor)}</span>
                                    ${indicador?.unidad_medida ? ` ${indicador.unidad_medida}` : ''}
                                </div>
                                ${cumplimiento !== null ? `
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCumplimientoClass(cumplimiento)}">
                                        ${cumplimiento}%
                                    </span>
                                ` : ''}
                            </div>
                            <div class="flex items-center space-x-3 text-sm text-gray-500">
                                ${medicion.editado_por ? 
                                    `<span title="Editado">✏️</span>` : 
                                    `<span title="Capturado">📝</span>`
                                }
                                <span>${formatDate(medicion.fecha_captura, 'short')}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// =====================================================
// EVENT LISTENERS
// =====================================================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Selector de área
    const areaSelector = document.getElementById('area-selector');
    if (areaSelector) {
        areaSelector.addEventListener('change', handleAreaChange);
    }
    
    // Selector de indicador
    const indicadorSelector = document.getElementById('indicador-selector');
    if (indicadorSelector) {
        indicadorSelector.addEventListener('change', handleIndicadorChange);
    }
    
    // Selector de año
    const yearSelector = document.getElementById('year-selector');
    if (yearSelector) {
        yearSelector.addEventListener('change', handleYearChange);
    }
    
    // Botón guardar todo
    const guardarTodosBtn = document.getElementById('guardar-todos-btn');
    if (guardarTodosBtn) {
        guardarTodosBtn.addEventListener('click', handleGuardarTodos);
    }
    
    // Event listeners para calcular cumplimiento en tiempo real
    for (let mes = 1; mes <= 12; mes++) {
        const valorInput = document.getElementById(`valor-${mes}`);
        if (valorInput) {
            valorInput.addEventListener('input', () => updateCumplimiento(mes));
        }
    }
}

/**
 * Manejar cambio de área
 */
async function handleAreaChange(e) {
    const areaId = e.target.value;
    
    if (!areaId) {
        capturaState.selectedArea = null;
        capturaState.selectedIndicador = null;
        capturaState.availableIndicadores = [];
        
        const indicadorSelector = document.getElementById('indicador-selector');
        if (indicadorSelector) {
            indicadorSelector.disabled = true;
            indicadorSelector.innerHTML = '<option value="">Primero seleccione un área...</option>';
        }
        
        refreshCapturaContent();
        return;
    }
    
    try {
        showLoading('Cargando indicadores...');
        
        capturaState.selectedArea = areaId;
        await loadAreaIndicadores(areaId);
        
        // Actualizar selector de indicadores
        const indicadorSelector = document.getElementById('indicador-selector');
        if (indicadorSelector) {
            indicadorSelector.disabled = false;
            indicadorSelector.innerHTML = `
                <option value="">Seleccione un indicador...</option>
                ${capturaState.availableIndicadores.map(ind => `
                    <option value="${ind.id}">${ind.nombre} (${ind.clave})</option>
                `).join('')}
            `;
        }
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cambiar área:', error);
        showToast('Error al cargar indicadores', 'error');
    }
}

/**
 * Manejar cambio de indicador
 */
async function handleIndicadorChange(e) {
    const indicadorId = e.target.value;
    
    if (!indicadorId) {
        capturaState.selectedIndicador = null;
        capturaState.mediciones = [];
        refreshCapturaContent();
        return;
    }
    
    try {
        showLoading('Cargando datos del indicador...');
        
        const indicador = capturaState.availableIndicadores.find(ind => ind.id === indicadorId);
        capturaState.selectedIndicador = indicador;
        
        await loadMediciones(indicadorId, capturaState.selectedYear);
        
        refreshCapturaContent();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cambiar indicador:', error);
        showToast('Error al cargar mediciones', 'error');
    }
}

/**
 * Manejar cambio de año
 */
async function handleYearChange(e) {
    const year = parseInt(e.target.value);
    capturaState.selectedYear = year;
    
    if (capturaState.selectedIndicador) {
        try {
            showLoading('Cargando mediciones del año...');
            await loadMediciones(capturaState.selectedIndicador.id, year);
            refreshCapturaContent();
            hideLoading();
        } catch (error) {
            hideLoading();
            console.error('Error al cambiar año:', error);
            showToast('Error al cargar mediciones', 'error');
        }
    }
}

/**
 * Actualizar cumplimiento en tiempo real
 */
function updateCumplimiento(mes) {
    const valorInput = document.getElementById(`valor-${mes}`);
    const cumplimientoSpan = document.getElementById(`cumplimiento-${mes}`);
    
    if (!valorInput || !cumplimientoSpan) return;
    
    const valor = parseFloat(valorInput.value);
    const indicador = capturaState.selectedIndicador;
    const metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
    
    const cumplimiento = calcularCumplimiento(valor, metaMensual);
    
    if (cumplimiento !== null) {
        cumplimientoSpan.textContent = cumplimiento + '%';
        cumplimientoSpan.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCumplimientoClass(cumplimiento)}`;
    } else {
        cumplimientoSpan.textContent = '-';
        cumplimientoSpan.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
    }
}

/**
 * Refrescar contenido de captura
 */
function refreshCapturaContent() {
    const container = document.getElementById('captura-table-container');
    if (container) {
        container.innerHTML = capturaState.selectedIndicador ? createCapturaTableHTML() : createEmptyStateHTML();
    }
    
    // Recrear event listeners de inputs
    setupEventListeners();
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}
// =====================================================
// FUNCIONES DE GUARDADO
// =====================================================

/**
 * Guardar medición individual de un mes
 */
window.guardarMedicion = async function(mes) {
    try {
        const valorInput = document.getElementById(`valor-${mes}`);
        const observacionesInput = document.getElementById(`observaciones-${mes}`);
        
        if (!valorInput) {
            showToast('Error al obtener el valor del mes', 'error');
            return;
        }
        
        const valor = parseFloat(valorInput.value);
        
        if (!valor || isNaN(valor)) {
            showToast('Debe ingresar un valor numérico válido', 'warning');
            valorInput.focus();
            return;
        }
        
        if (valor < 0) {
            showToast('El valor no puede ser negativo', 'warning');
            valorInput.focus();
            return;
        }
        
        showLoading('Guardando medición...');
        
        const indicador = capturaState.selectedIndicador;
        const metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
        const observaciones = observacionesInput?.value || null;
        
        // Verificar si ya existe una medición para este mes
        const medicionExistente = capturaState.mediciones.find(m => m.mes === mes);
        
        if (medicionExistente) {
            // ACTUALIZAR medición existente
            await updateData('mediciones', 
                {
                    valor: valor,
                    meta_mensual: metaMensual,
                    observaciones: observaciones,
                    editado_por: capturaState.userProfile.id,
                    fecha_ultima_edicion: new Date().toISOString()
                },
                { id: medicionExistente.id }
            );
            
            showToast(`Medición de ${getMesNombre(mes)} actualizada correctamente`, 'success');
            
        } else {
            // INSERTAR nueva medición
            await insertData('mediciones', {
                indicador_id: capturaState.selectedIndicador.id,
                anio: capturaState.selectedYear,
                mes: mes,
                valor: valor,
                meta_mensual: metaMensual,
                observaciones: observaciones,
                capturado_por: capturaState.userProfile.id,
                fecha_captura: new Date().toISOString()
            });
            
            showToast(`Medición de ${getMesNombre(mes)} guardada correctamente`, 'success');
        }
        
        // Recargar mediciones
        await loadMediciones(capturaState.selectedIndicador.id, capturaState.selectedYear);
        
        // Actualizar tabla y historial
        refreshCapturaContent();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al guardar medición:', error);
        showToast('Error al guardar la medición: ' + error.message, 'error');
    }
};

/**
 * Guardar todas las mediciones del año
 */
async function handleGuardarTodos() {
    try {
        const medicionesAGuardar = [];
        let hayErrores = false;
        
        // Validar y recolectar todas las mediciones
        for (let mes = 1; mes <= 12; mes++) {
            const valorInput = document.getElementById(`valor-${mes}`);
            const observacionesInput = document.getElementById(`observaciones-${mes}`);
            
            if (valorInput && valorInput.value) {
                const valor = parseFloat(valorInput.value);
                
                if (isNaN(valor) || valor < 0) {
                    showToast(`Valor inválido en ${getMesNombre(mes)}`, 'error');
                    valorInput.focus();
                    hayErrores = true;
                    break;
                }
                
                medicionesAGuardar.push({
                    mes: mes,
                    valor: valor,
                    observaciones: observacionesInput?.value || null
                });
            }
        }
        
        if (hayErrores) return;
        
        if (medicionesAGuardar.length === 0) {
            showToast('No hay mediciones para guardar', 'warning');
            return;
        }
        
        // Confirmar acción
        if (!confirm(`¿Desea guardar ${medicionesAGuardar.length} mediciones?`)) {
            return;
        }
        
        showLoading(`Guardando ${medicionesAGuardar.length} mediciones...`);
        
        const indicador = capturaState.selectedIndicador;
        const metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
        
        let guardadas = 0;
        let actualizadas = 0;
        
        // Procesar cada medición
        for (const medicion of medicionesAGuardar) {
            const medicionExistente = capturaState.mediciones.find(m => m.mes === medicion.mes);
            
            if (medicionExistente) {
                // Actualizar
                await updateData('mediciones',
                    {
                        valor: medicion.valor,
                        meta_mensual: metaMensual,
                        observaciones: medicion.observaciones,
                        editado_por: capturaState.userProfile.id,
                        fecha_ultima_edicion: new Date().toISOString()
                    },
                    { id: medicionExistente.id }
                );
                actualizadas++;
            } else {
                // Insertar
                await insertData('mediciones', {
                    indicador_id: capturaState.selectedIndicador.id,
                    anio: capturaState.selectedYear,
                    mes: medicion.mes,
                    valor: medicion.valor,
                    meta_mensual: metaMensual,
                    observaciones: medicion.observaciones,
                    capturado_por: capturaState.userProfile.id,
                    fecha_captura: new Date().toISOString()
                });
                guardadas++;
            }
        }
        
        // Recargar mediciones
        await loadMediciones(capturaState.selectedIndicador.id, capturaState.selectedYear);
        
        // Actualizar UI
        refreshCapturaContent();
        
        hideLoading();
        
        showToast(
            `Proceso completado: ${guardadas} guardadas, ${actualizadas} actualizadas`, 
            'success'
        );
        
    } catch (error) {
        hideLoading();
        console.error('Error al guardar todas las mediciones:', error);
        showToast('Error al guardar las mediciones: ' + error.message, 'error');
    }
}

/**
 * Obtener nombre del mes
 */
function getMesNombre(mes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1] || 'Mes ' + mes;
}

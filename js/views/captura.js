// =====================================================
// VISTA DE CAPTURA DE MEDICIONES
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, insertData, updateData, deleteData, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber } from '../lib/ui.js';

// Estado del módulo de captura
const META_ESCENARIOS = ['BAJO', 'MEDIO', 'ALTO'];
const ESCENARIO_COLOR_CLASSES = {
    BAJO: 'focus:ring-sky-500 focus:border-sky-500',
    MEDIO: 'focus:ring-amber-500 focus:border-amber-500',
    ALTO: 'focus:ring-rose-500 focus:border-rose-500'
};

const capturaState = {
    userProfile: null,
    availableAreas: [],
    availableIndicadores: [],
    selectedArea: null,
    selectedIndicador: null,
    selectedYear: new Date().getFullYear(),
    mediciones: [],
    editingMedicion: null,
    metas: {
        BAJO: {},
        MEDIO: {},
        ALTO: {}
    },
    canEditMetas: false
};

function resetMetasState() {
    capturaState.metas = META_ESCENARIOS.reduce((acc, escenario) => {
        acc[escenario] = {};
        return acc;
    }, {});
}

function normalizarEscenario(escenario) {
    return (escenario || '').toString().trim().toUpperCase();
}

function setMetaRecord(escenario, mes, meta) {
    const key = normalizarEscenario(escenario);
    if (!META_ESCENARIOS.includes(key)) return;

    if (!capturaState.metas[key]) {
        capturaState.metas[key] = {};
    }

    if (!meta) {
        delete capturaState.metas[key][mes];
        return;
    }

    const valor = meta.valor === null || meta.valor === undefined
        ? null
        : Number(meta.valor);

    capturaState.metas[key][mes] = {
        ...meta,
        valor: Number.isFinite(valor) ? valor : null
    };
}

function getMetaRecord(escenario, mes) {
    const key = normalizarEscenario(escenario);
    return capturaState.metas?.[key]?.[mes] || null;
}

function getMetaValue(escenario, mes) {
    const record = getMetaRecord(escenario, mes);
    if (!record) return null;
    const valor = Number(record.valor);
    return Number.isFinite(valor) ? valor : null;
}

function getEscenarioDisplayName(escenario) {
    const key = normalizarEscenario(escenario);
    switch (key) {
        case 'BAJO':
            return 'Bajo';
        case 'MEDIO':
            return 'Mediano';
        case 'ALTO':
            return 'Alto';
        default:
            return key;
    }
}

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

        capturaState.canEditMetas = ['ADMIN', 'SUBDIRECTOR'].includes(
            capturaState.userProfile.rol_principal
        );
        resetMetasState();

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

async function loadMetas(indicadorId, year) {
    try {
        if (DEBUG.enabled) {
            console.log(`🎯 Cargando metas de ${indicadorId} para ${year}...`);
        }

        resetMetasState();

        const { data } = await selectData('indicador_metas', {
            select: `id, indicador_id, anio, mes, escenario, valor, observaciones, fecha_captura, fecha_ultima_edicion`,
            filters: {
                indicador_id: indicadorId,
                anio: year
            },
            orderBy: [
                { column: 'escenario', ascending: true },
                { column: 'mes', ascending: true }
            ]
        });

        (data || []).forEach(meta => {
            setMetaRecord(meta.escenario, meta.mes, meta);
        });

        if (DEBUG.enabled) {
            const totalMetas = META_ESCENARIOS.reduce((acc, escenario) => {
                return acc + Object.keys(capturaState.metas[escenario]).length;
            }, 0);
            console.log(`✅ ${totalMetas} metas cargadas para el año ${year}`);
        }
    } catch (error) {
        console.error('❌ Error al cargar metas:', error);
        resetMetasState();
        showToast('Error al cargar metas del indicador', 'error');
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

    const metaHeaders = META_ESCENARIOS.map(escenario => `
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Meta ${getEscenarioDisplayName(escenario)}
        </th>
    `).join('');

    return `
        <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <h3 class="text-lg font-semibold text-gray-900">
                        Captura de Mediciones - ${capturaState.selectedYear}
                    </h3>
                    <div class="flex items-center gap-3">
                        ${capturaState.canEditMetas ? `
                            <span class="inline-flex items-center gap-2 text-sm text-gray-500">
                                <i data-lucide="target" class="w-4 h-4"></i>
                                Solo Subdirectores y Administradores pueden editar metas
                            </span>
                        ` : ''}
                        <button
                            id="guardar-todos-btn"
                            class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                            <i data-lucide="save" class="w-4 h-4"></i>
                            <span>Guardar Todo</span>
                        </button>
                    </div>
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
                            ${metaHeaders}
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                % Cumplimiento
                                <span class="block text-[11px] text-gray-400 normal-case">vs Meta Escenario Mediano</span>
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
                            const valor = medicion?.valor ?? '';
                            const observaciones = medicion?.observaciones || '';

                            const metaCells = META_ESCENARIOS.map(escenario => {
                                const valorMeta = getMetaValue(escenario, mesNum);
                                const metaId = `meta-${escenario}-${mesNum}`;
                                const colorClasses = ESCENARIO_COLOR_CLASSES[escenario] || 'focus:ring-green-500 focus:border-green-500';
                                const baseClasses = `w-32 border border-gray-300 rounded px-3 py-2 text-sm ${colorClasses}`;
                                const disabledAttrs = capturaState.canEditMetas ? '' : 'disabled readonly tabindex="-1"';
                                const visualClasses = capturaState.canEditMetas ? baseClasses : `${baseClasses} bg-gray-100 cursor-not-allowed`;
                                const placeholder = capturaState.canEditMetas ? '0.00' : 'Sin meta';

                                return `
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="number"
                                            step="0.01"
                                            id="${metaId}"
                                            value="${valorMeta ?? ''}"
                                            class="${visualClasses}"
                                            placeholder="${placeholder}"
                                            ${disabledAttrs}
                                            data-escenario="${escenario}"
                                        />
                                    </td>
                                `;
                            }).join('');

                            const metaReferencia = (() => {
                                const metaMedio = getMetaValue('MEDIO', mesNum);
                                if (metaMedio !== null) return metaMedio;
                                if (medicion?.meta_mensual) return Number(medicion.meta_mensual);
                                const indicador = capturaState.selectedIndicador;
                                return indicador?.meta_anual ? indicador.meta_anual / 12 : null;
                            })();

                            const cumplimiento = calcularCumplimiento(valor, metaReferencia);

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
                                    ${metaCells}
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
                                        <div class="flex items-center justify-center gap-2">
                                            <button
                                                onclick="guardarMedicion(${mesNum})"
                                                class="text-green-600 hover:text-green-900 transition-colors"
                                                title="Guardar medición"
                                            >
                                                <i data-lucide="check-circle" class="w-5 h-5"></i>
                                            </button>
                                            ${capturaState.canEditMetas ? `
                                                <button
                                                    onclick="guardarMetas(${mesNum})"
                                                    class="text-blue-600 hover:text-blue-900 transition-colors"
                                                    title="Guardar metas del mes"
                                                >
                                                    <i data-lucide="target" class="w-5 h-5"></i>
                                                </button>
                                            ` : ''}
                                        </div>
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
                    let metaMensual = getMetaValue('MEDIO', medicion.mes);
                    if (metaMensual === null) {
                        metaMensual = medicion.meta_mensual ?? (indicador?.meta_anual ? indicador.meta_anual / 12 : null);
                    }
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

        const metaMedioInput = document.getElementById(`meta-MEDIO-${mes}`);
        if (metaMedioInput) {
            metaMedioInput.addEventListener('input', () => updateCumplimiento(mes));
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
        resetMetasState();

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
        resetMetasState();
        refreshCapturaContent();
        return;
    }

    try {
        showLoading('Cargando datos del indicador...');

        const indicador = capturaState.availableIndicadores.find(ind => ind.id === indicadorId);
        capturaState.selectedIndicador = indicador;

        await loadMediciones(indicadorId, capturaState.selectedYear);
        await loadMetas(indicadorId, capturaState.selectedYear);

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
            await loadMetas(capturaState.selectedIndicador.id, year);
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
    const metaInput = document.getElementById(`meta-MEDIO-${mes}`);
    let metaMensual = null;

    if (metaInput) {
        const rawMeta = metaInput.value.trim();
        if (rawMeta !== '') {
            const parsedMeta = parseFloat(rawMeta);
            metaMensual = Number.isFinite(parsedMeta) ? parsedMeta : null;
        }
    }

    if (metaMensual === null) {
        metaMensual = getMetaValue('MEDIO', mes);
    }

    if (metaMensual === null) {
        const medicion = capturaState.mediciones.find(m => m.mes === mes);
        if (medicion?.meta_mensual) {
            metaMensual = Number(medicion.meta_mensual);
        }
    }

    if (metaMensual === null) {
        const indicador = capturaState.selectedIndicador;
        metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
    }

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
        let metaMensual = getMetaValue('MEDIO', mes);
        if (metaMensual === null) {
            metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
        }
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

window.guardarMetas = async function(mes) {
    if (!capturaState.canEditMetas) {
        showToast('No cuenta con permisos para editar metas', 'error');
        return;
    }

    if (!capturaState.selectedIndicador) {
        showToast('Seleccione un indicador para capturar metas', 'warning');
        return;
    }

    try {
        const metasCapturadas = [];

        for (const escenario of META_ESCENARIOS) {
            const input = document.getElementById(`meta-${escenario}-${mes}`);
            if (!input) continue;

            const rawValor = input.value.trim();
            let valor = null;

            if (rawValor !== '') {
                const parsed = parseFloat(rawValor);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    showToast(`Ingrese una meta válida para el escenario ${getEscenarioDisplayName(escenario)}`, 'warning');
                    input.focus();
                    return;
                }
                valor = parsed;
            }

            metasCapturadas.push({ escenario, valor });
        }

        const hayCambios = metasCapturadas.some(meta => {
            const registroActual = getMetaRecord(meta.escenario, mes);
            const valorActual = registroActual ? getMetaValue(meta.escenario, mes) : null;
            return meta.valor !== valorActual;
        });

        if (!hayCambios) {
            showToast('No hay cambios en las metas para este mes', 'info');
            return;
        }

        showLoading('Guardando metas...');

        for (const meta of metasCapturadas) {
            const actual = getMetaRecord(meta.escenario, mes);

            if (actual && meta.valor === null) {
                await deleteData('indicador_metas', { id: actual.id });
            } else if (actual) {
                await updateData('indicador_metas',
                    {
                        valor: meta.valor,
                        editado_por: capturaState.userProfile.id,
                        fecha_ultima_edicion: new Date().toISOString()
                    },
                    { id: actual.id }
                );
            } else if (meta.valor !== null) {
                await insertData('indicador_metas', {
                    indicador_id: capturaState.selectedIndicador.id,
                    anio: capturaState.selectedYear,
                    mes: mes,
                    escenario: meta.escenario,
                    valor: meta.valor,
                    capturado_por: capturaState.userProfile.id,
                    fecha_captura: new Date().toISOString()
                });
            }
        }

        await loadMetas(capturaState.selectedIndicador.id, capturaState.selectedYear);

        const metaMedioFinal = getMetaValue('MEDIO', mes);
        const medicionExistente = capturaState.mediciones.find(m => m.mes === mes);

        if (medicionExistente) {
            await updateData('mediciones',
                {
                    meta_mensual: metaMedioFinal,
                    editado_por: capturaState.userProfile.id,
                    fecha_ultima_edicion: new Date().toISOString()
                },
                { id: medicionExistente.id }
            );

            await loadMediciones(capturaState.selectedIndicador.id, capturaState.selectedYear);
        }

        refreshCapturaContent();

        hideLoading();
        showToast(`Metas de ${getMesNombre(mes)} actualizadas correctamente`, 'success');

    } catch (error) {
        hideLoading();
        console.error('Error al guardar metas:', error);
        showToast('Error al guardar las metas: ' + error.message, 'error');
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

        let guardadas = 0;
        let actualizadas = 0;

        // Procesar cada medición
        for (const medicion of medicionesAGuardar) {
            const medicionExistente = capturaState.mediciones.find(m => m.mes === medicion.mes);

            let metaMensual = getMetaValue('MEDIO', medicion.mes);
            if (metaMensual === null) {
                metaMensual = indicador?.meta_anual ? indicador.meta_anual / 12 : null;
            }

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

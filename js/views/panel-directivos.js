// =====================================================
// PANEL DE ANÁLISIS DE INDICADORES PARA DIRECTIVOS
// =====================================================
import { DEBUG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatNumber } from '../lib/ui.js';
import { crearGraficaMeta, crearGraficaHistorica, destruirGrafica, normalizarSerieTemporal } from '../lib/charts.js';
// Estado del panel de directivos
const ESCENARIO_LABELS = {
    bajo: 'Bajo',
    medio: 'Mediano',
    alto: 'Alto'
};

const panelState = {
    userProfile: null,
    indicadorSeleccionado: null,
    opcionSeleccionada: null,
    indicadoresOperativos: [],
    indicadoresFBO: [],
    datosReales: [],
    datosMetas: [],
    metaContext: {
        escenario: null,
        anio: null,
        mes: null,
        coincideConMedicion: false
    },
    subdirecciones: new Map(), // Map<parentAreaId, subdirecciones[]>
    expandedDirecciones: new Set(), // Set de IDs de direcciones expandidas
    loading: false
};

const indicadorVisualConfig = {
    'Aviación Comercial Pasajeros': { icon: 'users', color: 'blue' },
    'Aviación Comercial Operaciones': { icon: 'activity', color: 'blue' },
    'Aviación Carga Operaciones': { icon: 'truck', color: 'amber' },
    'Aviación Carga Toneladas': { icon: 'package', color: 'amber' },
    'Aviación General Pasajeros': { icon: 'user-check', color: 'green' },
    'Aviación General Operaciones': { icon: 'navigation-2', color: 'green' }
};
// =====================================================
// RENDERIZADO PRINCIPAL
// =====================================================
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📊 Renderizando Panel de Directivos');
        // Obtener perfil del usuario
        panelState.userProfile = await getCurrentProfile();
        if (!panelState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        // Cargar indicadores disponibles
        await cargarIndicadores();
        panelState.expandedDirecciones.clear();
        panelState.subdirecciones.clear();
        const direcciones = await cargarDirecciones();
        // Renderizar HTML principal
        container.innerHTML = createPanelHTML(direcciones);
        // Configurar event listeners
        setupEventListeners();
        hideLoading();
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        if (DEBUG.enabled) console.log('✅ Panel de directivos renderizado');    
    } catch (error) {
        console.error('❌ Error al renderizar panel:', error);
        hideLoading();
        showToast('Error al cargar el panel', 'error');
    }
}
async function cargarIndicadores() {
    try {
        const { data } = await selectData('v_indicadores_area', {
            orderBy: { column: 'area_nombre', ascending: true }
        });
        if (data) {
            // Filtrar por nombres exactos
            const nombresOperativos = [
                'Aviación Comercial Pasajeros',
                'Aviación Comercial Operaciones',
                'Aviación Carga Operaciones',
                'Aviación Carga Toneladas'
            ];
            const nombresFBO = [
                'Aviación General Pasajeros',
                'Aviación General Operaciones'
            ];
            panelState.indicadoresOperativos = data.filter(ind => 
                nombresOperativos.includes(ind.nombre)
            );
            panelState.indicadoresFBO = data.filter(ind => 
                nombresFBO.includes(ind.nombre)
            );
        }
        if (DEBUG.enabled) {
            console.log('Indicadores operativos:', panelState.indicadoresOperativos.length);
            console.log('Indicadores FBO:', panelState.indicadoresFBO.length);
        }
    } catch (error) {
        console.error('❌ Error al cargar indicadores:', error);
        panelState.indicadoresOperativos = [];
        panelState.indicadoresFBO = [];
    }
}
async function cargarDirecciones() {
    try {
        const { data } = await selectData('areas', {
            filters: { 
                estado: 'ACTIVO'
            },
            orderBy: { column: 'orden_visualizacion', ascending: true }
        });
        // Filtrar solo nivel 1 (DG) y nivel 2 (Direcciones)
        const direccionesFiltradas = (data || []).filter(area => 
            area.nivel === 1 || area.nivel === 2
        );
        return direccionesFiltradas;
    } catch (error) {
        console.error('❌ Error al cargar direcciones:', error);
        return [];
    }
}
async function cargarSubdirecciones(parentAreaId) {
    try {
        // Si ya están en caché, retornarlas
        if (panelState.subdirecciones.has(parentAreaId)) {
            return panelState.subdirecciones.get(parentAreaId);
        }
        const { data } = await selectData('areas', {
            filters: { 
                estado: 'ACTIVO',
                parent_area_id: parentAreaId
            },
            orderBy: { column: 'orden_visualizacion', ascending: true }
        });
        // Guardar en caché
        panelState.subdirecciones.set(parentAreaId, data || []);
        return data || [];
    } catch (error) {
        console.error('❌ Error al cargar subdirecciones:', error);
        return [];
    }
}
// =====================================================
// CREACIÓN DE HTML
// =====================================================
function createPanelHTML(direcciones = []) {
    return `
        <div class="space-y-6">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
                <h1 class="text-2xl font-bold mb-2">Panel de Análisis de Indicadores</h1>
                <p class="text-blue-100">Seleccione un indicador para ver las opciones disponibles</p>
            </div>
            <!-- Indicadores Operativos -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i data-lucide="plane" class="w-5 h-5 text-blue-600"></i>
                    Indicadores Operativos
                </h2>
                <div class="space-y-3" id="indicadores-operativos-container">
                    ${panelState.indicadoresOperativos.map(ind =>
                        crearBotonIndicador(ind.id, ind.nombre, ind.area_nombre, getIndicadorVisual(ind.nombre, 'blue'))
                    ).join('')}
                </div>
            </div>
            <!-- Indicadores FBO -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i data-lucide="plane-takeoff" class="w-5 h-5 text-green-600"></i>
                    Indicadores FBO (Aviación General)
                </h2>
                <div class="space-y-3" id="indicadores-fbo-container">
                    ${panelState.indicadoresFBO.map(ind =>
                        crearBotonIndicador(ind.id, ind.nombre, ind.area_nombre, getIndicadorVisual(ind.nombre, 'green'))
                    ).join('')}
                </div>
            </div>
            <!-- Contenedor de resultados -->
            <div id="resultados-container"></div>
          <!-- Direcciones -->
          <div class="bg-white rounded-lg shadow-lg p-6">
              <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <i data-lucide="folder-tree" class="w-5 h-5 text-blue-600"></i>
                  Direcciones
              </h2>
              <div class="space-y-3">
                  ${crearDireccionesJerarquicas(direcciones)}
              </div>
          </div>
        </div>
    `;
}
function getIndicadorVisual(nombre, fallbackColor) {
    const config = indicadorVisualConfig[nombre];

    if (config) {
        return config;
    }

    return {
        icon: fallbackColor === 'green' ? 'plane-takeoff' : 'plane',
        color: fallbackColor
    };
}
function crearBotonIndicador(id, titulo, subtitulo, visualConfig) {
    const colorClasses = {
        blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-900',
        amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900',
        green: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-900'
    };
    const { icon, color } = visualConfig;
    return `
        <div class="border-2 border-gray-200 rounded-lg overflow-hidden transition-all" id="card-${id}">
            <button
                onclick="window.panelDirectivos.toggleIndicador('${id}')"
                class="w-full p-4 ${colorClasses[color] || colorClasses.blue} transition-all text-left flex items-center justify-between"
            >
                <div class="flex items-center gap-3">
                    <span class="flex items-center justify-center w-10 h-10 rounded-full bg-white/60 border border-white/50">
                        <i data-lucide="${icon}" class="w-5 h-5"></i>
                    </span>
                    <div>
                        <h3 class="font-bold">${titulo}</h3>
                        <p class="text-sm opacity-75">${subtitulo}</p>
                    </div>
                </div>
                <i data-lucide="chevron-down" class="w-5 h-5 transition-transform" id="icon-${id}"></i>
            </button>
            <div class="hidden bg-gray-50 border-t p-4 space-y-2" id="submenu-${id}">
                ${crearOpcionesAnalisis(id, titulo)}
            </div>
        </div>
    `;
}
function crearOpcionesAnalisis(indicadorId, nombreIndicador) {
    const opciones = [
        { id: 'mensual_vs_anterior', texto: `Cantidad de ${nombreIndicador} real mensual del año en curso respecto al mismo periodo del año anterior`, icono: 'trending-up' },
        { id: 'trimestral_vs_anterior', texto: `Cantidad de ${nombreIndicador} real trimestral del año en curso respecto al mismo periodo del año anterior`, icono: 'bar-chart-2' },
        { id: 'anual_vs_anterior', texto: `Cantidad de ${nombreIndicador} real anual del año en curso respecto al mismo periodo del año anterior`, icono: 'calendar' },
        { id: 'mensual_vs_bajo', texto: `Cantidad de ${nombreIndicador} real mensual del año en curso respecto a la proyección de meta escenario Bajo`, icono: 'target' },
        { id: 'mensual_vs_medio', texto: `Cantidad de ${nombreIndicador} real mensual del año en curso respecto a la proyección de meta escenario Mediano`, icono: 'target' },
        { id: 'mensual_vs_alto', texto: `Cantidad de ${nombreIndicador} real mensual del año en curso respecto a la proyección de meta escenario Alto`, icono: 'target' }
    ];
     return opciones.map(opcion => `
        <button 
            onclick="window.router.navigateTo('/panel-directivos/analisis?indicador=${indicadorId}&opcion=${opcion.id}')"
            class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-sm"
        >
            <i data-lucide="${opcion.icono}" class="w-4 h-4 inline mr-2"></i>
            ${opcion.texto}
        </button>
    `).join('');
}
function crearDireccionesJerarquicas(direcciones) {
    if (!direcciones || direcciones.length === 0) {
        return '<p class="text-gray-500 text-center py-4">No hay direcciones disponibles</p>';
    }
    // Separar por nivel
    const direccionGeneral = direcciones.filter(d => d.nivel === 1);
    const direccionesNivel2 = direcciones.filter(d => d.nivel === 2);
    let html = '';
    // Direcciones (nivel 2) - con subdirecciones desplegables
    if (direccionesNivel2.length > 0) {
        html += '<div class="space-y-2 mt-4">';
        direccionesNivel2.forEach(dir => {
            const isExpanded = panelState.expandedDirecciones.has(dir.id);
            html += `
                <div class="border-2 border-gray-200 rounded-lg overflow-hidden" id="dir-card-${dir.id}">
                    <button 
                        onclick="window.panelDirectivos.toggleDireccion('${dir.id}')"
                        class="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-all text-left flex items-center justify-between"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                 style="background-color: ${dir.color_hex || '#6B7280'}">
                                ${dir.clave.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-900">${dir.nombre}</h3>
                                <p class="text-sm text-gray-600">${dir.clave}</p>
                            </div>
                        </div>
                        <i data-lucide="chevron-${isExpanded ? 'down' : 'right'}" 
                           class="w-5 h-5 text-gray-400 transition-transform" 
                           id="chevron-dir-${dir.id}"></i>
                    </button>
                    
                    <!-- Contenedor de subdirecciones -->
                    <div id="subdirs-${dir.id}" class="${isExpanded ? '' : 'hidden'} bg-white border-t border-gray-200 p-3">
                        <div class="text-center py-4">
                            <i data-lucide="loader" class="w-6 h-6 text-gray-400 animate-spin mx-auto"></i>
                            <p class="text-sm text-gray-500 mt-2">Cargando subdirecciones...</p>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    return html;
}

// =====================================================
// EVENT LISTENERS Y FUNCIONES DE SELECCIÓN
// =====================================================

function setupEventListeners() {
    // Exponer funciones globalmente para los botones
    window.panelDirectivos = {
        toggleIndicador,
        toggleDireccion,
        seleccionarOpcion,
        seleccionarDireccion,
        toggleAnios,
        descargarDatos,
        imprimirReporte
    };
}

function toggleIndicador(indicadorId) {
    const card = document.getElementById(`card-${indicadorId}`);
    const submenu = document.getElementById(`submenu-${indicadorId}`);
    const icon = document.getElementById(`icon-${indicadorId}`);
    
    // Cerrar cualquier otro indicador abierto
    document.querySelectorAll('[id^="submenu-"]').forEach(sub => {
        if (sub.id !== `submenu-${indicadorId}` && !sub.classList.contains('hidden')) {
            sub.classList.add('hidden');
            const otherId = sub.id.replace('submenu-', '');
            const otherIcon = document.getElementById(`icon-${otherId}`);
            if (otherIcon) {
                otherIcon.classList.remove('rotate-180');
            }
        }
    });
    
    // Toggle del indicador actual
    submenu.classList.toggle('hidden');
    if (icon) {
        icon.classList.toggle('rotate-180');
    }
    
    // Guardar indicador seleccionado
    const todosIndicadores = [...panelState.indicadoresOperativos, ...panelState.indicadoresFBO];
    const indicador = todosIndicadores.find(i => i.id === indicadorId);
    panelState.indicadorSeleccionado = indicador;
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Limpiar resultados
    document.getElementById('resultados-container').innerHTML = '';
}
async function toggleDireccion(direccionId) {
    const container = document.getElementById(`subdirs-${direccionId}`);
    const chevron = document.getElementById(`chevron-dir-${direccionId}`);
    
    if (!container) return;
    
    // Cerrar cualquier otra dirección abierta (selección única)
    document.querySelectorAll('[id^="subdirs-"]').forEach(sub => {
        if (sub.id !== `subdirs-${direccionId}` && !sub.classList.contains('hidden')) {
            sub.classList.add('hidden');
            const otherId = sub.id.replace('subdirs-', '');
            const otherChevron = document.getElementById(`chevron-dir-${otherId}`);
            if (otherChevron) {
                otherChevron.setAttribute('data-lucide', 'chevron-right');
            }
            panelState.expandedDirecciones.delete(otherId);
        }
    });
    
    try {
        // Si está colapsado, expandir y cargar subdirecciones
        if (container.classList.contains('hidden')) {
            // Expandir
            container.classList.remove('hidden');
            if (chevron) {
                chevron.setAttribute('data-lucide', 'chevron-down');
            }
            
            // Agregar a expandidos
            panelState.expandedDirecciones.add(direccionId);
            
            // Cargar subdirecciones
            const subdirecciones = await cargarSubdirecciones(direccionId);
            
            // Renderizar subdirecciones
            if (subdirecciones && subdirecciones.length > 0) {
                container.innerHTML = `
                    <div class="space-y-2">
                        ${subdirecciones.map(subdir => `
                            <button 
                                onclick="window.panelDirectivos.seleccionarDireccion('${subdir.id}')"
                                class="w-full p-3 ml-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left flex items-center gap-3"
                            >
                                <div class="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                                     style="background-color: ${subdir.color_hex || '#9CA3AF'}">
                                    ${subdir.clave.substring(0, 2).toUpperCase()}
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-medium text-gray-900 text-sm">${subdir.nombre}</h4>
                                    <p class="text-xs text-gray-500">${subdir.clave}</p>
                                </div>
                                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                            </button>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-6 bg-gray-50 rounded">
                        <i data-lucide="folder-x" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                        <p class="text-sm text-gray-500">No hay subdirecciones disponibles</p>
                    </div>
                `;
            }
            
        } else {
            // Colapsar
            container.classList.add('hidden');
            if (chevron) {
                chevron.setAttribute('data-lucide', 'chevron-right');
            }
            
            // Quitar de expandidos
            panelState.expandedDirecciones.delete(direccionId);
        }
        
        // Recrear iconos de Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
    } catch (error) {
        console.error('❌ Error al toggle dirección:', error);
        showToast('Error al cargar subdirecciones', 'error');
    }
}

async function seleccionarOpcion(opcionId, event) {
    if (DEBUG.enabled) console.log('📋 Opción seleccionada:', opcionId);
    
    if (!panelState.indicadorSeleccionado) {
        showToast('Primero seleccione un indicador', 'warning');
        return;
    }
    
    panelState.opcionSeleccionada = opcionId;
    
    // Resaltar opción seleccionada
    document.querySelectorAll('.opcion-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'bg-blue-100');
    });
    
    const botonClickeado = event?.target?.closest('button');
    if (botonClickeado) {
        botonClickeado.classList.add('border-blue-500', 'bg-blue-100');
    }
    
    // Cargar y mostrar resultados
    await cargarYMostrarResultados();
}

function toggleAnios() {
    destruirGrafica('visualizacion');
    renderizarGrafica('comparativa');
}

function descargarDatos() {
    showToast('Descargando datos...', 'info');
    // TODO: Implementar descarga de Excel/CSV
}

function imprimirReporte() {
    window.print();
}
// =====================================================
// CARGA DE DATOS Y PROCESAMIENTO
// =====================================================

async function cargarYMostrarResultados() {
    try {
        showLoading('Cargando datos...');
        
        const indicador = panelState.indicadorSeleccionado;
        const opcion = panelState.opcionSeleccionada;
        
        // Cargar datos reales según el indicador
        await cargarDatosReales(indicador);
        
        // Determinar tipo de comparación y generar resultados
        let resultadosHTML = '';
        
        if (opcion.includes('vs_anterior')) {
            // Comparativo con año anterior
            if (opcion.includes('mensual')) {
                resultadosHTML = generarComparativoMensual();
            } else if (opcion.includes('trimestral')) {
                resultadosHTML = generarComparativoTrimestral();
            } else if (opcion.includes('anual')) {
                resultadosHTML = generarComparativoAnual();
            }
        } else {
            // Comparativo con metas
            const escenario = opcion.includes('bajo') ? 'bajo' : 
                            opcion.includes('medio') ? 'medio' : 'alto';
            await cargarDatosMetas(indicador, escenario);
            resultadosHTML = generarComparativoMeta(escenario);
        }
        
        // Mostrar resultados
        document.getElementById('resultados-container').innerHTML = resultadosHTML;
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        // Renderizar gráfica
        const tipoGrafica = opcion.includes('vs_') && !opcion.includes('anterior') ? 'meta' : 'comparativa';
        await renderizarGrafica(tipoGrafica);
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error al cargar resultados:', error);
        hideLoading();
        showToast('Error al cargar los datos', 'error');
    }
}

async function cargarDatosReales(indicador) {
    try {
        const { data, error } = await selectData('v_mediciones_historico', {
            filters: { indicador_id: indicador.id },
            orderBy: [
                { column: 'anio', ascending: true },
                { column: 'mes', ascending: true }
            ]
        });

        if (error) throw error;

        panelState.datosReales = normalizarSerieTemporal(data || []);
        if (DEBUG.enabled) console.log('📊 Datos reales cargados:', panelState.datosReales.length);

    } catch (error) {
        console.error('❌ Error al cargar datos reales:', error);
        throw error;
    }
}

function normalizarEscenarioClave(escenario, fallback = 'MEDIO') {
    const raw = (escenario || '').toString().trim().toUpperCase();

    if (!raw) {
        return fallback;
    }

    if (raw === 'MEDIANO') {
        return 'MEDIO';
    }

    return ['BAJO', 'MEDIO', 'ALTO'].includes(raw) ? raw : fallback;
}

async function cargarDatosMetas(indicador, escenario) {
    try {
        if (!indicador) {

            const escenarioSlug = escenario ? normalizarEscenarioClave(escenario, 'MEDIO').toLowerCase() : null;
            panelState.datosMetas = [];
            panelState.metaContext = {
                escenario: escenarioSlug,
                anio: null,
                mes: null,
                coincideConMedicion: false
            };
            return;
        }


        const escenarioKey = normalizarEscenarioClave(escenario, 'MEDIO');
        const escenarioSlug = escenarioKey.toLowerCase();

        panelState.metaContext = {
            escenario: escenarioSlug,
            anio: null,
            mes: null,
            coincideConMedicion: false
        };

        const { data } = await selectData('indicador_metas', {
            select: 'anio, mes, valor, escenario, fecha_captura, fecha_ultima_edicion',
            filters: {
                indicador_id: indicador.id,
                escenario: escenarioKey
            },
            orderBy: [
                { column: 'anio', ascending: true },
                { column: 'mes', ascending: true }
            ]
        });

        const metasNormalizadas = (data || [])
            .map(meta => {
                const anio = Number(meta?.anio);
                const mes = Number(meta?.mes);
                const valor = meta?.valor !== null && meta?.valor !== undefined ? Number(meta.valor) : null;

                return {
                    ...meta,
                    escenario: normalizarEscenarioClave(meta?.escenario || escenarioKey, escenarioKey),
                    anio: Number.isFinite(anio) ? anio : null,
                    mes: Number.isFinite(mes) ? mes : null,
                    valor
                };
            })
            .filter(meta => Number.isFinite(meta.anio) && Number.isFinite(meta.mes))
            .sort((a, b) => {
                if (a.anio !== b.anio) return a.anio - b.anio;
                return a.mes - b.mes;
            });

        panelState.datosMetas = metasNormalizadas;

        const metasConValor = metasNormalizadas.filter(meta => meta.valor !== null);
        const ultimoMes = obtenerUltimoMesConDatos();

        let metaReferencia = null;

        if (ultimoMes) {
            metaReferencia = metasConValor.find(meta => meta.anio === ultimoMes.año && meta.mes === ultimoMes.mes) || null;
        }

        if (!metaReferencia && metasConValor.length > 0) {
            metaReferencia = metasConValor[metasConValor.length - 1];
        }

        panelState.metaContext = {
            escenario: escenarioSlug,
            anio: metaReferencia?.anio ?? ultimoMes?.año ?? null,
            mes: metaReferencia?.mes ?? ultimoMes?.mes ?? null,
            coincideConMedicion: Boolean(
                metaReferencia &&
                ultimoMes &&
                metaReferencia.anio === ultimoMes.año &&
                metaReferencia.mes === ultimoMes.mes
            )
        };

        if (DEBUG.enabled) {
            console.log(
                `🎯 Metas cargadas: ${panelState.datosMetas.length} registros para ${indicador.nombre} (${escenarioKey})`
            );
            if (panelState.metaContext.anio && panelState.metaContext.mes) {
                console.log(
                    `   ➜ Meta de referencia: ${panelState.metaContext.anio}-${panelState.metaContext.mes} (coincide con medición: ${panelState.metaContext.coincideConMedicion})`
                );
            }
        }

    } catch (error) {
        console.error('❌ Error al cargar metas:', error);
        panelState.datosMetas = [];
        panelState.metaContext = {
            escenario: escenario ? normalizarEscenarioClave(escenario, 'MEDIO').toLowerCase() : null,
            anio: null,
            mes: null,
            coincideConMedicion: false
        };
        throw error;
    }
}

function obtenerUltimoMesConDatos() {
    if (panelState.datosReales.length === 0) return null;

    const ultimoRegistro = [...panelState.datosReales]
        .reverse()
        .find(registro => registro.valor !== null && registro.valor !== undefined);

    if (!ultimoRegistro) return null;

    return {
        mes: ultimoRegistro.mes,
        año: ultimoRegistro.anio,
        fecha: ultimoRegistro.fecha,
        valor: ultimoRegistro.valor
    };
}

function calcularVariacion(actual, anterior) {
    if (!anterior || anterior === 0) return { diferencia: actual, porcentaje: 0 };
    
    const diferencia = actual - anterior;
    const porcentaje = ((diferencia / anterior) * 100).toFixed(2);
    
    return { diferencia, porcentaje };
}

function obtenerUltimoTrimestreCompleto() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return null;
    
    const trimestre = Math.floor((ultimoMes.mes - 1) / 3) + 1;
    const mesFinTrimestre = trimestre * 3;
    
    // Si el trimestre actual NO está completo, usar el anterior
    if (ultimoMes.mes < mesFinTrimestre) {
        const trimestreAnterior = trimestre - 1;
        if (trimestreAnterior < 1) return null; // No hay trimestre completo en el año
        
        return {
            trimestre: trimestreAnterior,
            año: ultimoMes.año,
            meses: [(trimestreAnterior - 1) * 3 + 1, (trimestreAnterior - 1) * 3 + 2, (trimestreAnterior - 1) * 3 + 3]
        };
    }
    
    // El trimestre actual está completo
    return {
        trimestre,
        año: ultimoMes.año,
        meses: [(trimestre - 1) * 3 + 1, (trimestre - 1) * 3 + 2, (trimestre - 1) * 3 + 3]
    };
}
// =====================================================
// GENERACIÓN DE HTML DE RESULTADOS
// =====================================================

function generarComparativoMensual() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    const mesAnterior = panelState.datosReales.find(d => 
        d.mes === ultimoMes.mes && d.anio === ultimoMes.año - 1
    );
    
    const variacion = calcularVariacion(ultimoMes.valor, mesAnterior?.valor || 0);
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Mensual vs Año Anterior</p>
                <p class="text-sm text-gray-500 mt-2">Último mes con datos: ${nombresMeses[ultimoMes.mes - 1]} ${ultimoMes.año}</p>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoMes.año}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoMes.año - 1}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap font-medium">${nombresMeses[ultimoMes.mes - 1]}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(ultimoMes.valor)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(mesAnterior?.valor || 0)}</td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.diferencia >= 0 ? '+' : ''}${formatNumber(variacion.diferencia)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.porcentaje >= 0 ? '+' : ''}${variacion.porcentaje}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="border-t pt-4">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-gray-900">Gráfica Comparativa Mensual</h4>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="check-4anios" class="rounded" onchange="window.panelDirectivos.toggleAnios()">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                <div class="h-80">
                    <canvas id="grafica-container"></canvas>
                </div>
            </div>
            
            <div class="flex gap-3 pt-4 border-t">
                <button onclick="window.panelDirectivos.descargarDatos()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar
                </button>
                <button onclick="window.panelDirectivos.imprimirReporte()" class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    Imprimir
                </button>
            </div>
        </div>
    `;
}

function generarComparativoTrimestral() {
    const ultimoTrimestre = obtenerUltimoTrimestreCompleto();
    if (!ultimoTrimestre) return '<p class="text-gray-500">No hay datos disponibles para trimestre completo</p>';
    
    const valorActual = panelState.datosReales
        .filter(d => d.anio === ultimoTrimestre.año && ultimoTrimestre.meses.includes(d.mes))
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    const valorAnterior = panelState.datosReales
        .filter(d => d.anio === ultimoTrimestre.año - 1 && ultimoTrimestre.meses.includes(d.mes))
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    const variacion = calcularVariacion(valorActual, valorAnterior);
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Trimestral vs Año Anterior</p>
                <p class="text-sm text-gray-500 mt-2">Último trimestre completo: Trimestre ${ultimoTrimestre.trimestre}
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoTrimestre.año}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoTrimestre.año - 1}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap font-medium">Trimestre ${ultimoTrimestre.trimestre}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(valorActual)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(valorAnterior)}</td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.diferencia >= 0 ? '+' : ''}${formatNumber(variacion.diferencia)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.porcentaje >= 0 ? '+' : ''}${variacion.porcentaje}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="border-t pt-4">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-gray-900">Gráfica Comparativa Mensual</h4>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="check-4anios" class="rounded" onchange="window.panelDirectivos.toggleAnios()">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                <div class="h-80">
                    <canvas id="grafica-container"></canvas>
                </div>
            </div>
            
            <div class="flex gap-3 pt-4 border-t">
                <button onclick="window.panelDirectivos.descargarDatos()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar
                </button>
                <button onclick="window.panelDirectivos.imprimirReporte()" class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    Imprimir
                </button>
            </div>
        </div>
    `;
}

function generarComparativoAnual() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    const valorActual = panelState.datosReales
        .filter(d => d.anio === ultimoMes.año && d.mes <= ultimoMes.mes)
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    const valorAnterior = panelState.datosReales
        .filter(d => d.anio === ultimoMes.año - 1 && d.mes <= ultimoMes.mes)
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    const variacion = calcularVariacion(valorActual, valorAnterior);
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Anual vs Año Anterior</p>
                <p class="text-sm text-gray-500 mt-2">Año en curso: ${ultimoMes.año} (consolidado hasta el mes con datos)</p>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoMes.año}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor ${ultimoMes.año - 1}</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap font-medium">Año ${ultimoMes.año}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(valorActual)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(valorAnterior)}</td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.diferencia >= 0 ? '+' : ''}${formatNumber(variacion.diferencia)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap ${variacion.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${variacion.porcentaje >= 0 ? '+' : ''}${variacion.porcentaje}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="border-t pt-4">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-gray-900">Gráfica Comparativa Mensual</h4>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="check-4anios" class="rounded" onchange="window.panelDirectivos.toggleAnios()">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                <div class="h-80">
                    <canvas id="grafica-container"></canvas>
                </div>
            </div>
            
            <div class="flex gap-3 pt-4 border-t">
                <button onclick="window.panelDirectivos.descargarDatos()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar
                </button>
                <button onclick="window.panelDirectivos.imprimirReporte()" class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    Imprimir
                </button>
            </div>
        </div>
    `;
}
// =====================================================
// COMPARATIVO CON METAS
// =====================================================

function generarComparativoMeta(escenario) {
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const nombreEscenario = ESCENARIO_LABELS[escenario] || (escenario.charAt(0).toUpperCase() + escenario.slice(1));

    if (!panelState.datosMetas.length) {
        return '<p class="text-gray-500">No hay metas capturadas para este escenario.</p>';
    }

    const metaContext = panelState.metaContext || {};
    const metaAnio = metaContext.anio;
    const metaMesNumero = metaContext.mes;

    if (!Number.isFinite(metaAnio) || !Number.isFinite(metaMesNumero)) {
        return '<p class="text-gray-500">No hay metas capturadas para este escenario.</p>';
    }

    const metaMes = panelState.datosMetas.find(meta => meta.anio === metaAnio && meta.mes === metaMesNumero && meta.valor !== null);

    if (!metaMes) {
        return '<p class="text-gray-500">No hay metas capturadas para este escenario en el periodo seleccionado.</p>';
    }

    const registroReal = panelState.datosReales.find(d => d.anio === metaMes.anio && d.mes === metaMes.mes) || null;
    const valorReal = registroReal?.valor ?? null;
    const meta = metaMes.valor ?? null;

    const diferencia = valorReal !== null && meta !== null ? valorReal - meta : null;
    const cumplimiento = valorReal !== null && meta > 0 ? ((valorReal / meta) * 100).toFixed(2) : null;

    const etiquetaPeriodo = `${nombresMeses[metaMes.mes - 1]} ${metaMes.anio}`;
    const valorRealTexto = valorReal !== null
        ? formatNumber(valorReal)
        : '<span class="text-gray-400 italic">Sin medición</span>';

    const diferenciaTexto = diferencia !== null
        ? `${diferencia >= 0 ? '+' : ''}${formatNumber(diferencia)}`
        : '<span class="text-gray-400">—</span>';

    const cumplimientoTexto = cumplimiento !== null
        ? `${cumplimiento}%`
        : '<span class="text-gray-400">—</span>';

    const diferenciaClase = diferencia !== null
        ? (diferencia >= 0 ? 'text-green-600' : 'text-red-600')
        : 'text-gray-500';

    const cumplimientoValor = cumplimiento !== null ? parseFloat(cumplimiento) : null;
    const cumplimientoClase = cumplimientoValor !== null
        ? (cumplimientoValor >= 100 ? 'text-green-600' : cumplimientoValor >= 90 ? 'text-yellow-600' : 'text-red-600')
        : 'text-gray-500';

    const notaPeriodo = metaContext.coincideConMedicion
        ? `Último mes con datos: ${etiquetaPeriodo}`
        : `Última meta capturada: ${etiquetaPeriodo}${valorReal === null ? ' (sin medición capturada en ese periodo)' : ''}`;

    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Real vs Meta - Escenario ${nombreEscenario}</p>
                <p class="text-sm text-gray-500 mt-2">${notaPeriodo}</p>
            </div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Real</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meta</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Cumplimiento</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap font-medium">${etiquetaPeriodo}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${valorRealTexto}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(meta)}</td>
                            <td class="px-6 py-4 whitespace-nowrap ${diferenciaClase}">
                                ${diferenciaTexto}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap ${cumplimientoClase}">
                                ${cumplimientoTexto}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="border-t pt-4">
                <h4 class="font-semibold text-gray-900 mb-4">Gráfica Real vs Meta</h4>
                <div class="h-80">
                    <canvas id="grafica-container"></canvas>
                </div>
            </div>
            
            <div class="flex gap-3 pt-4 border-t">
                <button onclick="window.panelDirectivos.descargarDatos()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar
                </button>
                <button onclick="window.panelDirectivos.imprimirReporte()" class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    Imprimir
                </button>
            </div>
        </div>
    `;
}

// =====================================================
// RENDERIZADO DE GRÁFICAS
// =====================================================

async function renderizarGrafica(tipo = 'comparativa') {
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = document.getElementById('grafica-container');
    if (!canvas) {
        console.error('Canvas no encontrado');
        return;
    }
    
    const ultimoMes = obtenerUltimoMesConDatos();

    if (tipo !== 'meta' && !ultimoMes) return;

    const indicador = panelState.indicadorSeleccionado;

    if (tipo === 'meta') {
        const metaContext = panelState.metaContext || {};
        const escenarioSlug = metaContext.escenario
            || (panelState.opcionSeleccionada.includes('bajo') ? 'bajo'
                : panelState.opcionSeleccionada.includes('medio') ? 'medio'
                    : 'alto');

        const nombreEscenario = ESCENARIO_LABELS[escenarioSlug] || (escenarioSlug.charAt(0).toUpperCase() + escenarioSlug.slice(1));
        const escenarioNombre = `Escenario ${nombreEscenario}`;

        const anioMeta = metaContext.anio ?? ultimoMes?.año ?? new Date().getFullYear();

        await crearGraficaMeta('grafica-container', panelState.datosReales, panelState.datosMetas, {
            anio: anioMeta,
            escenario: escenarioSlug,
            titulo: `${indicador.nombre} - Real vs Meta (${escenarioNombre})`,
            escenarioLabel: `Meta ${escenarioNombre}`,
            unidadMedida: indicador.unidad_medida || 'Unidades',
            nombreIndicador: indicador.nombre
        });
    } else {
        if (!ultimoMes) return;

        const checkbox = document.getElementById('check-4anios');
        const mostrar4Anios = checkbox?.checked || false;

        const aniosDisponibles = [...new Set(panelState.datosReales.map(d => d.anio))].sort();
        const aniosAMostrar = mostrar4Anios ? aniosDisponibles.slice(-4) : [ultimoMes.año - 1, ultimoMes.año];
        
        await crearGraficaHistorica('grafica-container', panelState.datosReales, {
            aniosSeleccionados: aniosAMostrar,
            titulo: `${indicador.nombre} - Comparativo`,
            unidadMedida: indicador.unidad_medida || 'Unidades'
        });
    }
}   
function seleccionarDireccion(direccionId) {
    showToast('Funcionalidad de dirección en desarrollo', 'info');
    // TODO: Implementar navegación a vista de dirección
}

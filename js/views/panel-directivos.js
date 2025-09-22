// =====================================================
// PANEL DE ANÁLISIS DE INDICADORES PARA DIRECTIVOS
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatNumber } from '../lib/ui.js';
import { crearGraficaMeta, crearGraficaHistorica, destruirGrafica } from '../lib/charts.js';

// Estado del panel de directivos
const panelState = {
    userProfile: null,
    indicadorSeleccionado: null,
    opcionSeleccionada: null,
    indicadoresOperativos: [],
    indicadoresFBO: [],
    datosReales: [],
    datosMetas: [],
    loading: false
};

// =====================================================
// RENDERIZADO PRINCIPAL
// =====================================================

export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📊 Renderizando Panel de Directivos');
        
        showLoading('Cargando panel...');
        
        // Obtener perfil del usuario
        panelState.userProfile = await getCurrentProfile();
        if (!panelState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Cargar indicadores disponibles
        await cargarIndicadores();
        
        // Renderizar HTML principal
        container.innerHTML = createPanelHTML();
        
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
            // Separar por categoría basándose en el nombre del área o indicador
            panelState.indicadoresOperativos = data.filter(ind => 
                ind.area_nombre.toLowerCase().includes('comercial') || 
                ind.area_nombre.toLowerCase().includes('carga') ||
                ind.nombre.toLowerCase().includes('comercial') ||
                ind.nombre.toLowerCase().includes('carga')
            );
            
            panelState.indicadoresFBO = data.filter(ind => 
                ind.area_nombre.toLowerCase().includes('general') || 
                ind.area_nombre.toLowerCase().includes('fbo') ||
                ind.nombre.toLowerCase().includes('general') ||
                ind.nombre.toLowerCase().includes('fbo')
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
// =====================================================
// CREACIÓN DE HTML
// =====================================================

function createPanelHTML() {
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
                        crearBotonIndicador(ind.id, ind.nombre, ind.area_nombre, 'plane', 'blue')
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
                        crearBotonIndicador(ind.id, ind.nombre, ind.area_nombre, 'plane-takeoff', 'green')
                    ).join('')}
                </div>
            </div>

            <!-- Contenedor de resultados -->
            <div id="resultados-container"></div>
        </div>
    `;
}

function crearBotonIndicador(id, titulo, subtitulo, icono, color) {
    const colorClasses = {
        blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-900',
        amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900',
        green: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-900'
    };
    
    return `
        <div class="border-2 border-gray-200 rounded-lg overflow-hidden transition-all" id="card-${id}">
            <button 
                onclick="window.panelDirectivos.toggleIndicador('${id}')"
                class="w-full p-4 ${colorClasses[color]} transition-all text-left flex items-center justify-between"
            >
                <div class="flex items-center gap-3">
                    <i data-lucide="${icono}" class="w-6 h-6"></i>
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
            onclick="window.panelDirectivos.seleccionarOpcion('${opcion.id}', event)"
            class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-sm"
        >
            <i data-lucide="${opcion.icono}" class="w-4 h-4 inline mr-2"></i>
            ${opcion.texto}
        </button>
    `).join('');
}
// =====================================================
// EVENT LISTENERS Y FUNCIONES DE SELECCIÓN
// =====================================================

function setupEventListeners() {
    // Exponer funciones globalmente para los botones
    window.panelDirectivos = {
        toggleIndicador,
        seleccionarOpcion,
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
            orderBy: { column: 'anio', ascending: true }
        });
        
        if (error) throw error;
        
        panelState.datosReales = (data || []).map(d => ({
            ...d,
            fecha: `${d.anio}-${String(d.mes).padStart(2, '0')}-01`,
            valor: d.valor
        }));
        
        if (DEBUG.enabled) console.log('📊 Datos reales cargados:', panelState.datosReales.length);
        
    } catch (error) {
        console.error('❌ Error al cargar datos reales:', error);
        throw error;
    }
}

async function cargarDatosMetas(indicador, escenario) {
    try {
        // TODO: Implementar cuando exista tabla de metas
        // Por ahora usar meta_anual del indicador dividida entre 12
        panelState.datosMetas = [];
        
        if (indicador.meta_anual) {
            const metaMensual = indicador.meta_anual / 12;
            const anioActual = new Date().getFullYear();
            
            for (let mes = 1; mes <= 12; mes++) {
                panelState.datosMetas.push({
                    fecha: `${anioActual}-${String(mes).padStart(2, '0')}-01`,
                    valor: metaMensual,
                    mes: mes,
                    anio: anioActual
                });
            }
        }
        
        if (DEBUG.enabled) console.log('🎯 Datos de metas cargados:', panelState.datosMetas.length);
        
    } catch (error) {
        console.error('❌ Error al cargar metas:', error);
        throw error;
    }
}

function obtenerUltimoMesConDatos() {
    if (panelState.datosReales.length === 0) return null;
    
    const ultimoRegistro = panelState.datosReales[panelState.datosReales.length - 1];
    
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
                <p class="text-sm text-gray-500 mt-2">Último trimestre completo: Q${ultimoTrimestre.trimestre} ${ultimoTrimestre.año}</p>
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
                            <td class="px-6 py-4 whitespace-nowrap font-medium">Q${ultimoTrimestre.trimestre}</td>
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
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes || panelState.datosMetas.length === 0) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    const metaMes = panelState.datosMetas.find(d => d.mes === ultimoMes.mes && d.anio === ultimoMes.año);
    
    const meta = metaMes?.valor || 0;
    const diferencia = ultimoMes.valor - meta;
    const cumplimiento = meta > 0 ? ((ultimoMes.valor / meta) * 100).toFixed(2) : 0;
    
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const nombreEscenario = escenario.charAt(0).toUpperCase() + escenario.slice(1);
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Real vs Meta - Escenario ${nombreEscenario}</p>
                <p class="text-sm text-gray-500 mt-2">Último mes con datos: ${nombresMeses[ultimoMes.mes - 1]} ${ultimoMes.año}</p>
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
                            <td class="px-6 py-4 whitespace-nowrap font-medium">${nombresMeses[ultimoMes.mes - 1]} ${ultimoMes.año}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(ultimoMes.valor)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${formatNumber(meta)}</td>
                            <td class="px-6 py-4 whitespace-nowrap ${diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${diferencia >= 0 ? '+' : ''}${formatNumber(diferencia)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap ${cumplimiento >= 100 ? 'text-green-600' : cumplimiento >= 90 ? 'text-yellow-600' : 'text-red-600'}">
                                ${cumplimiento}%
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
    if (!ultimoMes) return;
    
    const indicador = panelState.indicadorSeleccionado;
    
    if (tipo === 'meta') {
        await crearGraficaMeta('grafica-container', panelState.datosReales, panelState.datosMetas, {
            anio: ultimoMes.año,
            escenario: panelState.opcionSeleccionada.includes('bajo') ? 'bajo' : 
                      panelState.opcionSeleccionada.includes('medio') ? 'medio' : 'alto',
            titulo: `${indicador.nombre} - Real vs Meta`,
            unidadMedida: indicador.unidad_medida || 'Unidades',
            nombreIndicador: indicador.nombre
        });
    } else {
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

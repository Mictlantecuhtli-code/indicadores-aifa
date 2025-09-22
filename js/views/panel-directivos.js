// =====================================================
// PANEL DE ANÁLISIS DE INDICADORES PARA DIRECTIVOS
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatNumber } from '../lib/ui.js';

// Estado del panel de directivos
const panelState = {
    userProfile: null,
    indicadorSeleccionado: null,
    opcionSeleccionada: null,
    indicadoresDisponibles: [
        { 
            id: 'pasajeros_comercial', 
            nombre: 'Pasajeros Comercial',
            categoria: 'operativos',
            tabla: 'pasajeros_comercial'
        },
        { 
            id: 'operaciones_comercial', 
            nombre: 'Operaciones Comercial',
            categoria: 'operativos',
            tabla: 'operaciones_comercial'
        },
        { 
            id: 'carga_operaciones', 
            nombre: 'Carga - Operaciones',
            categoria: 'operativos',
            tabla: 'carga_operaciones'
        },
        { 
            id: 'carga_toneladas', 
            nombre: 'Carga - Toneladas',
            categoria: 'operativos',
            tabla: 'carga_toneladas'
        },
        { 
            id: 'pasajeros_fbo', 
            nombre: 'Pasajeros',
            categoria: 'fbo',
            tabla: 'pasajeros_aviacion_general'
        },
        { 
            id: 'operaciones_fbo', 
            nombre: 'Operaciones',
            categoria: 'fbo',
            tabla: 'operaciones_aviacion_general'
        }
    ],
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
                <div class="space-y-3">
                    ${crearBotonIndicador('pasajeros_comercial', 'Pasajeros Comercial', 'Aviación Comercial', 'users', 'blue')}
                    ${crearBotonIndicador('operaciones_comercial', 'Operaciones Comercial', 'Aviación Comercial', 'plane', 'blue')}
                    ${crearBotonIndicador('carga_operaciones', 'Carga - Operaciones', 'Operaciones de Carga', 'package', 'amber')}
                    ${crearBotonIndicador('carga_toneladas', 'Carga - Toneladas', 'Toneladas Transportadas', 'weight', 'amber')}
                </div>
            </div>

            <!-- Indicadores FBO -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i data-lucide="plane-takeoff" class="w-5 h-5 text-green-600"></i>
                    Indicadores FBO (Aviación General)
                </h2>
                <div class="space-y-3">
                    ${crearBotonIndicador('pasajeros_fbo', 'Pasajeros', 'Aviación General', 'users', 'green')}
                    ${crearBotonIndicador('operaciones_fbo', 'Operaciones', 'Aviación General', 'plane-takeoff', 'green')}
                </div>
            </div>

            <!-- Contenedor de resultados -->
            <div id="resultados-container"></div>
        </div>
    `;
}

function crearBotonIndicador(id, titulo, subtitulo, icono, color) {
    const indicador = panelState.indicadoresDisponibles.find(i => i.id === id);
    if (!indicador) return '';
    
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
                ${crearOpcionesAnalisis(indicador)}
            </div>
        </div>
    `;
}

function crearOpcionesAnalisis(indicador) {
    const opciones = [
        { id: 'mensual_vs_anterior', texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto al mismo periodo del año anterior`, icono: 'trending-up' },
        { id: 'trimestral_vs_anterior', texto: `Cantidad de ${indicador.nombre} real trimestral del año en curso respecto al mismo periodo del año anterior`, icono: 'bar-chart-2' },
        { id: 'anual_vs_anterior', texto: `Cantidad de ${indicador.nombre} real anual del año en curso respecto al mismo periodo del año anterior`, icono: 'calendar' },
        { id: 'mensual_vs_bajo', texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Bajo`, icono: 'target' },
        { id: 'mensual_vs_medio', texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Mediano`, icono: 'target' },
        { id: 'mensual_vs_alto', texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Alto`, icono: 'target' }
    ];
    
    return opciones.map(opcion => `
        <button 
            onclick="window.panelDirectivos.seleccionarOpcion('${opcion.id}')"
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
    window.panelDirectivos = {
        toggleIndicador,
        seleccionarIndicador,
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
            document.getElementById(`icon-${otherId}`)?.classList.remove('rotate-180');
        }
    });
    
    // Toggle del indicador actual
    submenu.classList.toggle('hidden');
    icon?.classList.toggle('rotate-180');
    
    // Guardar indicador seleccionado
    const indicador = panelState.indicadoresDisponibles.find(i => i.id === indicadorId);
    panelState.indicadorSeleccionado = indicador;
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Limpiar resultados
    document.getElementById('resultados-container').innerHTML = '';
}

function seleccionarIndicador(indicadorId) {
    if (DEBUG.enabled) console.log('📊 Indicador seleccionado:', indicadorId);
    
    // Buscar el indicador
    const indicador = panelState.indicadoresDisponibles.find(i => i.id === indicadorId);
    if (!indicador) return;
    
    panelState.indicadorSeleccionado = indicador;
    panelState.opcionSeleccionada = null;
    
    // Actualizar UI - resaltar botón seleccionado
    document.querySelectorAll('.indicador-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'border-green-500', 'bg-blue-200', 'bg-green-200');
    });
    event.target.closest('.indicador-btn').classList.add(
        indicador.categoria === 'operativos' ? 'border-blue-500' : 'border-green-500',
        indicador.categoria === 'operativos' ? 'bg-blue-200' : 'bg-green-200'
    );
    
    // Mostrar opciones
    mostrarOpciones(indicador);
}

function mostrarOpciones(indicador) {
    const opcionesContainer = document.getElementById('opciones-container');
    const opcionesTitulo = document.getElementById('opciones-titulo');
    const opcionesLista = document.getElementById('opciones-lista');
    
    opcionesTitulo.textContent = `Opciones para: ${indicador.nombre}`;
    
    const opciones = [
        {
            id: 'mensual_vs_anterior',
            texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto al mismo periodo del año anterior`,
            tipo: 'comparativo'
        },
        {
            id: 'trimestral_vs_anterior',
            texto: `Cantidad de ${indicador.nombre} real trimestral del año en curso respecto al mismo periodo del año anterior`,
            tipo: 'comparativo'
        },
        {
            id: 'anual_vs_anterior',
            texto: `Cantidad de ${indicador.nombre} real anual del año en curso respecto al mismo periodo del año anterior`,
            tipo: 'comparativo'
        },
        {
            id: 'mensual_vs_bajo',
            texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Bajo`,
            tipo: 'meta',
            escenario: 'bajo'
        },
        {
            id: 'mensual_vs_medio',
            texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Mediano`,
            tipo: 'meta',
            escenario: 'medio'
        },
        {
            id: 'mensual_vs_alto',
            texto: `Cantidad de ${indicador.nombre} real mensual del año en curso respecto a la proyección de meta escenario Alto`,
            tipo: 'meta',
            escenario: 'alto'
        }
    ];
    
    opcionesLista.innerHTML = opciones.map(opcion => `
        <button 
            onclick="window.panelDirectivos.seleccionarOpcion('${opcion.id}')"
            class="opcion-btn w-full text-left p-3 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
            data-opcion="${opcion.id}"
        >
            <i data-lucide="${opcion.tipo === 'meta' ? 'target' : 'trending-up'}" class="w-4 h-4 inline mr-2"></i>
            ${opcion.texto}
        </button>
    `).join('');
    
    opcionesContainer.classList.remove('hidden');
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Limpiar resultados previos
    document.getElementById('resultados-container').innerHTML = '';
}

async function seleccionarOpcion(opcionId) {
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
    event.target.closest('.opcion-btn').classList.add('border-blue-500', 'bg-blue-100');
    
    // Cargar y mostrar resultados
    await cargarYMostrarResultados();
}
// =====================================================
// CARGA DE DATOS Y GENERACIÓN DE RESULTADOS
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
                resultadosHTML = await generarComparativoMensual();
            } else if (opcion.includes('trimestral')) {
                resultadosHTML = await generarComparativoTrimestral();
            } else if (opcion.includes('anual')) {
                resultadosHTML = await generarComparativoAnual();
            }
        } else {
            // Comparativo con metas
            const escenario = opcion.includes('bajo') ? 'bajo' : 
                            opcion.includes('medio') ? 'medio' : 'alto';
            await cargarDatosMetas(indicador, escenario);
            resultadosHTML = await generarComparativoMeta(escenario);
        }
        
        // Mostrar resultados
        document.getElementById('resultados-container').innerHTML = resultadosHTML;
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error al cargar resultados:', error);
        hideLoading();
        showToast('Error al cargar los datos', 'error');
    }
}

async function cargarDatosReales(indicador) {
    try {
        // Obtener datos de la tabla correspondiente
        const { data, error } = await selectData(indicador.tabla, {
            order: { column: 'fecha', ascending: true }
        });
        
        if (error) throw error;
        
        panelState.datosReales = data || [];
        
        if (DEBUG.enabled) console.log('📊 Datos reales cargados:', panelState.datosReales.length);
        
    } catch (error) {
        console.error('❌ Error al cargar datos reales:', error);
        throw error;
    }
}

async function cargarDatosMetas(indicador, escenario) {
    try {
        // Obtener metas según el escenario
        const { data, error } = await selectData('metas_' + indicador.tabla, {
            filters: { escenario },
            order: { column: 'fecha', ascending: true }
        });
        
        if (error) throw error;
        
        panelState.datosMetas = data || [];
        
        if (DEBUG.enabled) console.log('🎯 Datos de metas cargados:', panelState.datosMetas.length);
        
    } catch (error) {
        console.error('❌ Error al cargar metas:', error);
        throw error;
    }
}

async function generarGraficaComparativa(tipo = 'mensual') {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '';
    
    const datos = panelState.datosReales;
    const indicador = panelState.indicadorSeleccionado;
    
    // Determinar años a mostrar
    const checkbox = document.getElementById('check-4anios');
    const mostrar4Anios = checkbox?.checked || false;
    
    const aniosDisponibles = [...new Set(datos.map(d => new Date(d.fecha).getFullYear()))].sort();
    const aniosAMostrar = mostrar4Anios ? aniosDisponibles.slice(-4) : [ultimoMes.año - 1, ultimoMes.año];
    
    // Preparar datos por año
    const datasets = aniosAMostrar.map((anio, index) => {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const valores = meses.map((_, mesIdx) => {
            const medicion = datos.find(d => {
                const fecha = new Date(d.fecha);
                return fecha.getFullYear() === anio && fecha.getMonth() === mesIdx;
            });
            return medicion ? medicion.valor : null;
        });
        
        const colores = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
        
        return {
            label: `${anio}`,
            data: valores,
            borderColor: colores[index % colores.length],
            backgroundColor: colores[index % colores.length] + '20',
            tension: 0.4,
            fill: false
        };
    });
    
    return {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        datasets
    };
}

async function generarGraficaMeta() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes || panelState.datosMetas.length === 0) return '';
    
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Datos reales del año actual
    const valoresReales = meses.map((_, mesIdx) => {
        const medicion = panelState.datosReales.find(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoMes.año && fecha.getMonth() === mesIdx;
        });
        return medicion ? medicion.valor : null;
    });
    
    // Datos de meta
    const valoresMeta = meses.map((_, mesIdx) => {
        const meta = panelState.datosMetas.find(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoMes.año && fecha.getMonth() === mesIdx;
        });
        return meta ? meta.valor : null;
    });
    
    return {
        labels: meses,
        datasets: [
            {
                label: 'Real',
                data: valoresReales,
                borderColor: '#3B82F6',
                backgroundColor: '#3B82F620',
                tension: 0.4,
                fill: false
            },
            {
                label: 'Meta',
                data: valoresMeta,
                borderColor: '#EF4444',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                fill: false
            }
        ]
    };
}

function obtenerUltimoMesConDatos() {
    if (panelState.datosReales.length === 0) return null;
    
    const ultimoRegistro = panelState.datosReales[panelState.datosReales.length - 1];
    const fecha = new Date(ultimoRegistro.fecha);
    
    return {
        mes: fecha.getMonth() + 1,
        año: fecha.getFullYear(),
        fecha: ultimoRegistro.fecha,
        valor: ultimoRegistro.valor
    };
}

function obtenerUltimoTrimestreCompleto() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return null;
    
    // Determinar el último trimestre completo
    const trimestre = Math.floor((ultimoMes.mes - 1) / 3) + 1;
    const mesFinTrimestre = trimestre * 3;
    
    // Si el último mes no completa el trimestre, usar el trimestre anterior
    if (ultimoMes.mes < mesFinTrimestre) {
        const trimestreAnterior = trimestre - 1;
        if (trimestreAnterior < 1) return null;
        
        return {
            trimestre: trimestreAnterior,
            año: ultimoMes.año,
            meses: [(trimestreAnterior - 1) * 3 + 1, (trimestreAnterior - 1) * 3 + 2, (trimestreAnterior - 1) * 3 + 3]
        };
    }
    
    return {
        trimestre,
        año: ultimoMes.año,
        meses: [(trimestre - 1) * 3 + 1, (trimestre - 1) * 3 + 2, (trimestre - 1) * 3 + 3]
    };
}

function calcularVariacion(actual, anterior) {
    if (!anterior || anterior === 0) return { diferencia: actual, porcentaje: 0 };
    
    const diferencia = actual - anterior;
    const porcentaje = ((diferencia / anterior) * 100).toFixed(2);
    
    return { diferencia, porcentaje };
}
// =====================================================
// GENERACIÓN DE HTML DE RESULTADOS
// =====================================================

async function generarComparativoMensual() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    // Buscar mismo mes del año anterior
    const mesAnterior = panelState.datosReales.find(d => {
        const fecha = new Date(d.fecha);
        return fecha.getMonth() + 1 === ultimoMes.mes && fecha.getFullYear() === ultimoMes.año - 1;
    });
    
    const variacion = calcularVariacion(ultimoMes.valor, mesAnterior?.valor || 0);
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div class="border-b pb-4">
                <h3 class="text-xl font-bold text-gray-900">${panelState.indicadorSeleccionado.nombre}</h3>
                <p class="text-gray-600">Comparativo Mensual vs Año Anterior</p>
                <p class="text-sm text-gray-500 mt-2">Último mes con datos: ${nombresMeses[ultimoMes.mes - 1]} ${ultimoMes.año}</p>
            </div>
            
            <!-- Tabla comparativa -->
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
            
            <!-- Gráfica -->
            <div class="border-t pt-4">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-gray-900">Gráfica Comparativa Mensual</h4>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="check-4anios" class="rounded" onchange="window.panelDirectivos.toggleAnios()">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                    <canvas id="grafica-container"></canvas>
            </div>
            
            <!-- Botones de acción -->
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

async function generarComparativoTrimestral() {
    const ultimoTrimestre = obtenerUltimoTrimestreCompleto();
    if (!ultimoTrimestre) return '<p class="text-gray-500">No hay datos disponibles para trimestre completo</p>';
    
    // Calcular suma del trimestre actual
    const valorActual = panelState.datosReales
        .filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoTrimestre.año && 
                   ultimoTrimestre.meses.includes(fecha.getMonth() + 1);
        })
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    // Calcular suma del trimestre año anterior
    const valorAnterior = panelState.datosReales
        .filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoTrimestre.año - 1 && 
                   ultimoTrimestre.meses.includes(fecha.getMonth() + 1);
        })
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
                        <input type="checkbox" id="check-4anios" class="rounded">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                <div id="grafica-container" class="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p class="text-gray-400">Gráfica en desarrollo</p>
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

async function generarComparativoAnual() {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    // Calcular suma del año actual (hasta el último mes con datos)
    const valorActual = panelState.datosReales
        .filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoMes.año && fecha.getMonth() + 1 <= ultimoMes.mes;
        })
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    
    // Calcular suma del año anterior (mismos meses)
    const valorAnterior = panelState.datosReales
        .filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === ultimoMes.año - 1 && fecha.getMonth() + 1 <= ultimoMes.mes;
        })
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
                        <input type="checkbox" id="check-4anios" class="rounded">
                        <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                    </label>
                </div>
                <div id="grafica-container" class="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p class="text-gray-400">Gráfica en desarrollo</p>
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

async function generarComparativoMeta(escenario) {
    const ultimoMes = obtenerUltimoMesConDatos();
    if (!ultimoMes) return '<p class="text-gray-500">No hay datos disponibles</p>';
    
    // Buscar meta del último mes
    const metaMes = panelState.datosMetas.find(d => {
        const fecha = new Date(d.fecha);
        return fecha.getMonth() + 1 === ultimoMes.mes && fecha.getFullYear() === ultimoMes.año;
    });
    
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
                <div id="grafica-meta-container" class="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p class="text-gray-400">Gráfica en desarrollo</p>
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

// Funciones auxiliares
/*window.panelDirectivos.toggleAnios = function() {
    console.log('Toggle 4 años');
    // Implementar lógica para mostrar/ocultar años en la gráfica
};

window.panelDirectivos.descargarDatos = function() {
    showToast('Descargando datos...', 'info');
    // Implementar descarga
};

window.panelDirectivos.imprimirReporte = function() {
    window.print();
};*/

// Funciones auxiliares (ya están en el objeto expuesto en setupEventListeners)
// Solo agregar estas funciones al objeto existente
function toggleAnios() {
    const graficaContainer = document.getElementById('grafica-container');
    if (graficaContainer && panelState.chartInstance) {
        // Regenerar datos
        generarGraficaComparativa().then(chartData => {
            panelState.chartInstance.data = chartData;
            panelState.chartInstance.update();
        });
    }
}

function descargarDatos() {
    showToast('Descargando datos...', 'info');
    // Implementar descarga de Excel/CSV
}

function imprimirReporte() {
    window.print();
}

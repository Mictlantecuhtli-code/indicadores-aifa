// =====================================================
// VISTA DE ANÁLISIS DETALLADO - PANEL DIRECTIVOS
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatNumber } from '../lib/ui.js';
import { crearGraficaMeta, crearGraficaHistorica, destruirGrafica } from '../lib/charts.js';

// Estado de la vista de análisis
const analisisState = {
    userProfile: null,
    indicadorId: null,
    indicadorData: null,
    opcionAnalisis: null,
    datosReales: [],
    datosMetas: [],
    ultimoMesDatos: null
};

function redirectToPanelDirectivos(message, type = 'error') {
    if (message) {
        showToast(message, type);
    }

    hideLoading();
    window.router.navigateTo('/panel-directivos');
}

// =====================================================
// RENDERIZADO PRINCIPAL
// =====================================================

export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📊 Renderizando vista de análisis');
        
        showLoading('Cargando análisis...');
        
        // Validar parámetros de query
        if (!query.indicador || !query.opcion) {
            redirectToPanelDirectivos('Parámetros de análisis incompletos', 'error');
            return;
        }
        
        analisisState.indicadorId = query.indicador;
        analisisState.opcionAnalisis = query.opcion;
        
        // Obtener perfil del usuario
        analisisState.userProfile = await getCurrentProfile();
        
        // Cargar datos del indicador
        await cargarDatosIndicador();
        
        if (!analisisState.indicadorData) {
            redirectToPanelDirectivos('Indicador no encontrado', 'error');
            return;
        }
        
        // Cargar datos para el análisis
        await cargarDatosAnalisis();
        
        // Renderizar HTML
        container.innerHTML = createAnalisisHTML();
        
        // Renderizar gráfica
        await renderizarGrafica();
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        if (DEBUG.enabled) console.log('✅ Vista de análisis renderizada');
        
    } catch (error) {
        console.error('❌ Error al renderizar análisis:', error);
        redirectToPanelDirectivos('Error al cargar el análisis', 'error');
    }
}

async function cargarDatosIndicador() {
    try {
        const { data } = await selectData('v_indicadores_area', {
            filters: { id: analisisState.indicadorId }
        });
        
        analisisState.indicadorData = data?.[0] || null;
        
    } catch (error) {
        console.error('❌ Error al cargar indicador:', error);
        analisisState.indicadorData = null;
    }
}
// =====================================================
// CARGA DE DATOS
// =====================================================

async function cargarDatosAnalisis() {
    try {
        // Cargar datos reales del indicador
        const { data } = await selectData('v_mediciones_historico', {
            filters: { indicador_id: analisisState.indicadorId },
            orderBy: { column: 'anio', ascending: true }
        });
        
        analisisState.datosReales = (data || []).map(d => ({
            ...d,
            fecha: `${d.anio}-${String(d.mes).padStart(2, '0')}-01`
        }));
        
        // Obtener último mes con datos
        if (analisisState.datosReales.length > 0) {
            const ultimo = analisisState.datosReales[analisisState.datosReales.length - 1];
            analisisState.ultimoMesDatos = {
                mes: ultimo.mes,
                anio: ultimo.anio,
                valor: ultimo.valor
            };
        }
        
        // Si es análisis de meta, cargar metas
        if (analisisState.opcionAnalisis.includes('vs_') && !analisisState.opcionAnalisis.includes('anterior')) {
            await cargarMetas();
        }
        
        if (DEBUG.enabled) {
            console.log('Datos cargados:', analisisState.datosReales.length);
            console.log('Último mes:', analisisState.ultimoMesDatos);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos de análisis:', error);
        throw error;
    }
}

async function cargarMetas() {
    try {
        // TODO: Implementar cuando exista tabla de metas
        // Por ahora usar meta_anual dividida entre 12
        analisisState.datosMetas = [];
        
        if (analisisState.indicadorData.meta_anual && analisisState.ultimoMesDatos) {
            const metaMensual = analisisState.indicadorData.meta_anual / 12;
            const anioActual = analisisState.ultimoMesDatos.anio;
            
            for (let mes = 1; mes <= 12; mes++) {
                analisisState.datosMetas.push({
                    fecha: `${anioActual}-${String(mes).padStart(2, '0')}-01`,
                    valor: metaMensual,
                    mes: mes,
                    anio: anioActual
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error al cargar metas:', error);
    }
}

function obtenerNombreOpcion() {
    const opcion = analisisState.opcionAnalisis;
    
    if (opcion.includes('mensual_vs_anterior')) return 'Cantidad real mensual del año en curso respecto al mismo periodo del año anterior';
    if (opcion.includes('trimestral_vs_anterior')) return 'Cantidad real trimestral del año en curso respecto al mismo periodo del año anterior';
    if (opcion.includes('anual_vs_anterior')) return 'Cantidad real anual del año en curso respecto al mismo periodo del año anterior';
    if (opcion.includes('mensual_vs_bajo')) return 'Cantidad real mensual del año en curso respecto a la proyección de meta escenario Bajo';
    if (opcion.includes('mensual_vs_medio')) return 'Cantidad real mensual del año en curso respecto a la proyección de meta escenario Mediano';
    if (opcion.includes('mensual_vs_alto')) return 'Cantidad real mensual del año en curso respecto a la proyección de meta escenario Alto';
    
    return 'Análisis de indicador';
}

function calcularDatosComparativos() {
    if (!analisisState.ultimoMesDatos) return null;
    
    const { mes, anio, valor } = analisisState.ultimoMesDatos;
    const opcion = analisisState.opcionAnalisis;
    
    if (opcion.includes('mensual_vs_anterior')) {
        const valorAnterior = analisisState.datosReales.find(d => 
            d.mes === mes && d.anio === anio - 1
        )?.valor || 0;
        
        return {
            tipo: 'mensual',
            valorActual: valor,
            valorAnterior: valorAnterior,
            diferencia: valor - valorAnterior,
            porcentaje: valorAnterior > 0 ? ((valor - valorAnterior) / valorAnterior * 100).toFixed(2) : 0
        };
    }
    
        if (opcion.includes('trimestral_vs_anterior')) {
            const trimestre = Math.floor((mes - 1) / 3) + 1;
            const mesFinTrimestre = trimestre * 3;
            
            // Solo mostrar si el trimestre está completo
            if (mes < mesFinTrimestre) {
                const trimestreAnterior = trimestre - 1;
                if (trimestreAnterior < 1) return null; // No hay trimestre completo
                
                const mesesTrimestre = [(trimestreAnterior - 1) * 3 + 1, (trimestreAnterior - 1) * 3 + 2, (trimestreAnterior - 1) * 3 + 3];
                
                const valorActual = analisisState.datosReales
                    .filter(d => d.anio === anio && mesesTrimestre.includes(d.mes))
                    .reduce((sum, d) => sum + d.valor, 0);
                    
                const valorAnterior = analisisState.datosReales
                    .filter(d => d.anio === anio - 1 && mesesTrimestre.includes(d.mes))
                    .reduce((sum, d) => sum + d.valor, 0);
                    
                return {
                    tipo: 'trimestral',
                    trimestre: trimestreAnterior,
                    valorActual, valorAnterior,
                    diferencia: valorActual - valorAnterior,
                    porcentaje: valorAnterior > 0 ? ((valorActual - valorAnterior) / valorAnterior * 100).toFixed(2) : 0
                };
            }
            
            const mesesTrimestre = [(trimestre - 1) * 3 + 1, (trimestre - 1) * 3 + 2, (trimestre - 1) * 3 + 3];
            
            const valorActual = analisisState.datosReales
                .filter(d => d.anio === anio && mesesTrimestre.includes(d.mes))
                .reduce((sum, d) => sum + d.valor, 0);
                
            const valorAnterior = analisisState.datosReales
                .filter(d => d.anio === anio - 1 && mesesTrimestre.includes(d.mes))
                .reduce((sum, d) => sum + d.valor, 0);
                
            return {
                tipo: 'trimestral',
                trimestre: trimestre,
                valorActual, valorAnterior,
                diferencia: valorActual - valorAnterior,
                porcentaje: valorAnterior > 0 ? ((valorActual - valorAnterior) / valorAnterior * 100).toFixed(2) : 0
            };
        }
    
    if (opcion.includes('anual_vs_anterior')) {
        const valorActual = analisisState.datosReales
            .filter(d => d.anio === anio && d.mes <= mes)
            .reduce((sum, d) => sum + d.valor, 0);
            
        const valorAnterior = analisisState.datosReales
            .filter(d => d.anio === anio - 1 && d.mes <= mes)
            .reduce((sum, d) => sum + d.valor, 0);
            
        return {
            tipo: 'anual',
            valorActual: valorActual,
            valorAnterior: valorAnterior,
            diferencia: valorActual - valorAnterior,
            porcentaje: valorAnterior > 0 ? ((valorActual - valorAnterior) / valorAnterior * 100).toFixed(2) : 0
        };
    }
    
    // Análisis con meta
    if (opcion.includes('vs_')) {
        const metaMes = analisisState.datosMetas.find(m => m.mes === mes && m.anio === anio);
        const meta = metaMes?.valor || 0;
        
        return {
            tipo: 'meta',
            escenario: opcion.includes('bajo') ? 'Bajo' : opcion.includes('medio') ? 'Mediano' : 'Alto',
            valorReal: valor,
            valorMeta: meta,
            diferencia: valor - meta,
            cumplimiento: meta > 0 ? ((valor / meta) * 100).toFixed(2) : 0
        };
    }
    
    return null;
}
// =====================================================
// CREACIÓN DE HTML
// =====================================================

function createAnalisisHTML() {
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const comparativo = calcularDatosComparativos();
    
    return `
        <div class="space-y-6">
            <!-- Header con breadcrumb y título -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
                <button 
                    onclick="window.router.navigateTo('/panel-directivos')"
                    class="text-white/80 hover:text-white mb-3 flex items-center gap-2 text-sm"
                >
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    Volver al Panel de Análisis
                </button>
                <h1 class="text-2xl font-bold mb-2">${analisisState.indicadorData.nombre}</h1>
                <p class="text-blue-100">${obtenerNombreOpcion()}</p>
            </div>

            <!-- Información del último mes -->
            ${analisisState.ultimoMesDatos ? `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <div class="flex items-center gap-2 text-blue-800">
                        <i data-lucide="info" class="w-5 h-5"></i>
                        <span class="font-semibold">Último mes con datos: ${nombresMeses[analisisState.ultimoMesDatos.mes - 1]} ${analisisState.ultimoMesDatos.anio}</span>
                    </div>
                </div>
            ` : ''}

            <!-- Tabla comparativa -->
            ${comparativo ? createTablaComparativa(comparativo, nombresMeses) : ''}

            <!-- Gráfica -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-gray-900">Gráfica Comparativa Mensual</h3>
                    ${!analisisState.opcionAnalisis.includes('vs_') || analisisState.opcionAnalisis.includes('anterior') ? `
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="check-4anios" class="rounded" onchange="toggleAniosAnalisis()">
                            <span class="text-sm text-gray-600">Mostrar últimos 4 años</span>
                        </label>
                    ` : ''}
                </div>
                <div class="h-96">
                    <canvas id="grafica-analisis"></canvas>
                </div>
            </div>

            <!-- Botones de acción -->
            <div class="flex gap-3 bg-white rounded-lg shadow-lg p-6">
                <button onclick="descargarDatosAnalisis()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar
                </button>
                <button onclick="window.print()" class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    Imprimir
                </button>
            </div>
        </div>
    `;
}

function createTablaComparativa(comparativo, nombresMeses) {
    const ultimo = analisisState.ultimoMesDatos;
    
    if (comparativo.tipo === 'mensual') {
        return `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Último Mes con Datos - Comparación 2025 vs 2024</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">2025</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">2024</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap font-medium">${nombresMeses[ultimo.mes - 1]} (Último mes con datos)</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorActual)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorAnterior)}</td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${comparativo.diferencia >= 0 ? '+' : ''}${formatNumber(comparativo.diferencia)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${comparativo.porcentaje >= 0 ? '+' : ''}${comparativo.porcentaje}%
                                </td>
                            </tr>
                            <tr class="bg-gray-50 font-semibold">
                                <td class="px-6 py-4 whitespace-nowrap">TOTAL ACUMULADO</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(calcularAcumulado(ultimo.anio, ultimo.mes))}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(calcularAcumulado(ultimo.anio - 1, ultimo.mes))}</td>
                                <td class="px-6 py-4 whitespace-nowrap" colspan="2"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
        if (comparativo.tipo === 'trimestral') {
            // Determinar todos los trimestres completos del año
            const trimestresCompletos = [];
            const anioActual = ultimo.anio;
            
            for (let t = 1; t <= 4; t++) {
                const mesFinTrimestre = t * 3;
                if (ultimo.mes >= mesFinTrimestre) {
                    const mesesTrimestre = [(t - 1) * 3 + 1, (t - 1) * 3 + 2, (t - 1) * 3 + 3];
                    
                    const valorActual = analisisState.datosReales
                        .filter(d => d.anio === anioActual && mesesTrimestre.includes(d.mes))
                        .reduce((sum, d) => sum + d.valor, 0);
                        
                    const valorAnterior = analisisState.datosReales
                        .filter(d => d.anio === anioActual - 1 && mesesTrimestre.includes(d.mes))
                        .reduce((sum, d) => sum + d.valor, 0);
                        
                    const diferencia = valorActual - valorAnterior;
                    const porcentaje = valorAnterior > 0 ? ((diferencia / valorAnterior) * 100).toFixed(2) : 0;
                    
                    trimestresCompletos.push({
                        trimestre: t,
                        valorActual,
                        valorAnterior,
                        diferencia,
                        porcentaje
                    });
                }
            }
            
            return `
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Comparación Trimestral ${anioActual} vs ${anioActual - 1}</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${anioActual}</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${anioActual - 1}</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${trimestresCompletos.map(t => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap font-medium">Trimestre ${t.trimestre}</td>
                                        <td class="px-6 py-4 whitespace-nowrap">${formatNumber(t.valorActual)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap">${formatNumber(t.valorAnterior)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap ${t.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${t.diferencia >= 0 ? '+' : ''}${formatNumber(t.diferencia)}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap ${t.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${t.porcentaje >= 0 ? '+' : ''}${t.porcentaje}%
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    
    if (comparativo.tipo === 'anual') {
        return `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Comparación Anual (Acumulado)</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${ultimo.anio}</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${ultimo.anio - 1}</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Variación</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap font-medium">Año ${ultimo.anio}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorActual)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorAnterior)}</td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${comparativo.diferencia >= 0 ? '+' : ''}${formatNumber(comparativo.diferencia)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${comparativo.porcentaje >= 0 ? '+' : ''}${comparativo.porcentaje}%
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    if (comparativo.tipo === 'meta') {
        return `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Comparativo Real vs Meta - Escenario ${comparativo.escenario}</h3>
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
                                <td class="px-6 py-4 whitespace-nowrap font-medium">${nombresMeses[ultimo.mes - 1]} ${ultimo.anio}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorReal)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${formatNumber(comparativo.valorMeta)}</td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${comparativo.diferencia >= 0 ? '+' : ''}${formatNumber(comparativo.diferencia)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap ${comparativo.cumplimiento >= 100 ? 'text-green-600' : comparativo.cumplimiento >= 90 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${comparativo.cumplimiento}%
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    return '';
}

function calcularAcumulado(anio, hastaMes) {
    return analisisState.datosReales
        .filter(d => d.anio === anio && d.mes <= hastaMes)
        .reduce((sum, d) => sum + d.valor, 0);
}
// =====================================================
// RENDERIZADO DE GRÁFICAS
// =====================================================

async function renderizarGrafica() {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = document.getElementById('grafica-analisis');
    if (!canvas) {
        console.error('Canvas no encontrado');
        return;
    }
    
    const ultimo = analisisState.ultimoMesDatos;
    if (!ultimo) return;
    
    const opcion = analisisState.opcionAnalisis;
    
    // Determinar tipo de gráfica
    if (opcion.includes('vs_') && !opcion.includes('anterior')) {
        // Gráfica Real vs Meta
        const escenario = opcion.includes('bajo') ? 'bajo' : 
                        opcion.includes('medio') ? 'medio' : 'alto';
        
        await crearGraficaMeta('grafica-analisis', analisisState.datosReales, analisisState.datosMetas, {
            anio: ultimo.anio,
            escenario: escenario,
            titulo: `${analisisState.indicadorData.nombre} - Real vs Meta`,
            unidadMedida: analisisState.indicadorData.unidad_medida || 'Unidades',
            nombreIndicador: analisisState.indicadorData.nombre
        });
    } else {
        // Gráfica comparativa años
        const checkbox = document.getElementById('check-4anios');
        const mostrar4Anios = checkbox?.checked || false;
        
        const aniosDisponibles = [...new Set(analisisState.datosReales.map(d => d.anio))].sort();
        const aniosAMostrar = mostrar4Anios ? 
            aniosDisponibles.slice(-4) : 
            [ultimo.anio - 1, ultimo.anio];
        
        await crearGraficaHistorica('grafica-analisis', analisisState.datosReales, {
            aniosSeleccionados: aniosAMostrar,
            titulo: `${analisisState.indicadorData.nombre} - Comparativo`,
            unidadMedida: analisisState.indicadorData.unidad_medida || 'Unidades'
        });
    }
}

// =====================================================
// FUNCIONES GLOBALES
// =====================================================

window.toggleAniosAnalisis = function() {
    destruirGrafica('visualizacion');
    renderizarGrafica();
};

window.descargarDatosAnalisis = function() {
    showToast('Descargando datos...', 'info');
    // TODO: Implementar exportación a Excel/CSV
};
// =====================================================
// FIN DEL ARCHIVO panel-analisis.js
// =====================================================

// =====================================================
// LIBRERÍA DE GRÁFICAS CENTRALIZADA - SISTEMA AIFA
// =====================================================

import { formatNumber } from './ui.js';
import { DEBUG } from '../config.js';

// =====================================================
// CONSTANTES
// =====================================================

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COLORES_ANIO = {
    2022: '#EF4444', // Rojo
    2023: '#F59E0B', // Ámbar
    2024: '#10B981', // Verde
    2025: '#3B82F6', // Azul
    2026: '#8B5CF6', // Púrpura
    2027: '#EC4899'  // Rosa
};

const COLORES_ESCENARIO = {
    bajo: '#EF4444',   // Rojo
    medio: '#F59E0B',  // Ámbar
    alto: '#10B981'    // Verde
};

// Instancias de gráficas activas
const chartInstances = {
    captura: null,
    visualizacion: null,
    comparativa: null,
    meta: null,
    trimestral: null,
    panelDirectivos: null
};

// =====================================================
// CONFIGURACIONES BASE
// =====================================================

const CHART_CONFIGS = {
    base: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: { size: 12 }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        const valor = context.parsed.y;
                        if (valor === null || valor === undefined) return null;
                        return `${context.dataset.label}: ${formatNumber(valor)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatNumber(value, 0);
                    }
                }
            }
        },
        elements: {
            point: {
                radius: 4,
                hoverRadius: 6,
                borderWidth: 2
            },
            line: {
                borderWidth: 3,
                tension: 0.1
            }
        }
    },
    
    comparativa: {
        aspectRatio: 2.5,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Valores'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Meses'
                }
            }
        }
    }
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function obtenerColorPorAnio(anio) {
    return COLORES_ANIO[anio] || '#6B7280'; // Gris por defecto
}

function obtenerColorEscenario(escenario) {
    return COLORES_ESCENARIO[escenario] || '#6B7280';
}

function obtenerColorConTransparencia(color, alpha = 0.2) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

function crearArrayMeses(valorDefault = null) {
    return Array(12).fill(valorDefault);
}

function destruirGrafica(tipo) {
    if (chartInstances[tipo]) {
        chartInstances[tipo].destroy();
        chartInstances[tipo] = null;
        if (DEBUG.enabled) console.log(`🗑️ Gráfica ${tipo} destruida`);
    }
}

function destruirTodasLasGraficas() {
    Object.keys(chartInstances).forEach(tipo => {
        destruirGrafica(tipo);
    });
    if (DEBUG.enabled) console.log('🗑️ Todas las gráficas destruidas');
}
// =====================================================
// GRÁFICA COMPARATIVA (PANEL DIRECTIVOS Y VISUALIZACIÓN)
// =====================================================

/**
 * Crear gráfica comparativa entre dos años
 */
export async function crearGraficaComparativa(canvasId, datos, opciones = {}) {
    const {
        anioActual = new Date().getFullYear(),
        anioAnterior = new Date().getFullYear() - 1,
        titulo = 'Comparativo',
        unidadMedida = 'Unidades',
        mostrarMeta = false,
        datosMeta = []
    } = opciones;

    try {
        if (DEBUG.enabled) console.log('📊 Creando gráfica comparativa', { canvasId, anioActual, anioAnterior });

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} no encontrado`);
            return null;
        }

        // Destruir gráfica anterior si existe
        const tipoGrafica = canvasId.includes('panel') ? 'panelDirectivos' : 'comparativa';
        destruirGrafica(tipoGrafica);

        const ctx = canvas.getContext('2d');

        // Preparar datasets
        const datasets = [];

        // Dataset año anterior
        const datosAnioAnterior = crearArrayMeses(null);
        datos.filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === anioAnterior;
        }).forEach(d => {
            const fecha = new Date(d.fecha);
            datosAnioAnterior[fecha.getMonth()] = d.valor;
        });

        datasets.push({
            label: anioAnterior.toString(),
            data: datosAnioAnterior,
            borderColor: obtenerColorPorAnio(anioAnterior),
            backgroundColor: obtenerColorConTransparencia(obtenerColorPorAnio(anioAnterior), 0.1),
            fill: false,
            tension: 0.1,
            pointBackgroundColor: obtenerColorPorAnio(anioAnterior),
            pointBorderColor: obtenerColorPorAnio(anioAnterior),
            borderWidth: 3
        });

        // Dataset año actual
        const datosAnioActual = crearArrayMeses(null);
        datos.filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === anioActual;
        }).forEach(d => {
            const fecha = new Date(d.fecha);
            datosAnioActual[fecha.getMonth()] = d.valor;
        });

        datasets.push({
            label: anioActual.toString(),
            data: datosAnioActual,
            borderColor: obtenerColorPorAnio(anioActual),
            backgroundColor: obtenerColorConTransparencia(obtenerColorPorAnio(anioActual), 0.1),
            fill: false,
            tension: 0.1,
            pointBackgroundColor: obtenerColorPorAnio(anioActual),
            pointBorderColor: obtenerColorPorAnio(anioActual),
            borderWidth: 3
        });

        // Agregar línea de meta si se solicita
        if (mostrarMeta && datosMeta.length > 0) {
            const metasArray = crearArrayMeses(null);
            datosMeta.forEach(m => {
                const fecha = new Date(m.fecha);
                if (fecha.getFullYear() === anioActual) {
                    metasArray[fecha.getMonth()] = m.valor;
                }
            });

            datasets.push({
                label: 'Meta',
                data: metasArray,
                borderColor: '#EF4444',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2
            });
        }

        // Configuración de la gráfica
        const config = {
            type: 'line',
            data: {
                labels: MESES,
                datasets: datasets
            },
            options: {
                ...CHART_CONFIGS.base,
                ...CHART_CONFIGS.comparativa,
                plugins: {
                    ...CHART_CONFIGS.base.plugins,
                    title: {
                        display: true,
                        text: titulo,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        ...CHART_CONFIGS.base.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                return `${context.dataset.label}: ${formatNumber(valor)} ${unidadMedida}`;
                            }
                        }
                    }
                },
                scales: {
                    ...CHART_CONFIGS.base.scales,
                    y: {
                        ...CHART_CONFIGS.base.scales.y,
                        title: {
                            display: true,
                            text: unidadMedida
                        }
                    }
                }
            }
        };

        // Crear gráfica
        chartInstances[tipoGrafica] = new Chart(ctx, config);

        if (DEBUG.enabled) console.log('✅ Gráfica comparativa creada');
        return chartInstances[tipoGrafica];

    } catch (error) {
        console.error('❌ Error al crear gráfica comparativa:', error);
        return null;
    }
}
// =====================================================
// GRÁFICA REAL VS META (ESCENARIOS)
// =====================================================

/**
 * Crear gráfica de comparación Real vs Meta
 */
export async function crearGraficaMeta(canvasId, datosReales, datosMetas, opciones = {}) {
    const {
        anio = new Date().getFullYear(),
        escenario = 'medio',
        titulo = 'Real vs Meta',
        unidadMedida = 'Unidades',
        nombreIndicador = 'Indicador'
    } = opciones;

    try {
        if (DEBUG.enabled) console.log('📊 Creando gráfica Real vs Meta', { canvasId, escenario });

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} no encontrado`);
            return null;
        }

        // Destruir gráfica anterior
        destruirGrafica('meta');

        const ctx = canvas.getContext('2d');

        // Preparar datos reales
        const dataReal = crearArrayMeses(null);
        datosReales.filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === anio;
        }).forEach(d => {
            const fecha = new Date(d.fecha);
            dataReal[fecha.getMonth()] = d.valor;
        });

        // Preparar datos de meta
        const dataMeta = crearArrayMeses(null);
        datosMetas.filter(d => {
            const fecha = new Date(d.fecha);
            return fecha.getFullYear() === anio;
        }).forEach(d => {
            const fecha = new Date(d.fecha);
            dataMeta[fecha.getMonth()] = d.valor;
        });

        // Configuración de la gráfica
        const config = {
            type: 'line',
            data: {
                labels: MESES,
                datasets: [
                    {
                        label: `Real ${anio}`,
                        data: dataReal,
                        borderColor: '#3B82F6',
                        backgroundColor: obtenerColorConTransparencia('#3B82F6', 0.1),
                        borderWidth: 3,
                        tension: 0.1,
                        pointBackgroundColor: '#3B82F6',
                        pointBorderColor: '#3B82F6',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: false
                    },
                    {
                        label: `Meta ${escenario.charAt(0).toUpperCase() + escenario.slice(1)}`,
                        data: dataMeta,
                        borderColor: obtenerColorEscenario(escenario),
                        backgroundColor: obtenerColorConTransparencia(obtenerColorEscenario(escenario), 0.1),
                        borderWidth: 3,
                        borderDash: [10, 5],
                        tension: 0.1,
                        pointBackgroundColor: obtenerColorEscenario(escenario),
                        pointBorderColor: obtenerColorEscenario(escenario),
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: false
                    }
                ]
            },
            options: {
                ...CHART_CONFIGS.base,
                plugins: {
                    ...CHART_CONFIGS.base.plugins,
                    title: {
                        display: true,
                        text: `${titulo} - Escenario ${escenario.charAt(0).toUpperCase() + escenario.slice(1)}`,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                return `${context.dataset.label}: ${formatNumber(valor)} ${unidadMedida}`;
                            },
                            afterLabel: function(context) {
                                // Mostrar % cumplimiento en tooltip
                                if (context.datasetIndex === 0 && context.parsed.y !== null) {
                                    const mes = context.dataIndex;
                                    const meta = dataMeta[mes];
                                    if (meta) {
                                        const cumplimiento = (context.parsed.y / meta * 100).toFixed(1);
                                        return `Cumplimiento: ${cumplimiento}%`;
                                    }
                                }
                                return null;
                            }
                        }
                    }
                },
                scales: {
                    ...CHART_CONFIGS.base.scales,
                    y: {
                        ...CHART_CONFIGS.base.scales.y,
                        title: {
                            display: true,
                            text: nombreIndicador
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: `Meses ${anio}`
                        }
                    }
                }
            }
        };

        // Crear gráfica
        chartInstances.meta = new Chart(ctx, config);

        if (DEBUG.enabled) console.log('✅ Gráfica Real vs Meta creada');
        return chartInstances.meta;

    } catch (error) {
        console.error('❌ Error al crear gráfica de meta:', error);
        return null;
    }
}
// =====================================================
// GRÁFICA TRIMESTRAL (BARRAS COMPARATIVAS)
// =====================================================

/**
 * Crear gráfica trimestral comparativa
 */
export async function crearGraficaTrimestral(canvasId, trimestres, opciones = {}) {
    const {
        anioActual = new Date().getFullYear(),
        anioAnterior = new Date().getFullYear() - 1,
        titulo = 'Comparación Trimestral',
        unidadMedida = 'Unidades'
    } = opciones;

    try {
        if (DEBUG.enabled) console.log('📊 Creando gráfica trimestral', { canvasId });

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} no encontrado`);
            return null;
        }

        // Validar que hay trimestres para mostrar
        if (!trimestres || Object.keys(trimestres).length === 0) {
            if (DEBUG.enabled) console.log('No hay trimestres completos para mostrar');
            
            // Ocultar canvas y mostrar mensaje
            canvas.style.display = 'none';
            let mensaje = canvas.parentNode.querySelector('.no-data-message');
            if (!mensaje) {
                mensaje = document.createElement('div');
                mensaje.className = 'no-data-message text-center text-gray-500 py-8';
                mensaje.innerHTML = `
                    <p class="text-lg mb-2">📊</p>
                    <p>No hay trimestres completos para mostrar gráfica</p>
                    <p class="text-sm mt-1">Se requieren los 3 meses de cada trimestre con datos</p>
                `;
                canvas.parentNode.appendChild(mensaje);
            }
            return null;
        }

        // Mostrar canvas y ocultar mensaje si existe
        canvas.style.display = 'block';
        const mensaje = canvas.parentNode.querySelector('.no-data-message');
        if (mensaje) {
            mensaje.remove();
        }

        // Destruir gráfica anterior
        destruirGrafica('trimestral');

        const ctx = canvas.getContext('2d');

        // Preparar datos
        const labels = ['Q1 (Ene-Mar)', 'Q2 (Abr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dic)'];
        
        const dataAnioActual = [
            trimestres.q1?.[`valor${anioActual}`] || null,
            trimestres.q2?.[`valor${anioActual}`] || null,
            trimestres.q3?.[`valor${anioActual}`] || null,
            trimestres.q4?.[`valor${anioActual}`] || null
        ];
        
        const dataAnioAnterior = [
            trimestres.q1?.[`valor${anioAnterior}`] || null,
            trimestres.q2?.[`valor${anioAnterior}`] || null,
            trimestres.q3?.[`valor${anioAnterior}`] || null,
            trimestres.q4?.[`valor${anioAnterior}`] || null
        ];

        // Configuración de la gráfica
        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: anioActual.toString(),
                        data: dataAnioActual,
                        backgroundColor: obtenerColorConTransparencia(obtenerColorPorAnio(anioActual), 0.7),
                        borderColor: obtenerColorPorAnio(anioActual),
                        borderWidth: 2
                    },
                    {
                        label: anioAnterior.toString(),
                        data: dataAnioAnterior,
                        backgroundColor: obtenerColorConTransparencia(obtenerColorPorAnio(anioAnterior), 0.7),
                        borderColor: obtenerColorPorAnio(anioAnterior),
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${titulo} ${anioActual} vs ${anioAnterior}`,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { 
                            usePointStyle: true, 
                            padding: 15,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                return `${context.dataset.label}: ${formatNumber(valor)} ${unidadMedida}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatNumber(value, 0);
                            }
                        },
                        title: {
                            display: true,
                            text: unidadMedida
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Trimestres'
                        }
                    }
                }
            }
        };

        // Crear gráfica
        chartInstances.trimestral = new Chart(ctx, config);

        if (DEBUG.enabled) console.log('✅ Gráfica trimestral creada');
        return chartInstances.trimestral;

    } catch (error) {
        console.error('❌ Error al crear gráfica trimestral:', error);
        return null;
    }
}

// =====================================================
// GRÁFICA HISTÓRICA COMPLETA (MÚLTIPLES AÑOS)
// =====================================================

/**
 * Crear gráfica con múltiples años (histórico completo o selección)
 */
export async function crearGraficaHistorica(canvasId, datos, opciones = {}) {
    const {
        aniosSeleccionados = [],
        titulo = 'Histórico',
        unidadMedida = 'Unidades',
        mostrarTodos = false
    } = opciones;

    try {
        if (DEBUG.enabled) console.log('📊 Creando gráfica histórica', { canvasId, aniosSeleccionados });

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} no encontrado`);
            return null;
        }

        // Destruir gráfica anterior
        destruirGrafica('visualizacion');

        const ctx = canvas.getContext('2d');

        // Determinar años a mostrar
        let aniosAMostrar = aniosSeleccionados;
        if (mostrarTodos || aniosAMostrar.length === 0) {
            aniosAMostrar = [...new Set(datos.map(d => new Date(d.fecha).getFullYear()))].sort();
        }

        // Preparar datasets por año
        const datasets = aniosAMostrar.map(anio => {
            const yearData = crearArrayMeses(null);
            datos.filter(d => {
                const fecha = new Date(d.fecha);
                return fecha.getFullYear() === anio;
            }).forEach(d => {
                const fecha = new Date(d.fecha);
                yearData[fecha.getMonth()] = d.valor;
            });

            return {
                label: anio.toString(),
                data: yearData,
                borderColor: obtenerColorPorAnio(anio),
                backgroundColor: obtenerColorConTransparencia(obtenerColorPorAnio(anio), 0.1),
                fill: false,
                tension: 0.1,
                pointBackgroundColor: obtenerColorPorAnio(anio),
                pointBorderColor: obtenerColorPorAnio(anio),
                borderWidth: 2
            };
        });

        // Configuración de la gráfica
        const config = {
            type: 'line',
            data: {
                labels: MESES,
                datasets: datasets
            },
            options: {
                ...CHART_CONFIGS.base,
                plugins: {
                    ...CHART_CONFIGS.base.plugins,
                    title: {
                        display: true,
                        text: mostrarTodos ? 
                            `${titulo} - HISTÓRICO COMPLETO` : 
                            `${titulo} - Años seleccionados`,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                return `${context.dataset.label}: ${formatNumber(valor)} ${unidadMedida}`;
                            }
                        }
                    }
                },
                scales: {
                    ...CHART_CONFIGS.base.scales,
                    y: {
                        ...CHART_CONFIGS.base.scales.y,
                        title: {
                            display: true,
                            text: unidadMedida
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Meses'
                        }
                    }
                }
            }
        };

        // Crear gráfica
        chartInstances.visualizacion = new Chart(ctx, config);

        if (DEBUG.enabled) console.log('✅ Gráfica histórica creada con', aniosAMostrar.length, 'años');
        return chartInstances.visualizacion;

    } catch (error) {
        console.error('❌ Error al crear gráfica histórica:', error);
        return null;
    }
}

// =====================================================
// FUNCIONES DE UTILIDAD Y GESTIÓN
// =====================================================

/**
 * Actualizar datos de una gráfica existente
 */
export function actualizarGrafica(tipo, nuevosDatos) {
    if (!chartInstances[tipo]) {
        console.warn(`No existe gráfica del tipo ${tipo} para actualizar`);
        return false;
    }

    try {
        chartInstances[tipo].data = nuevosDatos;
        chartInstances[tipo].update();
        if (DEBUG.enabled) console.log(`✅ Gráfica ${tipo} actualizada`);
        return true;
    } catch (error) {
        console.error(`❌ Error al actualizar gráfica ${tipo}:`, error);
        return false;
    }
}

/**
 * Redimensionar todas las gráficas activas
 */
export function redimensionarGraficas() {
    Object.keys(chartInstances).forEach(tipo => {
        if (chartInstances[tipo]) {
            try {
                chartInstances[tipo].resize();
            } catch (error) {
                console.error(`Error al redimensionar gráfica ${tipo}:`, error);
            }
        }
    });
}

/**
 * Obtener instancia de gráfica por tipo
 */
export function obtenerInstanciaGrafica(tipo) {
    return chartInstances[tipo] || null;
}

/**
 * Verificar si Chart.js está disponible
 */
export function verificarChart() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no está disponible');
        return false;
    }
    return true;
}
// =====================================================
// CONFIGURACIÓN DE EVENTOS Y LISTENERS
// =====================================================

/**
 * Configurar eventos de redimensionamiento
 */
function configurarEventosGraficas() {
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            redimensionarGraficas();
        }, 300);
    });
    
    if (DEBUG.enabled) console.log('📊 Eventos de gráficas configurados');
}

/**
 * Limpiar todas las gráficas al cambiar de módulo/vista
 */
export function limpiarGraficas() {
    destruirTodasLasGraficas();
    if (DEBUG.enabled) console.log('🗑️ Gráficas limpiadas al cambiar de vista');
}

/**
 * Inicializar módulo de gráficas
 */
export function inicializarGraficas() {
    if (!verificarChart()) {
        console.error('❌ Chart.js no disponible - Las gráficas no funcionarán');
        return false;
    }
    
    configurarEventosGraficas();
    
    if (DEBUG.enabled) console.log('✅ Módulo de gráficas inicializado correctamente');
    return true;
}

// =====================================================
// EXPORTACIONES
// =====================================================

export {
    // Funciones principales de creación
    crearGraficaComparativa,
    crearGraficaMeta,
    crearGraficaTrimestral,
    crearGraficaHistorica,
    
    // Funciones de gestión
    actualizarGrafica,
    destruirGrafica,
    destruirTodasLasGraficas,
    redimensionarGraficas,
    obtenerInstanciaGrafica,
    
    // Utilidades
    verificarChart,
    limpiarGraficas,
    
    // Configuraciones y constantes
    CHART_CONFIGS,
    MESES
};

// =====================================================
// AUTO-INICIALIZACIÓN
// =====================================================

// Inicializar cuando se carga el módulo
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarGraficas);
    } else {
        inicializarGraficas();
    }
}

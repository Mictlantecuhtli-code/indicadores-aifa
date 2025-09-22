// =====================================================
// LIBRERÍA DE GRÁFICAS CENTRALIZADA - SISTEMA AIFA
// =====================================================

import { formatNumber } from './ui.js';
import { DEBUG } from '../config.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COLORES_ANIO = {
    2022: '#EF4444',
    2023: '#F59E0B',
    2024: '#10B981',
    2025: '#3B82F6',
    2026: '#8B5CF6',
    2027: '#EC4899'
};

const COLORES_ESCENARIO = {
    bajo: '#EF4444',
    medio: '#F59E0B',
    alto: '#10B981'
};

const chartInstances = {
    captura: null,
    visualizacion: null,
    comparativa: null,
    meta: null,
    trimestral: null,
    panelDirectivos: null
};

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
    }
};

function obtenerColorPorAnio(anio) {
    return COLORES_ANIO[anio] || '#6B7280';
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

async function crearGraficaComparativa(canvasId, datos, opciones = {}) {
    const {
        anioActual = new Date().getFullYear(),
        anioAnterior = new Date().getFullYear() - 1,
        titulo = 'Comparativo',
        unidadMedida = 'Unidades'
    } = opciones;

    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        destruirGrafica('panelDirectivos');
        const ctx = canvas.getContext('2d');

        const datasets = [];
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
            tension: 0.1
        });

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
            tension: 0.1
        });

        chartInstances.panelDirectivos = new Chart(ctx, {
            type: 'line',
            data: { labels: MESES, datasets: datasets },
            options: { ...CHART_CONFIGS.base, plugins: { ...CHART_CONFIGS.base.plugins, title: { display: true, text: titulo, font: { size: 16, weight: 'bold' } } } }
        });

        return chartInstances.panelDirectivos;
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

async function crearGraficaMeta(canvasId, datosReales, datosMetas, opciones = {}) {
    const {
        anio = new Date().getFullYear(),
        escenario = 'medio',
        titulo = 'Real vs Meta'
    } = opciones;

    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        destruirGrafica('meta');
        const ctx = canvas.getContext('2d');

        const dataReal = crearArrayMeses(null);
        datosReales.filter(d => new Date(d.fecha).getFullYear() === anio).forEach(d => {
            dataReal[new Date(d.fecha).getMonth()] = d.valor;
        });

        const dataMeta = crearArrayMeses(null);
        datosMetas.filter(d => new Date(d.fecha).getFullYear() === anio).forEach(d => {
            dataMeta[new Date(d.fecha).getMonth()] = d.valor;
        });

        chartInstances.meta = new Chart(ctx, {
            type: 'line',
            data: {
                labels: MESES,
                datasets: [
                    { label: `Real ${anio}`, data: dataReal, borderColor: '#3B82F6', borderWidth: 3 },
                    { label: `Meta ${escenario}`, data: dataMeta, borderColor: obtenerColorEscenario(escenario), borderDash: [10, 5] }
                ]
            },
            options: { ...CHART_CONFIGS.base, plugins: { ...CHART_CONFIGS.base.plugins, title: { display: true, text: titulo } } }
        });

        return chartInstances.meta;
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

async function crearGraficaHistorica(canvasId, datos, opciones = {}) {
    const { aniosSeleccionados = [], titulo = 'Histórico' } = opciones;

    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        destruirGrafica('visualizacion');
        const ctx = canvas.getContext('2d');

        const datasets = aniosSeleccionados.map(anio => {
            const yearData = crearArrayMeses(null);
            datos.filter(d => new Date(d.fecha).getFullYear() === anio).forEach(d => {
                yearData[new Date(d.fecha).getMonth()] = d.valor;
            });
            return { label: anio.toString(), data: yearData, borderColor: obtenerColorPorAnio(anio) };
        });

        chartInstances.visualizacion = new Chart(ctx, {
            type: 'line',
            data: { labels: MESES, datasets: datasets },
            options: { ...CHART_CONFIGS.base }
        });

        return chartInstances.visualizacion;
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

export {
    crearGraficaComparativa,
    crearGraficaMeta,
    crearGraficaHistorica,
    destruirGrafica,
    CHART_CONFIGS,
    MESES
};

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

const MAPA_MESES = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    11: 11,
    12: 12,
    ene: 1,
    enero: 1,
    feb: 2,
    febrero: 2,
    mar: 3,
    marzo: 3,
    abr: 4,
    abril: 4,
    may: 5,
    mayo: 5,
    jun: 6,
    junio: 6,
    jul: 7,
    julio: 7,
    ago: 8,
    agosto: 8,
    sep: 9,
    sept: 9,
    septiembre: 9,
    oct: 10,
    octubre: 10,
    nov: 11,
    noviembre: 11,
    dic: 12,
    diciembre: 12
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

        const registrosNormalizados = normalizarSerieTemporal(datos);

        const datasets = [];
        const datosAnioAnterior = crearArrayMeses(null);
        registrosNormalizados
            .filter(d => d.anio === anioAnterior)
            .forEach(d => {
                datosAnioAnterior[d.mes - 1] = d.valor;
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
        registrosNormalizados
            .filter(d => d.anio === anioActual)
            .forEach(d => {
                datosAnioActual[d.mes - 1] = d.valor;
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
        titulo = 'Real vs Meta',
        escenarioLabel = null
    } = opciones;

    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        destruirGrafica('meta');
        const ctx = canvas.getContext('2d');

        const datosRealesNormalizados = normalizarSerieTemporal(datosReales);
        const datosMetasNormalizados = normalizarSerieTemporal(datosMetas);

        const dataReal = crearArrayMeses(null);
        datosRealesNormalizados
            .filter(d => d.anio === anio)
            .forEach(d => {
                dataReal[d.mes - 1] = d.valor;
            });

        const dataMeta = crearArrayMeses(null);
        datosMetasNormalizados
            .filter(d => d.anio === anio)
            .forEach(d => {
                dataMeta[d.mes - 1] = d.valor;
            });

        const etiquetaEscenario = escenarioLabel
            || `Meta ${escenario.charAt(0).toUpperCase()}${escenario.slice(1)}`;

        chartInstances.meta = new Chart(ctx, {
            type: 'line',
            data: {
                labels: MESES,
                datasets: [
                    { label: `Real ${anio}`, data: dataReal, borderColor: '#3B82F6', borderWidth: 3 },
                    { label: etiquetaEscenario, data: dataMeta, borderColor: obtenerColorEscenario(escenario), borderDash: [10, 5] }
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

        const registrosNormalizados = normalizarSerieTemporal(datos);

        const datasets = aniosSeleccionados.map(anio => {
            const yearData = crearArrayMeses(null);
            registrosNormalizados
                .filter(d => d.anio === anio)
                .forEach(d => {
                    yearData[d.mes - 1] = d.valor;
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

function normalizarValorNumerico(valorOriginal) {
    if (valorOriginal === null || valorOriginal === undefined) return null;

    if (typeof valorOriginal === 'number') {
        return Number.isFinite(valorOriginal) ? valorOriginal : null;
    }

    if (typeof valorOriginal === 'string') {
        const limpio = valorOriginal.trim();
        if (limpio === '') return null;

        const soloNumeros = limpio.replace(/[^0-9.,-]/g, '');
        if (soloNumeros === '') return null;

        const tieneComa = soloNumeros.includes(',');
        const tienePunto = soloNumeros.includes('.');
        let valorNormalizado = soloNumeros;

        if (tieneComa && tienePunto) {
            const ultimaComa = soloNumeros.lastIndexOf(',');
            const ultimoPunto = soloNumeros.lastIndexOf('.');

            if (ultimaComa > ultimoPunto) {
                valorNormalizado = soloNumeros.replace(/\./g, '').replace(/,/g, '.');
            } else {
                valorNormalizado = soloNumeros.replace(/,/g, '');
            }
        } else if (tieneComa && !tienePunto) {
            valorNormalizado = soloNumeros.replace(/,/g, '.');
        } else {
            valorNormalizado = soloNumeros.replace(/,/g, '');
        }

        const numero = Number(valorNormalizado);
        return Number.isFinite(numero) ? numero : null;
    }

    return null;
}

function obtenerEntero(valor) {
    if (valor === null || valor === undefined) return null;

    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? Math.trunc(valor) : null;
    }

    if (typeof valor === 'string') {
        const limpio = valor.trim();
        if (limpio === '') return null;

        const numero = Number(limpio);
        if (Number.isFinite(numero)) {
            return Math.trunc(numero);
        }

        const soloNumeros = limpio.replace(/[^0-9-]/g, '');
        if (soloNumeros === '') return null;

        const numeroLimpio = Number(soloNumeros);
        return Number.isFinite(numeroLimpio) ? Math.trunc(numeroLimpio) : null;
    }

    return null;
}

function obtenerMes(valor, respaldoFecha) {
    let mes = obtenerEntero(valor);

    if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
        if (typeof valor === 'string') {
            const llave = valor.trim().toLowerCase();
            mes = MAPA_MESES[llave] || null;
        }
    }

    if (!Number.isFinite(mes) && respaldoFecha) {
        const fecha = new Date(respaldoFecha);
        if (Number.isFinite(fecha.getTime())) {
            mes = fecha.getMonth() + 1;
        }
    }

    return Number.isFinite(mes) ? mes : null;
}

function obtenerAnio(valor, respaldoFecha) {
    let anio = obtenerEntero(valor);

    if (!Number.isFinite(anio) && respaldoFecha) {
        const fecha = new Date(respaldoFecha);
        if (Number.isFinite(fecha.getTime())) {
            anio = fecha.getFullYear();
        }
    }

    return Number.isFinite(anio) ? anio : null;
}

function construirFechaPeriodo(anio, mes) {
    if (!Number.isFinite(anio) || !Number.isFinite(mes)) return null;
    return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

function obtenerMarcaDeTiempoRegistro(registro = {}) {
    const candidatas = [
        registro.fecha_ultima_edicion,
        registro.updated_at,
        registro.fecha_captura,
        registro.created_at,
        registro.fecha_medicion,
        registro.fecha
    ].filter(Boolean);

    if (candidatas.length === 0) return 0;

    const maxFecha = candidatas.reduce((max, fecha) => {
        const time = new Date(fecha).getTime();
        return Number.isFinite(time) && time > max ? time : max;
    }, 0);

    return maxFecha;
}

function normalizarSerieTemporal(datos = []) {
    const registrosProcesados = (datos || [])
        .map(registro => {
            const fechaReferencia = registro.fecha || registro.periodo || registro.periodo_inicio;
            const anio = obtenerAnio(
                registro.anio ?? registro.year ?? registro.anio_medicion ?? registro.periodo_anio,
                fechaReferencia
            );
            const mes = obtenerMes(
                registro.mes ?? registro.month ?? registro.mes_medicion ?? registro.periodo_mes,
                fechaReferencia
            );

            if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
                return null;
            }

            const fechaPeriodo = construirFechaPeriodo(anio, mes);
            const valorNormalizado = normalizarValorNumerico(
                registro.valor ?? registro.total ?? registro.cantidad ?? registro.value
            );

            if (valorNormalizado === null || valorNormalizado === undefined) {
                return null;
            }

            return {
                ...registro,
                anio,
                mes,
                fecha: fechaPeriodo,
                valor: valorNormalizado,
                _timestamp: obtenerMarcaDeTiempoRegistro({ ...registro, fecha: fechaPeriodo })
            };
        })
        .filter(Boolean)
        .filter(registro => registro.mes >= 1 && registro.mes <= 12)
        .sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            if (a.mes !== b.mes) return a.mes - b.mes;
            return a._timestamp - b._timestamp;
        });

    const registrosUnicos = new Map();

    for (const registro of registrosProcesados) {
        const clave = `${registro.anio}-${String(registro.mes).padStart(2, '0')}`;
        const existente = registrosUnicos.get(clave);

        if (!existente || registro._timestamp >= existente._timestamp) {
            registrosUnicos.set(clave, registro);
        }
    }

    return Array.from(registrosUnicos.values())
        .sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            return a.mes - b.mes;
        })
        .map(({ _timestamp, ...registro }) => registro);
}

export {
    crearGraficaComparativa,
    crearGraficaMeta,
    crearGraficaHistorica,
    destruirGrafica,
    CHART_CONFIGS,
    MESES,
    normalizarSerieTemporal
};

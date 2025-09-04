/**
 * Indicadores 2.0 - AIFA
 * Módulo de gráficas con Chart.js
 * Maneja histogramas comparativos y visualizaciones de datos
 */

// Variable global para almacenar instancias de gráficas
window.chartInstances = {};

/**
 * Inicializar Chart.js con configuración predeterminada
 */
function initChartDefaults() {
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#374151';
        Chart.defaults.plugins.legend.position = 'top';
        Chart.defaults.plugins.legend.align = 'start';
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
    }
}

/**
 * Crear histograma comparativo de dos años
 * @param {string} canvasId - ID del elemento canvas
 * @param {Object} data - Datos procesados del API
 * @param {Object} options - Opciones adicionales
 * @returns {Chart} - Instancia de la gráfica
 */
function createComparativeHistogram(canvasId, data, options = {}) {
    try {
        // Destruir gráfica existente si la hay
        if (window.chartInstances[canvasId]) {
            window.chartInstances[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas con ID '${canvasId}' no encontrado`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        // Configuración de colores
        const colors = {
            yearA: {
                background: 'rgba(59, 130, 246, 0.8)',
                border: 'rgba(59, 130, 246, 1)',
                hover: 'rgba(59, 130, 246, 0.9)'
            },
            yearB: {
                background: 'rgba(16, 185, 129, 0.8)',
                border: 'rgba(16, 185, 129, 1)',
                hover: 'rgba(16, 185, 129, 0.9)'
            }
        };

        // Datos para Chart.js
        const chartData = {
            labels: data.labels,
            datasets: [
                {
                    label: options.yearALabel || `Año ${options.yearA || 'A'}`,
                    data: data.yearA,
                    backgroundColor: colors.yearA.background,
                    borderColor: colors.yearA.border,
                    borderWidth: 2,
                    hoverBackgroundColor: colors.yearA.hover,
                    borderRadius: 4,
                    borderSkipped: false,
                },
                {
                    label: options.yearBLabel || `Año ${options.yearB || 'B'}`,
                    data: data.yearB,
                    backgroundColor: colors.yearB.background,
                    borderColor: colors.yearB.border,
                    borderWidth: 2,
                    hoverBackgroundColor: colors.yearB.hover,
                    borderRadius: 4,
                    borderSkipped: false,
                }
            ]
        };

        // Configuración de la gráfica
        const config = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            bottom: 20
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rect',
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return `${context[0].label}`;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const unit = options.unit || '';
                                return `${context.dataset.label}: ${value.toLocaleString()} ${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            color: '#6B7280'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(156, 163, 175, 0.2)',
                            borderDash: [3, 3]
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#6B7280',
                            callback: function(value) {
                                const unit = options.unit || '';
                                return value.toLocaleString() + ' ' + unit;
                            }
                        }
                    }
                },
                elements: {
                    bar: {
                        borderWidth: 2,
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        };

        // Crear gráfica
        const chart = new Chart(ctx, config);
        
        // Almacenar instancia
        window.chartInstances[canvasId] = chart;

        return chart;

    } catch (error) {
        console.error('Error creando histograma comparativo:', error);
        return null;
    }
}

/**
 * Crear gráfica de líneas para tendencias
 * @param {string} canvasId - ID del elemento canvas
 * @param {Object} data - Datos de la serie temporal
 * @param {Object} options - Opciones adicionales
 * @returns {Chart} - Instancia de la gráfica
 */
function createTrendChart(canvasId, data, options = {}) {
    try {
        // Destruir gráfica existente si la hay
        if (window.chartInstances[canvasId]) {
            window.chartInstances[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas con ID '${canvasId}' no encontrado`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        // Configuración de la gráfica
        const config = {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: options.label || 'Tendencia',
                    data: data.values,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: !!options.showLegend,
                        position: 'top',
                        align: 'end'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const unit = options.unit || '';
                                return `${context.dataset.label}: ${value.toLocaleString()} ${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(156, 163, 175, 0.2)',
                            borderDash: [3, 3]
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            callback: function(value) {
                                const unit = options.unit || '';
                                return value.toLocaleString() + ' ' + unit;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        };

        const chart = new Chart(ctx, config);
        window.chartInstances[canvasId] = chart;

        return chart;

    } catch (error) {
        console.error('Error creando gráfica de tendencia:', error);
        return null;
    }
}

/**
 * Crear gráfica de dona para distribución
 * @param {string} canvasId - ID del elemento canvas
 * @param {Object} data - Datos para la dona
 * @param {Object} options - Opciones adicionales
 * @returns {Chart} - Instancia de la gráfica
 */
function createDonutChart(canvasId, data, options = {}) {
    try {
        // Destruir gráfica existente si la hay
        if (window.chartInstances[canvasId]) {
            window.chartInstances[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas con ID '${canvasId}' no encontrado`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        // Colores predefinidos
        const colors = [
            'rgba(59, 130, 246, 0.8)',   // Azul
            'rgba(16, 185, 129, 0.8)',   // Verde
            'rgba(245, 158, 11, 0.8)',   // Amarillo
            'rgba(239, 68, 68, 0.8)',    // Rojo
            'rgba(139, 92, 246, 0.8)',   // Púrpura
            'rgba(236, 72, 153, 0.8)',   // Rosa
            'rgba(6, 182, 212, 0.8)',    // Cian
            'rgba(34, 197, 94, 0.8)'     // Verde lima
        ];

        const config = {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: colors.slice(0, data.labels.length),
                    borderColor: colors.slice(0, data.labels.length).map(color => color.replace('0.8', '1')),
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'right',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                const unit = options.unit || '';
                                return `${context.label}: ${value.toLocaleString()} ${unit} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000
                }
            }
        };

        const chart = new Chart(ctx, config);
        window.chartInstances[canvasId] = chart;

        return chart;

    } catch (error) {
        console.error('Error creando gráfica de dona:', error);
        return null;
    }
}

/**
 * Actualizar datos de una gráfica existente
 * @param {string} canvasId - ID del canvas
 * @param {Object} newData - Nuevos datos
 */
function updateChart(canvasId, newData) {
    try {
        const chart = window.chartInstances[canvasId];
        if (!chart) {
            console.error(`No se encontró gráfica con ID: ${canvasId}`);
            return;
        }

        // Actualizar datos
        if (newData.labels) {
            chart.data.labels = newData.labels;
        }
        
        if (newData.datasets) {
            chart.data.datasets = newData.datasets;
        } else if (newData.data) {
            // Para gráficas simples con un solo dataset
            chart.data.datasets[0].data = newData.data;
        }

        // Animar la actualización
        chart.update('active');

    } catch (error) {
        console.error('Error actualizando gráfica:', error);
    }
}

/**
 * Destruir gráfica específica
 * @param {string} canvasId - ID del canvas
 */
function destroyChart(canvasId) {
    try {
        if (window.chartInstances[canvasId]) {
            window.chartInstances[canvasId].destroy();
            delete window.chartInstances[canvasId];
        }
    } catch (error) {
        console.error('Error destruyendo gráfica:', error);
    }
}

/**
 * Destruir todas las gráficas
 */
function destroyAllCharts() {
    try {
        Object.keys(window.chartInstances).forEach(canvasId => {
            destroyChart(canvasId);
        });
        window.chartInstances = {};
    } catch (error) {
        console.error('Error destruyendo todas las gráficas:', error);
    }
}

/**
 * Exportar gráfica como imagen
 * @param {string} canvasId - ID del canvas
 * @param {string} format - Formato de imagen ('png', 'jpeg')
 * @param {string} filename - Nombre del archivo
 */
function exportChart(canvasId, format = 'png', filename = 'grafica') {
    try {
        const chart = window.chartInstances[canvasId];
        if (!chart) {
            console.error(`No se encontró gráfica con ID: ${canvasId}`);
            return;
        }

        // Crear enlace de descarga
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = chart.toBase64Image(`image/${format}`, 1);
        
        // Simular clic para descargar
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error exportando gráfica:', error);
    }
}

/**
 * Redimensionar todas las gráficas (útil para cambios de layout)
 */
function resizeAllCharts() {
    try {
        Object.values(window.chartInstances).forEach(chart => {
            chart.resize();
        });
    } catch (error) {
        console.error('Error redimensionando gráficas:', error);
    }
}

/**
 * Crear gráfica de dashboard con múltiples métricas
 * @param {string} canvasId - ID del elemento canvas
 * @param {Object} data - Datos de múltiples indicadores
 * @param {Object} options - Opciones adicionales
 * @returns {Chart} - Instancia de la gráfica
 */
async function createDashboardChart(canvasId, indicatorId, yearA, yearB) {
    try {
        // Mostrar spinner mientras carga
        if (window.ui) {
            window.ui.toggleSpinner(true, 'Cargando gráfica...');
        }

        // Obtener datos del API
        const histogramData = await window.api.getHistogramData(indicatorId, yearA, yearB);
        
        // Obtener información del indicador
        const indicators = await window.api.getIndicators();
        const indicator = indicators.find(ind => ind.id === indicatorId);
        
        if (!indicator) {
            throw new Error('Indicador no encontrado');
        }

        // Crear gráfica
        const chart = createComparativeHistogram(canvasId, histogramData, {
            title: `${indicator.name} - Comparación ${yearA} vs ${yearB}`,
            yearA: yearA,
            yearB: yearB,
            yearALabel: `${yearA}`,
            yearBLabel: `${yearB}`,
            unit: indicator.unit || ''
        });

        return chart;

    } catch (error) {
        console.error('Error creando gráfica de dashboard:', error);
        
        // Mostrar mensaje de error en el canvas
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#6B7280';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Error cargando datos de la gráfica', canvas.width / 2, canvas.height / 2);
        }
        
        return null;
    } finally {
        if (window.ui) {
            window.ui.toggleSpinner(false);
        }
    }
}

// Auto-inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    initChartDefaults();
});

// Redimensionar gráficas cuando cambia el tamaño de ventana
window.addEventListener('resize', () => {
    setTimeout(resizeAllCharts, 100);
});

// Exportar funciones para uso global
window.charts = {
    initChartDefaults,
    createComparativeHistogram,
    createTrendChart,
    createDonutChart,
    updateChart,
    destroyChart,
    destroyAllCharts,
    exportChart,
    resizeAllCharts,
    createDashboardChart
};

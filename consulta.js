/**
 * consulta.js - Lógica de Consulta de Indicadores
 * Sistema de Indicadores AIFA 2.0
 * 
 * Maneja la consulta y visualización de histogramas comparativos
 */

// Variables globales
let currentUser = null;
let indicadores = [];
let currentData = null;
let currentChart = null;

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadIndicadores();
    await loadYears();
    setupEventListeners();
});

/**
 * Verificar autenticación
 */
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        location.href = './login.html';
        return;
    }
    currentUser = session.user;
}

/**
 * Cargar lista de indicadores
 */
async function loadIndicadores() {
    try {
        const { data, error } = await supabase
            .from('vw_indicadores_catalogo')
            .select(`
                id, clave, nombre, 
                area_nombre, unidad_descripcion, frecuencia_descripcion,
                fuente_datos
            `)
            .eq('activo', true)
            .order('area_nombre, nombre');

        if (error) throw error;

        indicadores = data || [];
        populateIndicadorSelect();

    } catch (error) {
        console.error('Error cargando indicadores:', error);
        await notify('Error cargando lista de indicadores', 'error');
    }
}

/**
 * Poblar selector de indicadores
 */
function populateIndicadorSelect() {
    const select = document.getElementById('indicadorSelect');
    select.innerHTML = '<option value="">Seleccione un indicador...</option>';

    let currentArea = '';
    indicadores.forEach(indicador => {
        if (indicador.area_nombre !== currentArea) {
            if (currentArea) {
                select.appendChild(document.createElement('option')).disabled = true;
            }
            const optgroup = document.createElement('optgroup');
            optgroup.label = indicador.area_nombre;
            select.appendChild(optgroup);
            currentArea = indicador.area_nombre;
        }

        const option = document.createElement('option');
        option.value = indicador.id;
        option.textContent = `${indicador.clave} - ${indicador.nombre}`;
        option.dataset.area = indicador.area_nombre;
        option.dataset.unidad = indicador.unidad_descripcion;
        option.dataset.frecuencia = indicador.frecuencia_descripcion;
        option.dataset.fuente = indicador.fuente_datos;
        
        const lastOptgroup = select.lastElementChild;
        if (lastOptgroup.tagName === 'OPTGROUP') {
            lastOptgroup.appendChild(option);
        } else {
            select.appendChild(option);
        }
    });
}

/**
 * Cargar años disponibles
 */
async function loadYears() {
    try {
        const { data, error } = await supabase
            .from('vw_histograma_mensual')
            .select('anio')
            .order('anio', { ascending: false });

        if (error) throw error;

        const uniqueYears = [...new Set(data.map(row => row.anio))];
        populateYearSelects(uniqueYears);

    } catch (error) {
        console.error('Error cargando años:', error);
        await notify('Error cargando años disponibles', 'error');
    }
}

/**
 * Poblar selectores de años
 */
function populateYearSelects(years) {
    const selectA = document.getElementById('anioASelect');
    const selectB = document.getElementById('anioBSelect');

    selectA.innerHTML = '<option value="">Seleccione año...</option>';
    selectB.innerHTML = '<option value="">Seleccione año...</option>';

    years.forEach(year => {
        const optionA = document.createElement('option');
        optionA.value = year;
        optionA.textContent = year;
        selectA.appendChild(optionA);

        const optionB = document.createElement('option');
        optionB.value = year;
        optionB.textContent = year;
        selectB.appendChild(optionB);
    });

    // Pre-seleccionar años por defecto si hay datos
    if (years.length >= 2) {
        selectA.value = years[1]; // Segundo año más reciente
        selectB.value = years[0]; // Año más reciente
        validateForm();
    }
}
/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.href = './login.html';
    });

    // Formulario de consulta
    document.getElementById('consultarBtn').addEventListener('click', handleConsulta);
    
    // Validación de formulario
    document.getElementById('indicadorSelect').addEventListener('change', () => {
        updateIndicatorInfo();
        validateForm();
    });
    document.getElementById('anioASelect').addEventListener('change', validateForm);
    document.getElementById('anioBSelect').addEventListener('change', validateForm);

    // Controles de visualización
    document.getElementById('binsRange').addEventListener('input', (e) => {
        document.getElementById('binsValue').textContent = e.target.value;
        if (currentChart) updateVisualization();
    });
    document.getElementById('scaleSelect').addEventListener('change', updateVisualization);
    document.getElementById('actualizarVisualizacionBtn').addEventListener('click', updateVisualization);
    document.getElementById('exportarBtn').addEventListener('click', exportChart);
    document.getElementById('toggleFullscreenBtn').addEventListener('click', toggleFullscreen);
}

/**
 * Actualizar información del indicador seleccionado
 */
function updateIndicatorInfo() {
    const select = document.getElementById('indicadorSelect');
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption && selectedOption.value) {
        const indicadorData = indicadores.find(ind => ind.id == selectedOption.value);
        
        if (indicadorData) {
            document.getElementById('indicatorName').textContent = 
                `${indicadorData.clave} - ${indicadorData.nombre}`;
            document.getElementById('indicatorArea').textContent = indicadorData.area_nombre;
            document.getElementById('indicatorUnit').textContent = indicadorData.unidad_descripcion;
            document.getElementById('indicatorFrequency').textContent = indicadorData.frecuencia_descripcion;
            document.getElementById('indicatorSource').textContent = indicadorData.fuente_datos || 'No especificada';
            
            document.getElementById('indicatorInfo').style.display = 'block';
        }
    } else {
        document.getElementById('indicatorInfo').style.display = 'none';
    }
}

/**
 * Validar formulario y habilitar/deshabilitar botón
 */
function validateForm() {
    const indicador = document.getElementById('indicadorSelect').value;
    const anioA = document.getElementById('anioASelect').value;
    const anioB = document.getElementById('anioBSelect').value;
    const consultarBtn = document.getElementById('consultarBtn');

    const isValid = indicador && anioA && anioB && anioA !== anioB;
    consultarBtn.disabled = !isValid;

    if (anioA && anioB && anioA === anioB) {
        notify('Los años seleccionados deben ser diferentes', 'warning');
    }
}

/**
 * Manejar consulta principal
 */
async function handleConsulta() {
    const indicadorId = document.getElementById('indicadorSelect').value;
    const anioA = parseInt(document.getElementById('anioASelect').value);
    const anioB = parseInt(document.getElementById('anioBSelect').value);

    if (!indicadorId || !anioA || !anioB) {
        await notify('Complete todos los campos requeridos', 'error');
        return;
    }

    if (anioA === anioB) {
        await notify('Seleccione años diferentes para la comparación', 'error');
        return;
    }

    try {
        setLoadingState(true);
        hideAllResults();

        // Consultar datos de la vista
        const { data, error } = await supabase
            .from('vw_histograma_mensual')
            .select('anio, mes, valor_num')
            .eq('indicador_id', indicadorId)
            .in('anio', [anioA, anioB])
            .not('valor_num', 'is', null)
            .order('anio, mes');

        if (error) throw error;

        if (!data || data.length === 0) {
            showNoDataMessage();
            return;
        }

        // Procesar y separar datos por año
        const datosA = data.filter(row => row.anio === anioA).map(row => row.valor_num);
        const datosB = data.filter(row => row.anio === anioB).map(row => row.valor_num);

        if (datosA.length === 0 && datosB.length === 0) {
            showNoDataMessage();
            return;
        }

        // Almacenar datos actuales
        currentData = {
            indicadorId,
            anioA,
            anioB,
            datosA,
            datosB,
            allData: data
        };

        // Mostrar resultados
        showResults();
        createHistogram();
        calculateStatistics();

        await notify('Consulta realizada exitosamente', 'success');

    } catch (error) {
        console.error('Error en consulta:', error);
        await notify('Error realizando la consulta: ' + error.message, 'error');
    } finally {
        setLoadingState(false);
    }
}
/**
 * Crear histograma con Plotly
 */
function createHistogram() {
    const { datosA, datosB, anioA, anioB } = currentData;
    const bins = parseInt(document.getElementById('binsRange').value);
    const scale = document.getElementById('scaleSelect').value;

    // Configurar trazas del histograma
    const traceA = {
        x: datosA,
        type: 'histogram',
        name: `Año ${anioA}`,
        opacity: 0.7,
        marker: {
            color: '#1f77b4'
        },
        nbinsx: bins
    };

    const traceB = {
        x: datosB,
        type: 'histogram',
        name: `Año ${anioB}`,
        opacity: 0.7,
        marker: {
            color: '#ff7f0e'
        },
        nbinsx: bins
    };

    // Configurar layout
    const layout = {
        title: {
            text: `Histograma Comparativo: ${anioA} vs ${anioB}`,
            font: { size: 16 }
        },
        xaxis: {
            title: 'Valores',
            type: scale
        },
        yaxis: {
            title: 'Frecuencia'
        },
        barmode: 'overlay',
        showlegend: true,
        legend: {
            x: 0.7,
            y: 0.9
        },
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 50
        },
        plot_bgcolor: '#fafafa',
        paper_bgcolor: '#ffffff'
    };

    // Configurar opciones
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        toImageButtonOptions: {
            format: 'png',
            filename: `histograma_${anioA}_vs_${anioB}`,
            height: 600,
            width: 1000,
            scale: 2
        }
    };

    // Crear gráfico
    Plotly.newPlot('plotlyChart', [traceA, traceB], layout, config);
    currentChart = true;

    // Agregar eventos de interacción
    const chartDiv = document.getElementById('plotlyChart');
    chartDiv.on('plotly_click', function(data) {
        console.log('Click en gráfico:', data);
    });
}

/**
 * Actualizar visualización
 */
function updateVisualization() {
    if (currentChart && currentData) {
        createHistogram();
    }
}

/**
 * Calcular estadísticas
 */
function calculateStatistics() {
    const { datosA, datosB, anioA, anioB } = currentData;

    // Estadísticas para Año A
    const statsA = calculateStats(datosA);
    document.getElementById('statsYearA').textContent = `Año ${anioA} - Estadísticas`;
    document.getElementById('countA').textContent = statsA.count;
    document.getElementById('minA').textContent = formatNumber(statsA.min);
    document.getElementById('maxA').textContent = formatNumber(statsA.max);
    document.getElementById('meanA').textContent = formatNumber(statsA.mean);
    document.getElementById('medianA').textContent = formatNumber(statsA.median);
    document.getElementById('stdA').textContent = formatNumber(statsA.std);

    // Estadísticas para Año B
    const statsB = calculateStats(datosB);
    document.getElementById('statsYearB').textContent = `Año ${anioB} - Estadísticas`;
    document.getElementById('countB').textContent = statsB.count;
    document.getElementById('minB').textContent = formatNumber(statsB.min);
    document.getElementById('maxB').textContent = formatNumber(statsB.max);
    document.getElementById('meanB').textContent = formatNumber(statsB.mean);
    document.getElementById('medianB').textContent = formatNumber(statsB.median);
    document.getElementById('stdB').textContent = formatNumber(statsB.std);

    // Estadísticas comparativas
    const meanDiff = statsB.mean - statsA.mean;
    const percentChange = statsA.mean !== 0 ? ((meanDiff / statsA.mean) * 100) : 0;
    const correlation = calculateCorrelation(datosA, datosB);

    document.getElementById('meanDiff').textContent = formatNumber(meanDiff);
    document.getElementById('percentChange').textContent = formatNumber(percentChange) + '%';
    document.getElementById('correlation').textContent = 
        correlation !== null ? formatNumber(correlation) : 'N/A';
}

/**
 * Calcular estadísticas básicas para un array
 */
function calculateStats(data) {
    if (!data || data.length === 0) {
        return { count: 0, min: 0, max: 0, mean: 0, median: 0, std: 0 };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const count = data.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = data.reduce((sum, val) => sum + val, 0) / count;
    
    // Mediana
    const median = count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];
    
    // Desviación estándar
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const std = Math.sqrt(variance);

    return { count, min, max, mean, median, std };
}

/**
 * Calcular correlación entre dos arrays (si tienen el mismo tamaño)
 */
function calculateCorrelation(dataA, dataB) {
    if (!dataA || !dataB || dataA.length !== dataB.length || dataA.length < 2) {
        return null;
    }

    const n = dataA.length;
    const meanA = dataA.reduce((sum, val) => sum + val, 0) / n;
    const meanB = dataB.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;

    for (let i = 0; i < n; i++) {
        const diffA = dataA[i] - meanA;
        const diffB = dataB[i] - meanB;
        numerator += diffA * diffB;
        denomA += diffA * diffA;
        denomB += diffB * diffB;
    }

    const denominator = Math.sqrt(denomA * denomB);
    return denominator === 0 ? 0 : numerator / denominator;
}
/**
 * Funciones de UI y utilidades
 */

/**
 * Establecer estado de carga
 */
function setLoadingState(loading) {
    const consultarBtn = document.getElementById('consultarBtn');
    const consultarBtnText = document.getElementById('consultarBtnText');
    const consultarSpinner = document.getElementById('consultarSpinner');

    if (loading) {
        consultarBtn.disabled = true;
        consultarBtnText.style.display = 'none';
        consultarSpinner.style.display = 'inline-block';
    } else {
        consultarBtn.disabled = false;
        consultarBtnText.style.display = 'inline';
        consultarSpinner.style.display = 'none';
        validateForm(); // Revalidar para habilitar si corresponde
    }
}

/**
 * Mostrar secciones de resultados
 */
function showResults() {
    document.getElementById('vizControlsSection').style.display = 'block';
    document.getElementById('chartContainer').style.display = 'block';
    document.getElementById('statsContainer').style.display = 'block';
    document.getElementById('noDataMessage').style.display = 'none';
}

/**
 * Ocultar todas las secciones de resultados
 */
function hideAllResults() {
    document.getElementById('vizControlsSection').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('statsContainer').style.display = 'none';
    document.getElementById('noDataMessage').style.display = 'none';
}

/**
 * Mostrar mensaje de no datos
 */
function showNoDataMessage() {
    hideAllResults();
    document.getElementById('noDataMessage').style.display = 'block';
}

/**
 * Exportar gráfico
 */
function exportChart() {
    if (!currentChart) {
        notify('No hay gráfico para exportar', 'warning');
        return;
    }

    const { anioA, anioB } = currentData;
    const filename = `histograma_${anioA}_vs_${anioB}_${new Date().getTime()}`;
    
    Plotly.downloadImage('plotlyChart', {
        format: 'png',
        width: 1200,
        height: 800,
        filename: filename
    });

    notify('Gráfico exportado exitosamente', 'success');
}

/**
 * Toggle fullscreen para el gráfico
 */
function toggleFullscreen() {
    const chartContainer = document.getElementById('chartContainer');
    const toggleBtn = document.getElementById('toggleFullscreenBtn');
    const icon = toggleBtn.querySelector('i');

    if (!chartContainer.classList.contains('fullscreen')) {
        chartContainer.classList.add('fullscreen');
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        
        // Redimensionar gráfico
        setTimeout(() => {
            if (currentChart) {
                Plotly.Plots.resize('plotlyChart');
            }
        }, 100);
    } else {
        chartContainer.classList.remove('fullscreen');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        
        // Redimensionar gráfico
        setTimeout(() => {
            if (currentChart) {
                Plotly.Plots.resize('plotlyChart');
            }
        }, 100);
    }
}

/**
 * Formatear números para mostrar
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '-';
    }
    
    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    } else if (Number.isInteger(num)) {
        return num.toString();
    } else {
        return num.toFixed(2);
    }
}

/**
 * Redimensionar gráfico cuando cambie el tamaño de ventana
 */
window.addEventListener('resize', () => {
    if (currentChart) {
        setTimeout(() => {
            Plotly.Plots.resize('plotlyChart');
        }, 100);
    }
});

/**
 * Limpiar recursos al salir
 */
window.addEventListener('beforeunload', () => {
    if (currentChart) {
        Plotly.purge('plotlyChart');
    }
});

/**
 * Función para debugging (solo desarrollo)
 */
window.debugConsulta = function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Current Data:', currentData);
        console.log('Indicadores:', indicadores);
        console.log('Current Chart:', currentChart);
    }
};

/**
 * Manejar errores de Plotly
 */
window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('Plotly')) {
        console.error('Error de Plotly:', event.error);
        notify('Error en la visualización. Recargue la página.', 'error');
    }
});

// Validar que Plotly esté cargado
(function validatePlotly() {
    if (typeof Plotly === 'undefined') {
        console.error('Plotly no está cargado');
        notify('Error cargando librerías de visualización', 'error');
    }
})();

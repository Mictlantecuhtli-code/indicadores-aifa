/**
 * consulta.js - Lógica para consulta de histogramas comparativos
 * Sistema de Indicadores AIFA 2.0
 */

// Variables globales
let supabase;
let indicadoresData = [];
let currentUser = null;
let currentPlotData = null;

// Elementos DOM
let indicadorSelect, anioASelect, anioBSelect, binsInput, binsValue, escalaSelect;
let compararBtn, resultsSection, plotTitle, plotContainer;
let statsElements = {};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar cliente Supabase
        supabase = createClient();
        
        // Obtener referencias DOM
        initializeElements();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        // Verificar autenticación
        await checkAuthentication();
        
        notify('success', 'Sistema de consulta inicializado correctamente');
        
    } catch (error) {
        console.error('Error durante inicialización:', error);
        notify('error', 'Error inicializando sistema: ' + error.message);
    }
});

/**
 * Inicializa referencias a elementos DOM
 */
function initializeElements() {
    // Controles
    indicadorSelect = document.getElementById('indicador-select');
    anioASelect = document.getElementById('anio-a-select');
    anioBSelect = document.getElementById('anio-b-select');
    binsInput = document.getElementById('bins-input');
    binsValue = document.getElementById('bins-value');
    escalaSelect = document.getElementById('escala-select');
    compararBtn = document.getElementById('comparar-btn');
    
    // Resultados
    resultsSection = document.getElementById('results-section');
    plotTitle = document.getElementById('plot-title');
    plotContainer = document.getElementById('plot');
    
    // Elementos de estadísticas
    statsElements = {
        anioA: document.getElementById('stats-anio-a'),
        anioB: document.getElementById('stats-anio-b'),
        mediaA: document.getElementById('stat-media-a'),
        medianaA: document.getElementById('stat-mediana-a'),
        minA: document.getElementById('stat-min-a'),
        maxA: document.getElementById('stat-max-a'),
        countA: document.getElementById('stat-count-a'),
        mediaB: document.getElementById('stat-media-b'),
        medianaB: document.getElementById('stat-mediana-b'),
        minB: document.getElementById('stat-min-b'),
        maxB: document.getElementById('stat-max-b'),
        countB: document.getElementById('stat-count-b')
    };
    
    // Verificar que todos los elementos existan
    const requiredElements = [
        indicadorSelect, anioASelect, anioBSelect, binsInput, 
        binsValue, escalaSelect, compararBtn, resultsSection, plotContainer
    ];
    
    const missingElements = requiredElements.filter(el => !el);
    if (missingElements.length > 0) {
        throw new Error('Faltan elementos DOM requeridos');
    }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Slider de bins
    binsInput.addEventListener('input', (e) => {
        binsValue.textContent = e.target.value;
        if (currentPlotData) {
            updatePlot();
        }
    });
    
    // Cambio de escala
    escalaSelect.addEventListener('change', () => {
        if (currentPlotData) {
            updatePlot();
        }
    });
    
    // Botón comparar
    compararBtn.addEventListener('click', handleCompararClick);
    
    // Cambios en selects que requieren nueva consulta
    indicadorSelect.addEventListener('change', clearResults);
    anioASelect.addEventListener('change', clearResults);
    anioBSelect.addEventListener('change', clearResults);
    
    // Tecla Enter en los selects
    [indicadorSelect, anioASelect, anioBSelect].forEach(select => {
        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleCompararClick();
            }
        });
    });
}

/**
 * Carga datos iniciales
 */
async function loadInitialData() {
    try {
        await loadIndicadores();
        
        // Configurar años por defecto si no están seleccionados
        if (!anioASelect.value) anioASelect.value = '2024';
        if (!anioBSelect.value) anioBSelect.value = '2025';
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        throw error;
    }
}

/**
 * Carga lista de indicadores disponibles
 */
async function loadIndicadores() {
    try {
        // Determinar si filtrar por áreas del usuario
        const soloAreasUsuario = currentUser && 
            currentUser.rol && 
            currentUser.rol.nombre === 'capturista';
        
        indicadoresData = await fetchIndicadores(soloAreasUsuario);
        
        // Limpiar select
        indicadorSelect.innerHTML = '<option value="">Seleccione un indicador...</option>';
        
        // Agregar opciones
        indicadoresData.forEach(indicador => {
            const option = document.createElement('option');
            option.value = indicador.id;
            option.textContent = `${indicador.areas.nombre} — ${indicador.nombre}`;
            indicadorSelect.appendChild(option);
        });
        
        if (indicadoresData.length === 0) {
            notify('warning', 'No se encontraron indicadores disponibles');
        }
        
    } catch (error) {
        console.error('Error cargando indicadores:', error);
        notify('error', 'Error cargando indicadores: ' + error.message);
    }
}

/**
 * Verifica estado de autenticación
 */
async function checkAuthentication() {
    try {
        currentUser = await getCurrentUser();
        
        if (currentUser) {
            // Recargar indicadores con filtro apropiado
            await loadIndicadores();
        }
        
    } catch (error) {
        console.error('Error verificando autenticación:', error);
    }
}

/**
 * Maneja clic en botón Comparar
 */
async function handleCompararClick() {
    try {
        // Validaciones
        if (!validateInputs()) {
            return;
        }
        
        // Mostrar estado de carga
        setLoadingState(true);
        
        // Obtener datos para histograma
        const data = await fetchHistogramData();
        
        if (!data || data.length === 0) {
            notify('warning', 'No se encontraron datos para el período seleccionado');
            setLoadingState(false);
            return;
        }
        
        // Procesar y mostrar resultados
        await processAndDisplayResults(data);
        
        setLoadingState(false);
        
    } catch (error) {
        console.error('Error generando histograma:', error);
        notify('error', 'Error generando histograma: ' + handleSupabaseError(error));
        setLoadingState(false);
    }
}

/**
 * Valida inputs antes de generar histograma
 */
function validateInputs() {
    const indicadorId = indicadorSelect.value;
    const anioA = anioASelect.value;
    const anioB = anioBSelect.value;
    
    if (!indicadorId) {
        notify('error', 'Seleccione un indicador');
        indicadorSelect.focus();
        return false;
    }
    
    if (!anioA || !anioB) {
        notify('error', 'Seleccione ambos años para comparar');
        return false;
    }
    
    if (anioA === anioB) {
        notify('warning', 'Los años seleccionados son iguales. Seleccione años diferentes para comparar');
        return false;
    }
    
    return true;
}

/**
 * Obtiene datos para histograma desde la vista
 */
async function fetchHistogramData() {
    const indicadorId = parseInt(indicadorSelect.value);
    const anioA = parseInt(anioASelect.value);
    const anioB = parseInt(anioBSelect.value);
    
    const { data, error } = await supabase
        .from("vw_histograma_mensual")
        .select("anio, mes, valor_num")
        .eq("indicador_id", indicadorId)
        .in("anio", [anioA, anioB])
        .order("anio", { ascending: true })
        .order("mes", { ascending: true });
    
    if (error) {
        throw error;
    }
    
    return data;
}

/**
 * Procesa datos y muestra resultados
 */
async function processAndDisplayResults(data) {
    const anioA = parseInt(anioASelect.value);
    const anioB = parseInt(anioBSelect.value);
    
    // Separar datos por año
    const datosA = data.filter(d => d.anio === anioA);
    const datosB = data.filter(d => d.anio === anioB);
    
    // Convertir a arrays de valores para histograma
    const valoresA = ensureArray12(datosA.map(d => ({ 
        mes: d.mes, 
        valor_num: d.valor_num 
    })), 'exclude');
    
    const valoresB = ensureArray12(datosB.map(d => ({ 
        mes: d.mes, 
        valor_num: d.valor_num 
    })), 'exclude');
    
    // Verificar que hay datos suficientes
    if (valoresA.length === 0 && valoresB.length === 0) {
        notify('warning', 'No hay valores válidos para generar el histograma');
        return;
    }
    
    // Guardar datos actuales para recálculos
    currentPlotData = { valoresA, valoresB, anioA, anioB };
    
    // Generar histograma
    await generateHistogram(valoresA, valoresB, anioA, anioB);
    
    // Calcular y mostrar estadísticas
    displayStatistics(valoresA, valoresB, anioA, anioB);
    
    // Generar interpretación automática
    generateInterpretation(valoresA, valoresB, anioA, anioB);
    
    // Mostrar sección de resultados
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Genera histograma con Plotly
 */
async function generateHistogram(valoresA, valoresB, anioA, anioB) {
    const bins = parseInt(binsInput.value);
    const escala = escalaSelect.value;
    
    // Configurar trazas
    const traceA = {
        x: valoresA,
        type: 'histogram',
        name: `Año ${anioA}`,
        opacity: 0.6,
        nbinsx: bins,
        marker: {
            color: '#3b82f6',
            line: {
                color: '#1d4ed8',
                width: 1
            }
        }
    };
    
    const traceB = {
        x: valoresB,
        type: 'histogram',
        name: `Año ${anioB}`,
        opacity: 0.6,
        nbinsx: bins,
        marker: {
            color: '#ef4444',
            line: {
                color: '#dc2626',
                width: 1
            }
        }
    };
    
    // Obtener nombre del indicador para título
    const indicadorSeleccionado = indicadoresData.find(
        ind => ind.id === parseInt(indicadorSelect.value)
    );
    
    const titulo = indicadorSeleccionado 
        ? `${indicadorSeleccionado.areas.nombre} — ${indicadorSeleccionado.nombre}`
        : 'Distribución mensual del indicador';
    
    // Configurar layout
    const layout = {
        title: {
            text: titulo,
            font: { size: 16, color: '#1e293b' }
        },
        barmode: 'overlay',
        xaxis: {
            title: {
                text: 'Valor mensual',
                font: { size: 12, color: '#475569' }
            },
            type: escala === 'log' ? 'log' : 'linear',
            gridcolor: '#e2e8f0',
            tickfont: { size: 10 }
        },
        yaxis: {
            title: {
                text: 'Frecuencia (meses)',
                font: { size: 12, color: '#475569' }
            },
            gridcolor: '#e2e8f0',
            tickfont: { size: 10 }
        },
        legend: {
            x: 0.7,
            y: 0.95,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#e2e8f0',
            borderwidth: 1
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        font: {
            family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        },
        margin: {
            l: 60,
            r: 40,
            t: 60,
            b: 60
        }
    };
    
    // Configuración de Plotly
    const config = {
        displaylogo: false,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        responsive: true,
        locale: 'es'
    };
    
    // Generar plot
    await Plotly.newPlot(plotContainer, [traceA, traceB], layout, config);
    
    // Actualizar título de sección
    plotTitle.textContent = `Histograma Comparativo - ${titulo}`;
    
    updateLiveRegion(`Histograma generado para ${titulo}, comparando años ${anioA} y ${anioB}`);
}

/**
 * Actualiza el plot existente (para cambios de bins/escala)
 */
function updatePlot() {
    if (!currentPlotData) return;
    
    const { valoresA, valoresB, anioA, anioB } = currentPlotData;
    generateHistogram(valoresA, valoresB, anioA, anioB);
}

/**
 * Muestra estadísticas calculadas
 */
function displayStatistics(valoresA, valoresB, anioA, anioB) {
    const statsA = stats(valoresA);
    const statsB = stats(valoresB);
    
    // Actualizar labels de años
    if (statsElements.anioA) statsElements.anioA.textContent = anioA;
    if (statsElements.anioB) statsElements.anioB.textContent = anioB;
    
    // Estadísticas año A
    if (statsElements.mediaA) statsElements.mediaA.textContent = formatNumber(statsA.mean);
    if (statsElements.medianaA) statsElements.medianaA.textContent = formatNumber(statsA.median);
    if (statsElements.minA) statsElements.minA.textContent = formatNumber(statsA.min);
    if (statsElements.maxA) statsElements.maxA.textContent = formatNumber(statsA.max);
    if (statsElements.countA) statsElements.countA.textContent = statsA.count;
    
    // Estadísticas año B
    if (statsElements.mediaB) statsElements.mediaB.textContent = formatNumber(statsB.mean);
    if (statsElements.medianaB) statsElements.medianaB.textContent = formatNumber(statsB.median);
    if (statsElements.minB) statsElements.minB.textContent = formatNumber(statsB.min);
    if (statsElements.maxB) statsElements.maxB.textContent = formatNumber(statsB.max);
    if (statsElements.countB) statsElements.countB.textContent = statsB.count;
}

/**
 * Genera interpretación automática de resultados
 */
function generateInterpretation(valoresA, valoresB, anioA, anioB) {
    const statsA = stats(valoresA);
    const statsB = stats(valoresB);
    const interpretationEl = document.getElementById('interpretation-text');
    
    if (!interpretationEl || !statsA.mean || !statsB.mean) {
        return;
    }
    
    let interpretation = [];
    
    // Comparación de medias
    const diffMedia = ((statsB.mean - statsA.mean) / statsA.mean * 100);
    if (Math.abs(diffMedia) > 5) {
        const direccion = diffMedia > 0 ? 'incremento' : 'disminución';
        const valor = Math.abs(diffMedia).toFixed(1);
        interpretation.push(`Se observa un <strong>${direccion} del ${valor}%</strong> en el valor promedio entre ${anioA} y ${anioB}.`);
    } else {
        interpretation.push(`Los valores promedio entre ${anioA} y ${anioB} se mantienen <strong>relativamente estables</strong> (variación menor al 5%).`);
    }
    
    // Comparación de variabilidad
    const rangoA = statsA.max - statsA.min;
    const rangoB = statsB.max - statsB.min;
    const diffRango = ((rangoB - rangoA) / rangoA * 100);
    
    if (Math.abs(diffRango) > 20) {
        const tendencia = diffRango > 0 ? 'mayor variabilidad' : 'menor variabilidad';
        interpretation.push(`El año ${anioB} muestra <strong>${tendencia}</strong> en los valores mensuales comparado con ${anioA}.`);
    }
    
    // Comparación de consistencia (usando mediana vs media)
    const skewnessA = Math.abs(statsA.mean - statsA.median) / statsA.mean * 100;
    const skewnessB = Math.abs(statsB.mean - statsB.median) / statsB.mean * 100;
    
    if (skewnessA < 10 && skewnessB < 10) {
        interpretation.push(`Ambos años muestran <strong>distribuciones simétricas</strong>, lo que indica comportamiento consistente a lo largo de los meses.`);
    }
    
    // Recomendación general
    if (statsB.count < statsA.count) {
        interpretation.push(`⚠️ <em>Nota: El año ${anioB} tiene menos datos registrados (${statsB.count} vs ${statsA.count} meses), lo que puede afectar la comparación.</em>`);
    }
    
    // Mostrar interpretación
    interpretationEl.innerHTML = interpretation.join(' ');
}

/**
 * Limpia resultados cuando cambian los parámetros principales
 */
function clearResults() {
    currentPlotData = null;
    resultsSection.style.display = 'none';
}

/**
 * Controla estado de carga del botón
 */
function setLoadingState(loading) {
    const btnText = compararBtn.querySelector('.btn-text');
    const btnLoading = compararBtn.querySelector('.btn-loading');
    
    if (loading) {
        compararBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'block';
    } else {
        compararBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

// Event listeners para cambios de autenticación
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Escuchar cambios de autenticación de Supabase
        supabase?.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                await checkAuthentication();
            }
        });
    });
}

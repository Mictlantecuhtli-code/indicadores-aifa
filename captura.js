/**
 * captura.js - Lógica para captura de valores de indicadores
 * Sistema de Indicadores AIFA 2.0
 */

// Variables globales
let supabase;
let indicadoresData = [];
let currentUser = null;
let lastInsertedData = null;

// Elementos DOM
let capturaForm, indicadorSelect, anioInput, mesSelect, valorInput;
let fuenteInput, comentarioInput, comentarioCounter;
let duplicarBtn, guardarBtn, limpiarBtn;
let previewSection, recentSection;

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
        
        notify('success', 'Sistema de captura inicializado correctamente');
        
    } catch (error) {
        console.error('Error durante inicialización:', error);
        notify('error', 'Error inicializando sistema: ' + error.message);
    }
});

/**
 * Inicializa referencias a elementos DOM
 */
function initializeElements() {
    // Formulario principal
    capturaForm = document.getElementById('captura-form');
    indicadorSelect = document.getElementById('indicador-select');
    anioInput = document.getElementById('anio-input');
    mesSelect = document.getElementById('mes-select');
    valorInput = document.getElementById('valor-input');
    fuenteInput = document.getElementById('fuente-input');
    comentarioInput = document.getElementById('comentario-input');
    comentarioCounter = document.getElementById('comentario-counter');
    
    // Botones
    duplicarBtn = document.getElementById('duplicar-btn');
    guardarBtn = document.getElementById('guardar-btn');
    limpiarBtn = document.getElementById('limpiar-btn');
    
    // Secciones
    previewSection = document.getElementById('preview-section');
    recentSection = document.getElementById('recent-captures');
    
    // Verificar elementos requeridos
    const requiredElements = [
        capturaForm, indicadorSelect, anioInput, mesSelect, valorInput,
        duplicarBtn, guardarBtn, limpiarBtn
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
    // Formulario principal
    capturaForm.addEventListener('submit', handleFormSubmit);
    
    // Contador de caracteres para comentario
    if (comentarioInput && comentarioCounter) {
        comentarioInput.addEventListener('input', updateCharacterCounter);
    }
    
    // Preview en tiempo real
    [indicadorSelect, anioInput, mesSelect, valorInput, fuenteInput, comentarioInput].forEach(input => {
        if (input) {
            input.addEventListener('input', updatePreview);
            input.addEventListener('change', updatePreview);
        }
    });
    
    // Botones de acción
    duplicarBtn.addEventListener('click', handleDuplicarClick);
    limpiarBtn.addEventListener('click', handleLimpiarClick);
    
    // Botón refresh de recientes
    const refreshRecentBtn = document.getElementById('refresh-recent');
    if (refreshRecentBtn) {
        refreshRecentBtn.addEventListener('click', loadRecentCaptures);
    }
    
    // Validación en tiempo real
    valorInput.addEventListener('input', validateValorInput);
    anioInput.addEventListener('input', validateAnioInput);
    
    // Auto-completar mes actual si no está seleccionado
    mesSelect.addEventListener('focus', () => {
        if (!mesSelect.value) {
            const currentMonth = new Date().getMonth() + 1;
            mesSelect.value = currentMonth;
            updatePreview();
        }
    });
}

/**
 * Carga datos iniciales
 */
async function loadInitialData() {
    try {
        await loadIndicadores();
        
        // Configurar año actual por defecto
        const currentYear = new Date().getFullYear();
        if (anioInput && !anioInput.value) {
            anioInput.value = currentYear;
        }
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        throw error;
    }
}

/**
 * Carga lista de indicadores (solo áreas del usuario para capturistas)
 */
async function loadIndicadores() {
    try {
        // Para capturistas, siempre filtrar por áreas
        const soloAreasUsuario = !currentUser || 
            !currentUser.rol || 
            currentUser.rol.nombre === 'capturista';
        
        indicadoresData = await fetchIndicadores(soloAreasUsuario);
        
        // Limpiar select
        indicadorSelect.innerHTML = '<option value="">Seleccione un indicador...</option>';
        
        // Agregar opciones
        indicadoresData.forEach(indicador => {
            const option = document.createElement('option');
            option.value = indicador.id;
            option.textContent = `${indicador.areas.nombre} — ${indicador.nombre}`;
            option.dataset.areaId = indicador.area_id;
            option.dataset.unidad = indicador.unidades?.clave || '';
            indicadorSelect.appendChild(option);
        });
        
        if (indicadoresData.length === 0) {
            notify('warning', 'No se encontraron indicadores disponibles para captura');
            indicadorSelect.innerHTML = '<option value="">No hay indicadores disponibles</option>';
        }
        
        // Habilitar/deshabilitar botón duplicar
        updateDuplicarButtonState();
        
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
            
            // Cargar capturas recientes
            await loadRecentCaptures();
        } else {
            notify('info', 'Inicie sesión para acceder a funciones completas de captura');
        }
        
    } catch (error) {
        console.error('Error verificando autenticación:', error);
    }
}

/**
 * Maneja envío del formulario
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        // Validar formulario
        if (!validateForm()) {
            return;
        }
        
        // Verificar autenticación
        if (!currentUser) {
            notify('error', 'Debe iniciar sesión para capturar valores');
            return;
        }
        
        // Mostrar estado de carga
        setLoadingState(guardarBtn, true);
        
        // Preparar datos
        const formData = getFormData();
        
        // Insertar registro
        await insertIndicadorValor(formData);
        
        // Éxito
        notify('success', 'Valor capturado exitosamente');
        
        // Limpiar formulario y actualizar datos
        resetForm();
        await loadRecentCaptures();
        updatePreview();
        
        setLoadingState(guardarBtn, false);
        
    } catch (error) {
        console.error('Error capturando valor:', error);
        const errorMessage = handleSupabaseError(error, 'Error guardando valor');
        notify('error', errorMessage);
        setLoadingState(guardarBtn, false);
    }
}

/**
 * Valida el formulario completo
 */
function validateForm() {
    let isValid = true;
    
    // Limpiar errores previos
    clearFormErrors();
    
    // Validar indicador
    if (!indicadorSelect.value) {
        showFieldError('indicador', 'Seleccione un indicador');
        isValid = false;
    }
    
    // Validar año
    const anio = parseInt(anioInput.value);
    if (!anio || anio < 2020 || anio > 2030) {
        showFieldError('anio', 'Ingrese un año válido (2020-2030)');
        isValid = false;
    }
    
    // Validar mes
    const mes = parseInt(mesSelect.value);
    if (!mes || mes < 1 || mes > 12) {
        showFieldError('mes', 'Seleccione un mes válido');
        isValid = false;
    }
    
    // Validar valor
    const valor = parseFloat(valorInput.value);
    if (!isValidNumber(valor, 0.01)) {
        showFieldError('valor', 'Ingrese un valor numérico mayor a cero');
        isValid = false;
    }
    
    // Validar longitud de fuente
    if (fuenteInput.value && fuenteInput.value.length > 200) {
        showFieldError('fuente', 'La fuente no puede exceder 200 caracteres');
        isValid = false;
    }
    
    // Validar longitud de comentario
    if (comentarioInput.value && comentarioInput.value.length > 500) {
        showFieldError('comentario', 'El comentario no puede exceder 500 caracteres');
        isValid = false;
    }
    
    return isValid;
}

/**
 * Obtiene datos del formulario
 */
function getFormData() {
    return {
        indicador_id: parseInt(indicadorSelect.value),
        anio: parseInt(anioInput.value),
        mes: parseInt(mesSelect.value),
        valor_num: parseFloat(valorInput.value),
        fuente: fuenteInput.value.trim() || null,
        comentario: comentarioInput.value.trim() || null,
        estado: 'capturado' // Estado inicial
    };
}

/**
 * Inserta valor en la base de datos
 */
async function insertIndicadorValor(formData) {
    const { data, error } = await supabase
        .from('indicador_valores')
        .insert([formData])
        .select('id, created_at');
    
    if (error) {
        throw error;
    }
    
    // Guardar datos del último registro para duplicar
    lastInsertedData = {
        ...formData,
        id: data[0].id,
        created_at: data[0].created_at
    };
    
    return data[0];
}

/**
 * Maneja clic en botón Duplicar Anterior
 */
async function handleDuplicarClick() {
    try {
        if (!indicadorSelect.value) {
            notify('warning', 'Primero seleccione un indicador');
            indicadorSelect.focus();
            return;
        }
        
        setLoadingState(duplicarBtn, true);
        
        // Buscar último valor del indicador seleccionado
        const ultimoValor = await getUltimoValorIndicador();
        
        if (ultimoValor) {
            // Llenar formulario con datos del mes anterior
            fillFormWithPreviousData(ultimoValor);
            notify('success', 'Datos del mes anterior cargados');
        } else {
            notify('info', 'No se encontraron valores anteriores para este indicador');
        }
        
        setLoadingState(duplicarBtn, false);
        
    } catch (error) {
        console.error('Error duplicando datos:', error);
        notify('error', 'Error cargando datos anteriores: ' + error.message);
        setLoadingState(duplicarBtn, false);
    }
}

/**
 * Obtiene el último valor registrado para el indicador seleccionado
 */
async function getUltimoValorIndicador() {
    const indicadorId = parseInt(indicadorSelect.value);
    const anioActual = parseInt(anioInput.value) || new Date().getFullYear();
    
    const { data, error } = await supabase
        .from('indicador_valores')
        .select('anio, mes, valor_num, fuente, comentario')
        .eq('indicador_id', indicadorId)
        .is('deleted_at', null)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1);
    
    if (error) {
        throw error;
    }
    
    return data.length > 0 ? data[0] : null;
}

/**
 * Llena formulario con datos anteriores
 */
function fillFormWithPreviousData(data) {
    // Mantener indicador y año actuales
    // Solo copiar valor, fuente y comentario
    valorInput.value = data.valor_num || '';
    
    if (fuenteInput) {
        fuenteInput.value = data.fuente || '';
    }
    
    if (comentarioInput) {
        comentarioInput.value = data.comentario || '';
        updateCharacterCounter();
    }
    
    // Sugerir mes siguiente
    const mesAnterior = data.mes;
    const anioAnterior = data.anio;
    const anioActual = parseInt(anioInput.value);
    
    let mesSugerido;
    if (anioAnterior === anioActual) {
        mesSugerido = mesAnterior < 12 ? mesAnterior + 1 : 1;
    } else {
        mesSugerido = 1; // Enero del nuevo año
    }
    
    mesSelect.value = mesSugerido;
    
    // Actualizar preview
    updatePreview();
    
    // Focus en el campo valor para revisión
    valorInput.focus();
    valorInput.select();
}

/**
 * Maneja clic en botón Limpiar
 */
function handleLimpiarClick() {
    if (confirm('¿Está seguro de limpiar el formulario? Se perderán todos los datos ingresados.')) {
        resetForm();
        notify('info', 'Formulario limpiado');
    }
}

/**
 * Limpia/resetea el formulario
 */
function resetForm() {
    capturaForm.reset();
    
    // Mantener año actual
    const currentYear = new Date().getFullYear();
    anioInput.value = currentYear;
    
    // Limpiar errores
    clearFormErrors();
    
    // Actualizar contador de caracteres
    if (comentarioCounter) {
        comentarioCounter.textContent = '0';
    }
    
    // Ocultar preview
    if (previewSection) {
        previewSection.style.display = 'none';
    }
    
    // Focus en primer campo
    indicadorSelect.focus();
}

/**
 * Actualiza contador de caracteres del comentario
 */
function updateCharacterCounter() {
    if (comentarioInput && comentarioCounter) {
        const length = comentarioInput.value.length;
        comentarioCounter.textContent = length;
        
        // Cambiar color si se acerca al límite
        if (length > 450) {
            comentarioCounter.style.color = 'var(--color-danger)';
        } else if (length > 400) {
            comentarioCounter.style.color = 'var(--color-warning)';
        } else {
            comentarioCounter.style.color = 'var(--color-gray-500)';
        }
    }
}

/**
 * Actualiza vista previa del registro
 */
function updatePreview() {
    if (!previewSection) return;
    
    const indicadorText = indicadorSelect.selectedOptions[0]?.textContent || '-';
    const anio = anioInput.value || '-';
    const mes = mesSelect.value || '-';
    const mesNombre = mes !== '-' ? getMonthName(parseInt(mes)) : '-';
    const valor = valorInput.value || '-';
    const fuente = fuenteInput?.value || '-';
    const comentario = comentarioInput?.value || '-';
    
    // Actualizar elementos de preview
    const elements = {
        'preview-indicador': indicadorText,
        'preview-periodo': anio !== '-' && mes !== '-' ? `${mesNombre} ${anio}` : '-',
        'preview-valor': valor !== '-' ? formatNumber(parseFloat(valor)) : '-',
        'preview-fuente': fuente || 'Sin especificar',
        'preview-comentario': comentario || 'Sin comentarios'
    };
    
    Object.entries(elements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    });
    
    // Mostrar/ocultar preview según si hay datos
    const hasData = indicadorSelect.value || anioInput.value || mesSelect.value || valorInput.value;
    previewSection.style.display = hasData ? 'block' : 'none';
}

/**
 * Carga capturas recientes del usuario
 */
async function loadRecentCaptures() {
    if (!currentUser || !recentSection) return;
    
    try {
        const { data, error } = await supabase
            .from('indicador_valores')
            .select(`
                id, anio, mes, valor_num, estado, created_at,
                indicadores(nombre, areas(nombre))
            `)
            .eq('created_by', currentUser.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) {
            throw error;
        }
        
        displayRecentCaptures(data);
        recentSection.style.display = data.length > 0 ? 'block' : 'none';
        
    } catch (error) {
        console.error('Error cargando capturas recientes:', error);
    }
}

/**
 * Muestra capturas recientes en la UI
 */
function displayRecentCaptures(captures) {
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    if (captures.length === 0) {
        recentList.innerHTML = '<div class="recent-item">No hay capturas recientes</div>';
        return;
    }
    
    recentList.innerHTML = captures.map(capture => {
        const indicadorNombre = capture.indicadores?.nombre || 'Indicador eliminado';
        const areaNombre = capture.indicadores?.areas?.nombre || 'Área no disponible';
        const mesNombre = getMonthName(capture.mes);
        const valor = formatNumber(capture.valor_num);
        const fecha = formatDate(capture.created_at, 'datetime');
        const estado = capture.estado || 'capturado';
        
        return `
            <div class="recent-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong>${areaNombre} — ${indicadorNombre}</strong>
                    <span class="status-badge ${estado}">${estado}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--color-gray-600);">
                    ${mesNombre} ${capture.anio} • Valor: ${valor} • ${fecha}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Validaciones específicas
 */
function validateValorInput() {
    const valor = parseFloat(valorInput.value);
    const errorEl = document.getElementById('valor-error');
    
    if (valorInput.value && !isValidNumber(valor, 0.01)) {
        if (errorEl) {
            errorEl.textContent = 'Debe ser un número mayor a cero';
        }
        valorInput.setCustomValidity('Valor inválido');
    } else {
        if (errorEl) {
            errorEl.textContent = '';
        }
        valorInput.setCustomValidity('');
    }
}

function validateAnioInput() {
    const anio = parseInt(anioInput.value);
    const errorEl = document.getElementById('anio-error');
    
    if (anioInput.value && (!anio || anio < 2020 || anio > 2030)) {
        if (errorEl) {
            errorEl.textContent = 'Año debe estar entre 2020 y 2030';
        }
        anioInput.setCustomValidity('Año inválido');
    } else {
        if (errorEl) {
            errorEl.textContent = '';
        }
        anioInput.setCustomValidity('');
    }
}

/**
 * Actualiza estado del botón duplicar
 */
function updateDuplicarButtonState() {
    if (duplicarBtn) {
        const hasIndicadores = indicadoresData.length > 0;
        duplicarBtn.disabled = !hasIndicadores;
    }
}

/**
 * Utilidades para manejo de errores en formulario
 */
function showFieldError(fieldName, message) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    if (errorEl) {
        errorEl.textContent = message;
    }
}

function clearFormErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.textContent = '');
}

/**
 * Controla estados de carga de botones
 */
function setLoadingState(button, loading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'block';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnLoading) btnLoading.style.display = 'none';
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

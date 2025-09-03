/**
 * captura.js - Lógica de Captura de Datos
 * Sistema de Indicadores AIFA 2.0
 * 
 * Maneja la captura de valores de indicadores
 * Respeta restricciones por área del usuario
 */

// Variables globales
let currentUser = null;
let userRole = null;
let userAreas = [];
let availableIndicators = [];
let isLoading = false;

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserInfo();
    await loadUserAreas();
    await loadIndicadores();
    await loadHistory();
    setupEventListeners();
    generateYearOptions();
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
 * Cargar información del usuario
 */
async function loadUserInfo() {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select(`
                id, username, nombre, activo,
                roles(nombre)
            `)
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;

        if (!userData.activo) {
            await notify('Tu cuenta está desactivada. Contacta al administrador.', 'error');
            await supabase.auth.signOut();
            location.href = './login.html';
            return;
        }

        userRole = userData.roles.nombre;

        // Actualizar información en la interfaz
        document.getElementById('userName').textContent = userData.nombre || userData.username;
        document.getElementById('userRole').textContent = userRole;

    } catch (error) {
        console.error('Error cargando información del usuario:', error);
        await notify('Error cargando información del usuario', 'error');
    }
}

/**
 * Cargar áreas del usuario
 */
async function loadUserAreas() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                user_areas(
                    areas(id, nombre)
                )
            `)
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;

        userAreas = data.user_areas.map(ua => ua.areas);

        // Mostrar áreas en la interfaz
        const areasText = userAreas.map(area => area.nombre).join(', ');
        document.getElementById('userAreas').textContent = areasText || 'Ninguna asignada';

        // Configurar selector de área si hay múltiples
        if (userAreas.length > 1) {
            setupAreaSelector();
        } else if (userAreas.length === 1) {
            // Si solo tiene un área, seleccionarla automáticamente
            const areaSelect = document.getElementById('areaSelect');
            const option = document.createElement('option');
            option.value = userAreas[0].id;
            option.textContent = userAreas[0].nombre;
            option.selected = true;
            areaSelect.appendChild(option);
        }

    } catch (error) {
        console.error('Error cargando áreas del usuario:', error);
        await notify('Error cargando áreas autorizadas', 'error');
    }
}
/**
 * Configurar selector de área para usuarios con múltiples áreas
 */
function setupAreaSelector() {
    const areaGroup = document.getElementById('areaGroup');
    const areaSelect = document.getElementById('areaSelect');
    
    areaGroup.style.display = 'block';
    areaSelect.innerHTML = '<option value="">Seleccione un área...</option>';
    
    userAreas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.nombre;
        areaSelect.appendChild(option);
    });
}

/**
 * Cargar indicadores del área del usuario
 */
async function loadIndicadores() {
    try {
        if (userAreas.length === 0) {
            await notify('No tiene áreas asignadas para captura', 'warning');
            return;
        }

        const areaIds = userAreas.map(area => area.id);
        
        const { data, error } = await supabase
            .from('indicadores')
            .select(`
                id, clave, nombre, objetivo,
                area_id,
                areas(nombre),
                unidades(descripcion),
                frecuencias(descripcion)
            `)
            .in('area_id', areaIds)
            .eq('activo', true)
            .order('areas(nombre), nombre');

        if (error) throw error;

        availableIndicators = data || [];
        populateIndicadorSelect();
        updateIndicatorsGrid();

    } catch (error) {
        console.error('Error cargando indicadores:', error);
        await notify('Error cargando indicadores disponibles', 'error');
    }
}

/**
 * Poblar selector de indicadores
 */
function populateIndicadorSelect() {
    const indicadorSelect = document.getElementById('indicadorSelect');
    const areaSelect = document.getElementById('areaSelect');
    
    // Limpiar opciones actuales
    indicadorSelect.innerHTML = '<option value="">Seleccione un indicador...</option>';

    // Filtrar por área seleccionada si hay múltiples áreas
    let filteredIndicators = availableIndicators;
    if (userAreas.length > 1 && areaSelect.value) {
        filteredIndicators = availableIndicators.filter(ind => ind.area_id == areaSelect.value);
    }

    // Agrupar por área
    let currentArea = '';
    filteredIndicators.forEach(indicador => {
        if (indicador.areas.nombre !== currentArea) {
            if (currentArea && userAreas.length > 1) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─────────────────';
                indicadorSelect.appendChild(separator);
            }
            currentArea = indicador.areas.nombre;
            
            if (userAreas.length > 1) {
                const header = document.createElement('option');
                header.disabled = true;
                header.textContent = `── ${currentArea} ──`;
                header.style.fontWeight = 'bold';
                indicadorSelect.appendChild(header);
            }
        }

        const option = document.createElement('option');
        option.value = indicador.id;
        option.textContent = `${indicador.clave} - ${indicador.nombre}`;
        option.dataset.unidad = indicador.unidades?.descripcion || '';
        option.dataset.frecuencia = indicador.frecuencias?.descripcion || '';
        option.dataset.objetivo = indicador.objetivo || '';
        indicadorSelect.appendChild(option);
    });

    // Actualizar contador
    document.getElementById('indicatorCount').textContent = `(${filteredIndicators.length})`;
}

/**
 * Generar opciones de año
 */
function generateYearOptions() {
    const anioSelect = document.getElementById('anioSelect');
    const currentYear = new Date().getFullYear();
    
    anioSelect.innerHTML = '<option value="">Seleccione año...</option>';
    
    // Años desde 2020 hasta el año actual + 1
    for (let year = currentYear + 1; year >= 2020; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        anioSelect.appendChild(option);
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

    // Selector de área (si existe)
    const areaSelect = document.getElementById('areaSelect');
    if (areaSelect) {
        areaSelect.addEventListener('change', () => {
            populateIndicadorSelect();
            updateIndicatorsGrid();
            validateForm();
        });
    }

    // Selector de indicador
    document.getElementById('indicadorSelect').addEventListener('change', () => {
        updateIndicadorInfo();
        validateForm();
    });

    // Otros campos del formulario
    document.getElementById('anioSelect').addEventListener('change', validateForm);
    document.getElementById('mesSelect').addEventListener('change', validateForm);
    document.getElementById('valorInput').addEventListener('input', validateForm);

    // Contador de caracteres en comentario
    document.getElementById('comentarioInput').addEventListener('input', updateCommentCounter);

    // Formulario
    document.getElementById('capturaForm').addEventListener('submit', handleSubmit);
    
    // Botones
    document.getElementById('limpiarBtn').addEventListener('click', limpiarFormulario);
    document.getElementById('refreshHistoryBtn').addEventListener('click', loadHistory);

    // Modal
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    document.getElementById('confirmSaveBtn').addEventListener('click', confirmarGuardar);

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

/**
 * Actualizar información del indicador seleccionado
 */
function updateIndicadorInfo() {
    const select = document.getElementById('indicadorSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    const indicadorHelp = document.getElementById('indicadorHelp');
    const valorHelp = document.getElementById('valorHelp');

    if (selectedOption && selectedOption.value) {
        const unidad = selectedOption.dataset.unidad;
        const frecuencia = selectedOption.dataset.frecuencia;
        const objetivo = selectedOption.dataset.objetivo;

        let helpText = '';
        if (unidad) helpText += `Unidad: ${unidad}`;
        if (frecuencia) helpText += `${helpText ? ' • ' : ''}Frecuencia: ${frecuencia}`;
        
        indicadorHelp.textContent = helpText;
        valorHelp.textContent = unidad ? `Valor en ${unidad}` : 'Ingrese valor numérico';

        if (objetivo) {
            valorHelp.textContent += ` (Objetivo: ${objetivo})`;
        }
    } else {
        indicadorHelp.textContent = '';
        valorHelp.textContent = '';
    }
}

/**
 * Validar formulario
 */
function validateForm() {
    const indicador = document.getElementById('indicadorSelect').value;
    const anio = document.getElementById('anioSelect').value;
    const mes = document.getElementById('mesSelect').value;
    const valor = document.getElementById('valorInput').value.trim();
    const guardarBtn = document.getElementById('guardarBtn');

    // Validar área si es requerida
    let areaValid = true;
    const areaSelect = document.getElementById('areaSelect');
    if (userAreas.length > 1) {
        areaValid = areaSelect.value !== '';
    }

    const isValid = areaValid && indicador && anio && mes && valor && !isNaN(parseFloat(valor));
    guardarBtn.disabled = !isValid || isLoading;
}

/**
 * Actualizar contador de comentarios
 */
function updateCommentCounter() {
    const textarea = document.getElementById('comentarioInput');
    const counter = document.getElementById('comentarioCounter');
    counter.textContent = textarea.value.length;
    
    if (textarea.value.length >= 450) {
        counter.style.color = '#ff6b6b';
    } else if (textarea.value.length >= 400) {
        counter.style.color = '#ffa500';
    } else {
        counter.style.color = '#666';
    }
}
/**
 * Manejar envío del formulario
 */
async function handleSubmit(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const formData = getFormData();
    if (!validateFormData(formData)) return;

    // Verificar duplicados
    const isDuplicate = await checkDuplicate(formData);
    if (isDuplicate) {
        await notify('Ya existe un valor para este indicador, año y mes', 'error');
        return;
    }

    // Mostrar modal de confirmación
    showConfirmationModal(formData);
}

/**
 * Obtener datos del formulario
 */
function getFormData() {
    return {
        indicador_id: parseInt(document.getElementById('indicadorSelect').value),
        anio: parseInt(document.getElementById('anioSelect').value),
        mes: parseInt(document.getElementById('mesSelect').value),
        valor_num: parseFloat(document.getElementById('valorInput').value),
        fuente: document.getElementById('fuenteInput').value.trim() || null,
        comentario: document.getElementById('comentarioInput').value.trim() || null
    };
}

/**
 * Validar datos del formulario
 */
function validateFormData(data) {
    if (!data.indicador_id) {
        notify('Seleccione un indicador', 'error');
        return false;
    }
    
    if (!data.anio) {
        notify('Seleccione un año', 'error');
        return false;
    }
    
    if (!data.mes || data.mes < 1 || data.mes > 12) {
        notify('Seleccione un mes válido', 'error');
        return false;
    }
    
    if (isNaN(data.valor_num)) {
        notify('Ingrese un valor numérico válido', 'error');
        return false;
    }

    return true;
}

/**
 * Verificar duplicados
 */
async function checkDuplicate(data) {
    try {
        const { data: existing, error } = await supabase
            .from('indicador_valores')
            .select('id')
            .eq('indicador_id', data.indicador_id)
            .eq('anio', data.anio)
            .eq('mes', data.mes)
            .is('deleted_at', null);

        if (error) throw error;
        return existing && existing.length > 0;
    } catch (error) {
        console.error('Error verificando duplicados:', error);
        return false;
    }
}

/**
 * Mostrar modal de confirmación
 */
function showConfirmationModal(data) {
    const indicadorSelect = document.getElementById('indicadorSelect');
    const indicadorText = indicadorSelect.options[indicadorSelect.selectedIndex].textContent;
    
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    document.getElementById('confirmIndicador').textContent = indicadorText;
    document.getElementById('confirmPeriodo').textContent = `${meses[data.mes]} ${data.anio}`;
    document.getElementById('confirmValor').textContent = formatNumber(data.valor_num);
    document.getElementById('confirmFuente').textContent = data.fuente || 'No especificada';
    
    // Almacenar datos para confirmación
    window.pendingCaptureData = data;
    
    document.getElementById('confirmModal').style.display = 'block';
}

/**
 * Cerrar modal
 */
function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
    window.pendingCaptureData = null;
}

/**
 * Confirmar y guardar datos
 */
async function confirmarGuardar() {
    if (!window.pendingCaptureData) return;
    
    try {
        setLoadingState(true);
        closeModal();
        
        const { data, error } = await supabase
            .from('indicador_valores')
            .insert([window.pendingCaptureData])
            .select();

        if (error) throw error;

        await notify('Valor guardado exitosamente', 'success');
        limpiarFormulario();
        await loadHistory();

    } catch (error) {
        console.error('Error guardando valor:', error);
        
        let errorMessage = 'Error guardando el valor: ';
        if (error.code === '23505') {
            errorMessage += 'Ya existe un valor para este período';
        } else if (error.message.includes('RLS')) {
            errorMessage += 'No tiene permisos para capturar en esta área';
        } else {
            errorMessage += error.message;
        }
        
        await notify(errorMessage, 'error');
    } finally {
        setLoadingState(false);
        window.pendingCaptureData = null;
    }
}
/**
 * Cargar historial de capturas
 */
async function loadHistory() {
    try {
        const { data, error } = await supabase
            .from('indicador_valores')
            .select(`
                id, anio, mes, valor_num, estado, created_at,
                indicadores(clave, nombre)
            `)
            .eq('created_by', currentUser.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        populateHistoryTable(data || []);

    } catch (error) {
        console.error('Error cargando historial:', error);
        // No mostrar error al usuario, solo en consola
    }
}

/**
 * Poblar tabla de historial
 */
function populateHistoryTable(data) {
    const tbody = document.getElementById('historyTableBody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="6">
                    <i class="fas fa-info-circle"></i>
                    No hay capturas recientes
                </td>
            </tr>
        `;
        return;
    }

    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                   'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    tbody.innerHTML = data.map(row => {
        const fecha = new Date(row.created_at).toLocaleDateString('es-MX');
        const periodo = `${meses[row.mes]} ${row.anio}`;
        const indicador = row.indicadores ? 
            `${row.indicadores.clave} - ${row.indicadores.nombre}` : 
            'N/A';
        
        const estadoBadge = getEstadoBadge(row.estado);
        
        return `
            <tr>
                <td>${fecha}</td>
                <td title="${indicador}">${truncateText(indicador, 30)}</td>
                <td>${periodo}</td>
                <td>${formatNumber(row.valor_num)}</td>
                <td>${estadoBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewDetails(${row.id})" 
                            title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Obtener badge de estado
 */
function getEstadoBadge(estado) {
    switch (estado?.toLowerCase()) {
        case 'pendiente':
            return '<span class="badge badge-warning">Pendiente</span>';
        case 'aprobado':
            return '<span class="badge badge-success">Aprobado</span>';
        case 'rechazado':
            return '<span class="badge badge-danger">Rechazado</span>';
        default:
            return '<span class="badge badge-info">Sin estado</span>';
    }
}

/**
 * Actualizar grid de indicadores
 */
function updateIndicatorsGrid() {
    const grid = document.getElementById('indicatorsGrid');
    
    if (!availableIndicators || availableIndicators.length === 0) {
        grid.innerHTML = `
            <div class="no-indicators">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No hay indicadores disponibles para sus áreas</p>
            </div>
        `;
        return;
    }

    // Filtrar por área si hay múltiples
    let filteredIndicators = availableIndicators;
    const areaSelect = document.getElementById('areaSelect');
    if (userAreas.length > 1 && areaSelect.value) {
        filteredIndicators = availableIndicators.filter(ind => ind.area_id == areaSelect.value);
    }

    grid.innerHTML = filteredIndicators.map(indicador => `
        <div class="indicator-card" onclick="selectIndicator(${indicador.id})">
            <div class="indicator-header">
                <h5>${indicador.clave}</h5>
                <span class="area-badge">${indicador.areas.nombre}</span>
            </div>
            <p class="indicator-name">${indicador.nombre}</p>
            <div class="indicator-details">
                <small>
                    ${indicador.unidades?.descripcion || 'Sin unidad'} • 
                    ${indicador.frecuencias?.descripcion || 'Sin frecuencia'}
                </small>
            </div>
        </div>
    `).join('');
}

/**
 * Seleccionar indicador desde el grid
 */
function selectIndicator(indicadorId) {
    const indicadorSelect = document.getElementById('indicadorSelect');
    indicadorSelect.value = indicadorId;
    
    // Disparar eventos para actualizar la interfaz
    indicadorSelect.dispatchEvent(new Event('change'));
    
    // Scroll al formulario
    document.getElementById('capturaForm').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

/**
 * Ver detalles de una captura
 */
async function viewDetails(valorId) {
    try {
        const { data, error } = await supabase
            .from('indicador_valores')
            .select(`
                *, 
                indicadores(clave, nombre, areas(nombre)),
                users!created_by(nombre, username)
            `)
            .eq('id', valorId)
            .single();

        if (error) throw error;

        const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const details = `
            Indicador: ${data.indicadores.clave} - ${data.indicadores.nombre}
            Área: ${data.indicadores.areas.nombre}
            Período: ${meses[data.mes]} ${data.anio}
            Valor: ${formatNumber(data.valor_num)}
            Fuente: ${data.fuente || 'No especificada'}
            Comentario: ${data.comentario || 'Sin comentarios'}
            Estado: ${data.estado || 'Sin estado'}
            Capturado: ${new Date(data.created_at).toLocaleString('es-MX')}
            Por: ${data.users?.nombre || data.users?.username || 'N/A'}
        `;

        alert(details);
    } catch (error) {
        console.error('Error obteniendo detalles:', error);
        await notify('Error obteniendo detalles del registro', 'error');
    }
}
/**
 * Limpiar formulario
 */
function limpiarFormulario() {
    document.getElementById('capturaForm').reset();
    
    // Limpiar ayudas
    document.getElementById('indicadorHelp').textContent = '';
    document.getElementById('valorHelp').textContent = '';
    
    // Resetear contador de comentarios
    updateCommentCounter();
    
    // Revalidar formulario
    validateForm();
    
    // Refocus al primer campo
    const firstField = userAreas.length > 1 ? 
        document.getElementById('areaSelect') : 
        document.getElementById('indicadorSelect');
    firstField.focus();
}

/**
 * Establecer estado de carga
 */
function setLoadingState(loading) {
    isLoading = loading;
    const guardarBtn = document.getElementById('guardarBtn');
    const guardarBtnText = document.getElementById('guardarBtnText');
    const guardarSpinner = document.getElementById('guardarSpinner');
    const confirmBtn = document.getElementById('confirmSaveBtn');

    if (loading) {
        guardarBtn.disabled = true;
        guardarBtnText.style.display = 'none';
        guardarSpinner.style.display = 'inline-block';
        if (confirmBtn) confirmBtn.disabled = true;
    } else {
        guardarBtnText.style.display = 'inline';
        guardarSpinner.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = false;
        validateForm(); // Revalidar para habilitar si corresponde
    }
}

/**
 * Formatear números para mostrar
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '-';
    }
    
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(num);
}

/**
 * Truncar texto
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Manejar clicks fuera del modal
 */
document.addEventListener('click', (event) => {
    const modal = document.getElementById('confirmModal');
    if (event.target === modal) {
        closeModal();
    }
});

/**
 * Auto-guardar borrador (cada 30 segundos si hay cambios)
 */
let draftTimer = null;
let formChanged = false;

function trackFormChanges() {
    const inputs = document.querySelectorAll('#capturaForm input, #capturaForm select, #capturaForm textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            formChanged = true;
            if (draftTimer) clearTimeout(draftTimer);
            draftTimer = setTimeout(saveDraft, 30000);
        });
    });
}

function saveDraft() {
    if (!formChanged) return;
    
    const draft = {
        indicador_id: document.getElementById('indicadorSelect').value,
        anio: document.getElementById('anioSelect').value,
        mes: document.getElementById('mesSelect').value,
        valor_num: document.getElementById('valorInput').value,
        fuente: document.getElementById('fuenteInput').value,
        comentario: document.getElementById('comentarioInput').value,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('captura_draft', JSON.stringify(draft));
        formChanged = false;
    } catch (error) {
        console.warn('No se pudo guardar borrador:', error);
    }
}

function loadDraft() {
    try {
        const draft = localStorage.getItem('captura_draft');
        if (!draft) return;
        
        const data = JSON.parse(draft);
        const now = Date.now();
        
        // Solo cargar si el borrador es de menos de 1 hora
        if (now - data.timestamp > 3600000) {
            localStorage.removeItem('captura_draft');
            return;
        }
        
        if (confirm('Se encontró un borrador guardado. ¿Desea recuperarlo?')) {
            document.getElementById('indicadorSelect').value = data.indicador_id || '';
            document.getElementById('anioSelect').value = data.anio || '';
            document.getElementById('mesSelect').value = data.mes || '';
            document.getElementById('valorInput').value = data.valor_num || '';
            document.getElementById('fuenteInput').value = data.fuente || '';
            document.getElementById('comentarioInput').value = data.comentario || '';
            
            updateIndicadorInfo();
            updateCommentCounter();
            validateForm();
        }
        
        localStorage.removeItem('captura_draft');
    } catch (error) {
        console.error('Error cargando borrador:', error);
        localStorage.removeItem('captura_draft');
    }
}

/**
 * Inicializar tracking de cambios y cargar borrador
 */
setTimeout(() => {
    trackFormChanges();
    loadDraft();
}, 1000);

/**
 * Limpiar borrador al salir
 */
window.addEventListener('beforeunload', () => {
    if (formChanged) {
        saveDraft();
    }
});

/**
 * Función para debugging (solo desarrollo)
 */
window.debugCaptura = function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('User Areas:', userAreas);
        console.log('Available Indicators:', availableIndicators);
        console.log('User Role:', userRole);
        console.log('Form Changed:', formChanged);
    }
};

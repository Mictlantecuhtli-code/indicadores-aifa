// modalIndicadoresSMSInit.js - Inicialización y manejo del modal de Indicadores SMS

import {
  SMS_PISTAS_MODAL_ID,
  buildSmsPistasModalMarkup,
  buildSmsPistasChartView,
  buildSmsPistasChartConfig,
  buildSmsPistasSummary
} from './modalIndicadoresSMS.js';

let smsPistasChart = null;
let currentSmsPistasData = null;
let currentIndicatorId = null;

/**
 * Función para obtener datos de la vista v_sms_pistas_mensual
 * Esta función debe ser implementada en supabaseClient.js
 */
async function getSmsPistasData() {
  // Importar dinámicamente desde supabaseClient
  const { getSmsPistasData: fetchData } = await import('../services/supabaseClient.js');
  return fetchData();
}

/**
 * Abre el modal de Indicadores SMS
 */
export async function openSmsPistasModal(indicatorId, indicatorName, indicatorSubtitle) {
  const existingModal = document.getElementById(SMS_PISTAS_MODAL_ID);
  
  // Si el modal ya existe, solo actualizamos el contenido
  if (existingModal) {
    existingModal.remove();
  }

  // Guardar el ID del indicador actual
  currentIndicatorId = indicatorId;

  // Crear el modal
  const modalMarkup = buildSmsPistasModalMarkup(indicatorId, indicatorName, indicatorSubtitle);
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const modal = document.getElementById(SMS_PISTAS_MODAL_ID);
  if (!modal) return;

  // Inicializar eventos del modal
  initSmsPistasModalEvents(modal);

  // Mostrar modal
  showModal(modal);

  // Cargar datos
  await loadSmsPistasData(modal, indicatorId);
}

/**
 * Inicializa los eventos del modal
 */
function initSmsPistasModalEvents(modal) {
  // Botón cerrar
  const closeButtons = modal.querySelectorAll('[data-close-modal]');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => closeModal(modal));
  });

  // Cerrar al hacer clic fuera del contenido
  const overlay = modal.querySelector('[data-modal-overlay]');
  if (overlay) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  }

  // Tecla ESC para cerrar
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(modal);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Guardar el handler para limpiarlo después
  modal._escHandler = escHandler;
}

/**
 * Carga los datos del modal
 */
async function loadSmsPistasData(modal, indicatorId) {
  const modalBody = modal.querySelector('[data-modal-body]');
  if (!modalBody) return;

  try {
    // Mostrar loader
    modalBody.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="flex items-center gap-3 text-slate-400">
          <i class="fa-solid fa-circle-notch fa-spin text-3xl"></i>
          <span class="text-lg">Cargando datos...</span>
        </div>
      </div>
    `;

    // Obtener datos
    const data = await getSmsPistasData();
    currentSmsPistasData = data;

    if (!data || !data.length) {
      modalBody.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
            <p class="mt-4 text-lg text-slate-500">No hay datos disponibles</p>
          </div>
        </div>
      `;
      return;
    }

    // Renderizar contenido
    const chartView = buildSmsPistasChartView(data, 'bar', indicatorId);
    const summary = buildSmsPistasSummary(data, indicatorId);

    modalBody.innerHTML = `
      ${summary}
      <div class="mt-6">
        ${chartView}
      </div>
    `;

    // Inicializar gráfica
    initSmsPistasChart(data, 'bar', indicatorId);

    // Inicializar controles de tipo de gráfica
    initChartTypeControls(modal, data, indicatorId);

  } catch (error) {
    console.error('Error al cargar datos de indicadores SMS:', error);
    modalBody.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <i class="fa-solid fa-triangle-exclamation text-5xl text-rose-400"></i>
          <p class="mt-4 text-lg text-slate-700">Error al cargar los datos</p>
          <p class="mt-2 text-sm text-slate-500">${error.message || 'Intenta nuevamente'}</p>
        </div>
      </div>
    `;
  }
}

/**
 * Inicializa la gráfica con Chart.js
 */
function initSmsPistasChart(data, chartType, indicatorId) {
  // Destruir gráfica anterior si existe
  if (smsPistasChart) {
    smsPistasChart.destroy();
    smsPistasChart = null;
  }

  const canvas = document.querySelector('[data-sms-pistas-chart]');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const config = buildSmsPistasChartConfig(data, chartType, indicatorId);

  // Verificar si necesitamos el plugin de anotaciones
  if (typeof Chart !== 'undefined') {
    smsPistasChart = new Chart(ctx, config);
  }
}

/**
 * Inicializa los controles de tipo de gráfica
 */
function initChartTypeControls(modal, data, indicatorId) {
  const chartTypeButtons = modal.querySelectorAll('[data-chart-type]');
  
  chartTypeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const chartType = button.getAttribute('data-chart-type');
      
      // Actualizar estado de botones
      chartTypeButtons.forEach(btn => {
        if (btn === button) {
          btn.classList.add('bg-white', 'text-primary-700', 'shadow-sm');
          btn.classList.remove('text-slate-600', 'hover:text-slate-900');
        } else {
          btn.classList.remove('bg-white', 'text-primary-700', 'shadow-sm');
          btn.classList.add('text-slate-600', 'hover:text-slate-900');
        }
      });

      // Reinicializar gráfica
      initSmsPistasChart(data, chartType, indicatorId);
    });
  });
}

/**
 * Muestra el modal con animación
 */
function showModal(modal) {
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  });
  document.body.style.overflow = 'hidden';
}

/**
 * Cierra el modal con animación
 */
function closeModal(modal) {
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');
  
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpiar eventos
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
    
    // Destruir gráfica
    if (smsPistasChart) {
      smsPistasChart.destroy();
      smsPistasChart = null;
    }
    
    // Eliminar modal del DOM
    modal.remove();
  }, 200);
}

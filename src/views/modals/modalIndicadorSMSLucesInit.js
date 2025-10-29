import {
  SMS_LUCES_MODAL_ID,
  buildSmsLucesModalMarkup,
  buildSmsLucesChartModel,
  buildSmsLucesChartView,
  buildSmsLucesChartConfig,
  buildSmsLucesSummary
} from './modalIndicadorSMSLuces.js';

let smsLucesChart = null;
let currentChartModel = null;

async function getSmsLucesData() {
  const { getSmsLucesOperativasData } = await import('../../services/supabaseClient.js');
  return getSmsLucesOperativasData();
}

export async function openSmsLucesModal(indicatorId, indicatorName, indicatorSubtitle) {
  const existingModal = document.getElementById(SMS_LUCES_MODAL_ID);
  if (existingModal) {
    existingModal.remove();
  }

  const modalMarkup = buildSmsLucesModalMarkup(indicatorName, indicatorSubtitle);
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const modal = document.getElementById(SMS_LUCES_MODAL_ID);
  if (!modal) return;

  initModalEvents(modal);
  showModal(modal);
  await loadModalData(modal);
}

function initModalEvents(modal) {
  const closeButtons = modal.querySelectorAll('[data-close-modal]');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => closeModal(modal));
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  const escHandler = event => {
    if (event.key === 'Escape') {
      closeModal(modal);
      document.removeEventListener('keydown', escHandler);
    }
  };

  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;
}

async function loadModalData(modal) {
  const modalBody = modal.querySelector('[data-modal-body]');
  if (!modalBody) return;

  try {
    modalBody.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="flex items-center gap-3 text-slate-400">
          <i class="fa-solid fa-circle-notch fa-spin text-3xl"></i>
          <span class="text-lg">Cargando datos...</span>
        </div>
      </div>
    `;

    const data = await getSmsLucesData();
    currentChartModel = buildSmsLucesChartModel(data);

    if (!currentChartModel.records.length) {
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

    const summary = buildSmsLucesSummary(currentChartModel);
    const chartView = buildSmsLucesChartView(currentChartModel);

    modalBody.innerHTML = `
      ${summary}
      <div class="mt-6">
        ${chartView}
      </div>
    `;

    initChart(modal);
  } catch (error) {
    console.error('Error al cargar datos del indicador 2.3 de SMS:', error);
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

function initChart(modal) {
  if (smsLucesChart) {
    smsLucesChart.destroy();
    smsLucesChart = null;
  }

  const canvas = modal.querySelector('[data-sms-luces-chart]');
  if (!canvas || !currentChartModel) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const config = buildSmsLucesChartConfig(currentChartModel);
  if (typeof Chart !== 'undefined') {
    smsLucesChart = new Chart(ctx, config);
  }
}

function showModal(modal) {
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  });
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');

  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';

    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }

    if (smsLucesChart) {
      smsLucesChart.destroy();
      smsLucesChart = null;
    }

    modal.remove();
  }, 200);
}

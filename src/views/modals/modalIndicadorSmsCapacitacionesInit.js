import {
  SMS_CAPACITACIONES_MODAL_ID,
  buildSmsCapacitacionesModalMarkup,
  prepareSmsCapacitacionesModel,
  buildSmsCapacitacionesSummary,
  buildSmsCapacitacionesChartView,
  buildSmsCapacitacionesChartConfig,
  buildSmsCapacitacionesDetailTable
} from './modalIndicadorSmsCapacitaciones.js';

let smsCapacitacionesChart = null;

async function fetchSmsCapacitacionesData() {
  const { getSmsCapacitacionesData } = await import('../../services/supabaseClient.js');
  return getSmsCapacitacionesData();
}

export async function openSmsCapacitacionesModal(indicatorId, indicatorName, indicatorSubtitle) {
  const existingModal = document.getElementById(SMS_CAPACITACIONES_MODAL_ID);
  if (existingModal) {
    existingModal.remove();
  }

  const modalMarkup = buildSmsCapacitacionesModalMarkup(indicatorName, indicatorSubtitle);
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const modal = document.getElementById(SMS_CAPACITACIONES_MODAL_ID);
  if (!modal) return;

  initModalEvents(modal);
  showModal(modal);
  await loadModalContent(modal);
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

async function loadModalContent(modal) {
  const body = modal.querySelector('[data-modal-body]');
  if (!body) return;

  body.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="flex items-center gap-3 text-slate-400">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        <span class="text-lg">Cargando datos...</span>
      </div>
    </div>
  `;

  try {
    const records = await fetchSmsCapacitacionesData();
    const model = prepareSmsCapacitacionesModel(records);

    if (!model.months.length) {
      body.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
            <p class="mt-4 text-lg text-slate-700">No hay datos disponibles</p>
            <p class="mt-1 text-sm text-slate-500">Aún no se han registrado mediciones para este indicador.</p>
          </div>
        </div>
      `;
      return;
    }

    const summaryMarkup = buildSmsCapacitacionesSummary(model);
    const chartMarkup = buildSmsCapacitacionesChartView(model);
    const tableMarkup = buildSmsCapacitacionesDetailTable(model);

    body.innerHTML = `
      ${summaryMarkup}
      <div class="mt-8">
        ${chartMarkup}
      </div>
      <div class="mt-8">
        ${tableMarkup}
      </div>
    `;

    initChart(model);
  } catch (error) {
    console.error('Error al cargar datos de capacitaciones SMS:', error);
    body.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <i class="fa-solid fa-triangle-exclamation text-5xl text-rose-500"></i>
          <p class="mt-4 text-lg text-slate-700">Error al cargar los datos</p>
          <p class="mt-1 text-sm text-slate-500">${error?.message ?? 'Intente nuevamente más tarde.'}</p>
        </div>
      </div>
    `;
  }
}

function initChart(model) {
  if (smsCapacitacionesChart) {
    smsCapacitacionesChart.destroy();
    smsCapacitacionesChart = null;
  }

  const canvas = document.querySelector('[data-sms-capacitaciones-chart]');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  const config = buildSmsCapacitacionesChartConfig(model);

  if (typeof Chart !== 'undefined') {
    smsCapacitacionesChart = new Chart(context, config);
  }
}

function showModal(modal) {
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  });
}

function closeModal(modal) {
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');

  setTimeout(() => {
    modal.style.display = 'none';
    modal.remove();
  }, 200);

  if (typeof modal._escHandler === 'function') {
    document.removeEventListener('keydown', modal._escHandler);
  }

  if (smsCapacitacionesChart) {
    smsCapacitacionesChart.destroy();
    smsCapacitacionesChart = null;
  }
}

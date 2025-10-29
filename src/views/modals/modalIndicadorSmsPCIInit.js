import {
  SMS_PCI_MODAL_ID,
  buildSmsPciModalMarkup,
  buildSmsPciSummary,
  buildSmsPciChartView,
  buildSmsPciChartConfig
} from './modalIndicadorSmsPCI.js';

let smsPciChart = null;
const PCI_ANNUAL_TARGET = 70;

async function getSmsPciData() {
  const { getSmsPciData: fetchData } = await import('../../services/supabaseClient.js');
  return fetchData();
}

export async function openSmsPciModal(indicatorId, indicatorName, indicatorSubtitle) {
  const existingModal = document.getElementById(SMS_PCI_MODAL_ID);
  if (existingModal) {
    existingModal.remove();
  }

  const modalMarkup = buildSmsPciModalMarkup(indicatorName, indicatorSubtitle);
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const modal = document.getElementById(SMS_PCI_MODAL_ID);
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
    const measurements = await getSmsPciData();
    const normalized = normalizeMeasurements(measurements);

    if (!normalized.length) {
      body.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
            <p class="mt-4 text-lg text-slate-600">No hay datos disponibles</p>
          </div>
        </div>
      `;
      return;
    }

    const summaryMarkup = buildSmsPciSummary(normalized, PCI_ANNUAL_TARGET);
    const chartMarkup = buildSmsPciChartView();

    body.innerHTML = `
      ${summaryMarkup}
      <div class="mt-8">
        ${chartMarkup}
      </div>
    `;

    initChart(normalized, 'bar');
    initChartTypeToggle(modal, normalized);
  } catch (error) {
    console.error('Error al cargar indicador PCI:', error);
    body.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <i class="fa-solid fa-triangle-exclamation text-5xl text-rose-500"></i>
          <p class="mt-4 text-lg text-slate-700">Error al cargar los datos</p>
          <p class="mt-1 text-sm text-slate-500">${error?.message ?? 'Intente nuevamente más tarde'}</p>
        </div>
      </div>
    `;
  }
}

function initChart(measurements, chartType) {
  if (smsPciChart) {
    smsPciChart.destroy();
    smsPciChart = null;
  }

  const canvas = document.querySelector('[data-sms-pci-chart]');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  const config = buildSmsPciChartConfig(measurements, chartType);

  if (typeof Chart !== 'undefined') {
    smsPciChart = new Chart(context, config);
  }
}

function initChartTypeToggle(modal, measurements) {
  const buttons = modal.querySelectorAll('[data-chart-type]');
  if (!buttons.length) return;

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const chartType = button.getAttribute('data-chart-type');

      buttons.forEach(btn => {
        const isActive = btn === button;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('text-primary-700', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-slate-600', !isActive);
        btn.classList.toggle('hover:text-slate-900', !isActive);
      });

      initChart(measurements, chartType);
    });
  });
}

function normalizeMeasurements(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map(row => {
      const [trackRaw] = (row.observaciones ?? '').split('|');
      const pista = (trackRaw ?? '').trim() || null;
      return {
        ...row,
        anio: row.anio != null ? Number(row.anio) : null,
        mes: row.mes != null ? Number(row.mes) : null,
        pista,
        valor: row.valor != null ? Number(row.valor) : null,
        meta_mensual: row.meta_mensual != null ? Number(row.meta_mensual) : null,
        meta_anual: row.meta_anual != null ? Number(row.meta_anual) : null
      };
    })
    .filter(row => row.pista && row.valor != null && row.anio != null && row.mes != null);
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

  if (smsPciChart) {
    smsPciChart.destroy();
    smsPciChart = null;
  }
}

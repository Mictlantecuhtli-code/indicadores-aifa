import {
  SMS_SUPERVISIONES_MODAL_ID,
  buildSmsSupervisionesModalMarkup,
  buildSmsSupervisionesSummary,
  buildSmsSupervisionesTimelineView,
  buildSmsSupervisionesDetailTable,
  prepareSmsSupervisionesModel
} from './modalIndicadorSmsSupervisiones.js';

async function fetchSmsSupervisionesData() {
  const { getSmsSupervisionesData } = await import('../../services/supabaseClient.js');
  return getSmsSupervisionesData();
}

export async function openSmsSupervisionesModal(indicatorId, indicatorName, indicatorSubtitle) {
  const existingModal = document.getElementById(SMS_SUPERVISIONES_MODAL_ID);
  if (existingModal) {
    existingModal.remove();
  }

  const modalMarkup = buildSmsSupervisionesModalMarkup(indicatorName, indicatorSubtitle);
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const modal = document.getElementById(SMS_SUPERVISIONES_MODAL_ID);
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
    const records = await fetchSmsSupervisionesData();
    const model = prepareSmsSupervisionesModel(records);

    if (!model.records.length) {
      body.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
            <p class="mt-4 text-lg text-slate-700">No hay datos disponibles</p>
            <p class="mt-1 text-sm text-slate-500">Aún no se han registrado supervisiones para este indicador.</p>
          </div>
        </div>
      `;
      return;
    }

    const summaryMarkup = buildSmsSupervisionesSummary(model);
    const timelineMarkup = buildSmsSupervisionesTimelineView(model);
    const detailMarkup = buildSmsSupervisionesDetailTable(model);

    body.innerHTML = `
      ${summaryMarkup}
      <div class="mt-8">
        ${timelineMarkup}
      </div>
      <div class="mt-8">
        ${detailMarkup}
      </div>
    `;
  } catch (error) {
    console.error('Error al cargar datos de supervisiones SMS:', error);
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
}

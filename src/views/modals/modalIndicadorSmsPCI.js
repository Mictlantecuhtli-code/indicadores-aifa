const SMS_PCI_MODAL_ID = 'modal-sms-pci';

const MONTHS = [
  { value: 1, label: 'Enero', short: 'Ene' },
  { value: 2, label: 'Febrero', short: 'Feb' },
  { value: 3, label: 'Marzo', short: 'Mar' },
  { value: 4, label: 'Abril', short: 'Abr' },
  { value: 5, label: 'Mayo', short: 'May' },
  { value: 6, label: 'Junio', short: 'Jun' },
  { value: 7, label: 'Julio', short: 'Jul' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Septiembre', short: 'Sep' },
  { value: 10, label: 'Octubre', short: 'Oct' },
  { value: 11, label: 'Noviembre', short: 'Nov' },
  { value: 12, label: 'Diciembre', short: 'Dic' }
];

const ALERT_THRESHOLDS = [
  { value: 60, label: 'Nivel de alerta 3: 60', color: 'rgb(234, 179, 8)' },
  { value: 63, label: 'Nivel de alerta 2: 63', color: 'rgb(249, 115, 22)' },
  { value: 66, label: 'Nivel de alerta 1: 66', color: 'rgb(239, 68, 68)' }
];

const OBJECTIVE_THRESHOLD = { value: 70, label: 'Objetivo: 70', color: 'rgb(22, 163, 74)' };

const COLOR_SETS = [
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },
  { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgba(251, 146, 60, 1)' },
  { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgba(34, 197, 94, 1)' },
  { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgba(168, 85, 247, 1)' }
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function buildSmsPciModalMarkup(indicatorName, indicatorSubtitle) {
  return `
    <div
      id="${SMS_PCI_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[88vh] md:rounded-xl"
        data-modal-content
        role="dialog"
        aria-labelledby="sms-pci-modal-title"
        aria-describedby="sms-pci-modal-description"
      >
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div class="flex-1">
            <h2 id="sms-pci-modal-title" class="text-2xl font-bold text-slate-900">
              ${escapeHtml(indicatorName)}
            </h2>
            <p id="sms-pci-modal-description" class="mt-1 text-sm text-slate-600">
              ${escapeHtml(indicatorSubtitle)}
            </p>
          </div>
          <button
            type="button"
            class="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aifa-light"
            data-close-modal
            aria-label="Cerrar modal"
          >
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-6" data-modal-body>
          <div class="flex items-center justify-center py-8">
            <div class="flex items-center gap-2 text-slate-400">
              <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
              <span>Cargando datos...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildSmsPciSummary(data, annualTarget) {
  if (!Array.isArray(data) || !data.length) {
    return '';
  }

  const latestYear = Math.max(...data.map(row => row.anio));
  const latestYearData = data.filter(row => row.anio === latestYear);

  const tracks = groupByTrack(latestYearData);

  const summaryItems = Object.entries(tracks)
    .map(([trackName, trackData]) => {
      const sorted = [...trackData].sort((a, b) => {
        if (a.anio !== b.anio) return b.anio - a.anio;
        if (a.mes !== b.mes) return b.mes - a.mes;
        return 0;
      });
      const latest = sorted[0];
      return `
        <div class="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p class="text-sm font-semibold text-slate-700">${escapeHtml(trackName)}</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">${Number(latest.valor).toFixed(2)}</p>
          <p class="text-xs text-slate-500">Último registro: ${formatMonthYear(latest.mes, latest.anio)}</p>
        </div>
      `;
    })
    .join('');

  return `
    <section class="space-y-4">
      <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div class="flex flex-col gap-1 text-sm text-emerald-700">
          <span class="font-semibold text-emerald-900">Meta anual</span>
          <span>${annualTarget != null ? Number(annualTarget).toFixed(2) : '70.00'} (PCI)</span>
          <span class="text-xs text-emerald-600">Objetivo mínimo: mantener el PCI ≥ 70</span>
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        ${summaryItems}
      </div>
    </section>
  `;
}

export function buildSmsPciChartView(chartType = 'bar') {
  return `
    <section class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900">Comportamiento mensual por pista</h3>
          <p class="text-sm text-slate-600">Valores agrupados por pista considerando el año más reciente disponible.</p>
        </div>
        <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group">
          <button
            type="button"
            data-chart-type="bar"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition ${chartType === 'bar'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'}"
          >
            <i class="fa-solid fa-chart-column mr-1.5"></i>
            Barras
          </button>
          <button
            type="button"
            data-chart-type="line"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition ${chartType === 'line'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'}"
          >
            <i class="fa-solid fa-chart-line mr-1.5"></i>
            Líneas
          </button>
        </div>
      </header>
      <div class="relative h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <canvas data-sms-pci-chart></canvas>
      </div>
    </section>
  `;
}

export function buildSmsPciChartConfig(data, chartType = 'bar') {
  if (!Array.isArray(data) || !data.length) {
    return {
      type: chartType,
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  const latestYear = Math.max(...data.map(row => row.anio));
  const latestYearData = data.filter(row => row.anio === latestYear);

  const months = [...new Set(latestYearData.map(row => row.mes))].sort((a, b) => a - b);
  const labels = months.map(month => {
    const monthDef = MONTHS.find(item => item.value === month);
    return monthDef ? monthDef.label : `Mes ${month}`;
  });

  const tracks = Object.entries(groupByTrack(latestYearData));

  const datasets = tracks.map(([trackName, trackData], index) => {
    const colors = COLOR_SETS[index % COLOR_SETS.length];
    const values = months.map(month => {
      const record = trackData.find(item => item.mes === month);
      return record ? Number(record.valor) : null;
    });

    return {
      label: trackName,
      data: values,
      backgroundColor: chartType === 'line' ? colors.bg.replace('0.8', '0.15') : colors.bg,
      borderColor: colors.border,
      borderWidth: chartType === 'line' ? 3 : 2,
      tension: chartType === 'line' ? 0.35 : 0,
      fill: chartType === 'line',
      spanGaps: true,
      pointBackgroundColor: colors.border,
      pointBorderColor: '#fff',
      pointBorderWidth: chartType === 'line' ? 2 : 0,
      pointRadius: chartType === 'line' ? 4 : 0,
      pointHoverRadius: chartType === 'line' ? 6 : 0,
      pointHoverBackgroundColor: colors.border,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2
    };
  });

  const thresholdDatasets = [OBJECTIVE_THRESHOLD, ...ALERT_THRESHOLDS].map((threshold, idx) => ({
    label: threshold.label,
    data: labels.map(() => threshold.value),
    type: 'line',
    borderColor: threshold.color,
    borderWidth: threshold === OBJECTIVE_THRESHOLD ? 2.5 : 2,
    borderDash: threshold === OBJECTIVE_THRESHOLD ? [8, 4] : [6, 6],
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0,
    order: 99,
    isThreshold: true
  }));

  return {
    type: chartType,
    data: {
      labels,
      datasets: [...datasets, ...thresholdDatasets]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: chartType === 'bar',
          grid: { display: false },
          ticks: { font: { size: 12 } }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            callback: value => `${value}`
          },
          grid: { color: 'rgba(148, 163, 184, 0.15)' }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: context => {
              if (context.dataset?.isThreshold) {
                return context.dataset.label;
              }

              const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
              const value = context.parsed.y;
              return `${label}${value != null ? value.toFixed(2) : 'N/D'} PCI`;
            }
          }
        }
      }
    }
  };
}

export function groupByTrack(data) {
  return data.reduce((acc, row) => {
    const track = row.pista ?? 'Sin pista';
    if (!acc[track]) {
      acc[track] = [];
    }
    acc[track].push(row);
    return acc;
  }, {});
}

export function formatMonthYear(month, year) {
  const monthDef = MONTHS.find(item => item.value === Number(month));
  return monthDef ? `${monthDef.label} ${year}` : `${month}/${year}`;
}

export { SMS_PCI_MODAL_ID };

const DEFAULT_CLOSE_BUTTON_CLASSES =
  'absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-100';

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function buildInfoItems(infoItems) {
  if (!Array.isArray(infoItems) || infoItems.length === 0) {
    return '';
  }

  const itemsMarkup = infoItems
    .filter(item => item && (item.value ?? item.helperText ?? item.label))
    .map(item => {
      const label = item.label ? escapeHtml(item.label) : '';
      const value = item.value != null ? escapeHtml(String(item.value)) : '—';
      const helperText = item.helperText ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(item.helperText)}</p>` : '';
      const valueClass = item.valueClass ? item.valueClass : 'text-slate-900';

      return `
        <div class="rounded-xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
          ${label ? `<dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</dt>` : ''}
          <dd class="mt-1 text-sm font-semibold ${valueClass}">${value}</dd>
          ${helperText}
        </div>
      `;
    })
    .join('');

  if (!itemsMarkup) {
    return '';
  }

  return `
    <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      ${itemsMarkup}
    </dl>
  `;
}

function buildHighlightCard(highlight) {
  if (!highlight || (!highlight.label && !highlight.value)) {
    return '';
  }

  const label = highlight.label ? escapeHtml(highlight.label) : '';
  const value = highlight.value != null ? escapeHtml(String(highlight.value)) : '—';
  const description = highlight.description ? escapeHtml(highlight.description) : '';
  const containerClass = highlight.containerClass
    ? highlight.containerClass
    : 'border-emerald-100 bg-emerald-50/80';
  const labelClass = highlight.labelClass ? highlight.labelClass : 'text-emerald-700';
  const valueClass = highlight.valueClass ? highlight.valueClass : 'text-emerald-700';
  const descriptionClass = highlight.descriptionClass
    ? highlight.descriptionClass
    : 'text-emerald-700/80';

  return `
    <div class="rounded-2xl border ${containerClass} p-4 shadow-sm">
      ${label ? `<div class="text-xs font-semibold uppercase tracking-wide ${labelClass}">${label}</div>` : ''}
      <div class="mt-1 text-3xl font-bold ${valueClass}">${value}</div>
      ${description ? `<p class="mt-1 text-xs ${descriptionClass}">${description}</p>` : ''}
    </div>
  `;
}

export function buildIndicatorModalHeader({
  breadcrumb,
  title,
  subtitle,
  titleId,
  subtitleId,
  infoItems = [],
  highlight = null,
  extraContent = '',
  closeButtonAttributes = 'data-close-modal',
  closeButtonAriaLabel = 'Cerrar modal',
  closeButtonClasses = DEFAULT_CLOSE_BUTTON_CLASSES
} = {}) {
  const breadcrumbMarkup = breadcrumb
    ? `<p class="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600">${escapeHtml(breadcrumb)}</p>`
    : '';
  const titleAttributes = titleId ? ` id="${escapeHtml(titleId)}"` : '';
  const subtitleAttributes = subtitleId ? ` id="${escapeHtml(subtitleId)}"` : '';
  const titleMarkup = title
    ? `<h2${titleAttributes} class="text-2xl font-bold text-slate-900">${escapeHtml(title)}</h2>`
    : '';
  const subtitleMarkup = subtitle
    ? `<p${subtitleAttributes} class="mt-2 text-sm text-slate-600">${escapeHtml(subtitle)}</p>`
    : '';
  const infoMarkup = buildInfoItems(infoItems);
  const highlightMarkup = buildHighlightCard(highlight);
  const extraMarkup = extraContent ? `<div class="mt-4">${extraContent}</div>` : '';
  const highlightWrapper = highlightMarkup ? `<div class="w-full max-w-xs">${highlightMarkup}</div>` : '';

  return `
    <div class="relative border-b border-slate-200 bg-slate-50/70 px-6 py-6">
      <button
        type="button"
        class="${closeButtonClasses}"
        ${closeButtonAttributes}
        aria-label="${escapeHtml(closeButtonAriaLabel)}"
      >
        <i class="fa-solid fa-xmark text-xl"></i>
      </button>
      <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div class="flex-1 space-y-5">
          ${breadcrumbMarkup}
          <div>
            ${titleMarkup}
            ${subtitleMarkup}
          </div>
          ${infoMarkup}
          ${extraMarkup}
        </div>
        ${highlightWrapper}
      </div>
    </div>
  `;
}

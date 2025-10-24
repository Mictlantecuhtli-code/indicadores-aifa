function normalizeText(value, { lowercase = false } = {}) {
  let text = (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (lowercase) {
    text = text.toLowerCase();
  } else {
    text = text.toUpperCase();
  }

  return text;
}

export function normalizeIndicatorText(value) {
  return normalizeText(value, { lowercase: true });
}

export function normalizeScenarioKey(value) {
  const text = normalizeText(value);
  if (!text) return '';

  return text
    .replace(/\b(META|OBJETIVO|ESCENARIO|ANUAL)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFaunaImpactRateIndicator(indicator) {
  if (!indicator) return false;

  const code = indicator?.clave?.toString().trim().toUpperCase();
  if (code === 'SMS-01') {
    return true;
  }

  const name = normalizeIndicatorText(indicator?.nombre);
  const description = normalizeIndicatorText(indicator?.descripcion);

  const haystacks = [name, description].filter(Boolean);

  return haystacks.some(text =>
    text.includes('impact') && text.includes('fauna') && text.includes('tasa')
  );
}

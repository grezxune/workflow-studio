/**
 * Workflow Studio - Shared Duration Input
 *
 * A consistent control for entering a time duration with a unit selector
 * (ms / sec / min / hr). Durations are ALWAYS stored canonically in
 * milliseconds; the selected unit only affects how the number is displayed and
 * entered. Min–max ranges share a single unit selector.
 *
 * Usage:
 *   - Markup: durationFieldHTML({ id, valueMs }) or
 *     durationRangeFieldHTML({ minId, maxId, minMs, maxMs }).
 *     Static markup (e.g. settings, editor footer) can hand-write the same
 *     `.duration-input` structure and just set values at load time.
 *   - Read back canonical ms: readDurationMs(idOrEl) (null when empty).
 *   - Set programmatically: setDurationMs() / setDurationRangeMs().
 *
 * Switching units is purely cosmetic — it converts the displayed number in
 * place while keeping the underlying millisecond value constant, so nothing
 * needs to be re-saved until the user edits an actual number.
 */

const DURATION_UNITS = [
  { value: 'ms', label: 'ms', ms: 1 },
  { value: 's', label: 'sec', ms: 1000 },
  { value: 'min', label: 'min', ms: 60 * 1000 },
  { value: 'h', label: 'hr', ms: 60 * 60 * 1000 }
];

const DURATION_UNIT_RANK = DURATION_UNITS.reduce((acc, u, i) => {
  acc[u.value] = i;
  return acc;
}, {});

function durationUnitMs(unit) {
  const found = DURATION_UNITS.find((u) => u.value === unit);
  return found ? found.ms : 1;
}

/**
 * Largest unit that represents `ms` as a whole number, capped at `maxUnit`.
 * Non-finite / non-positive values fall back to 'ms'.
 */
function bestDurationUnit(ms, maxUnit = 'h') {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return 'ms';
  const cap = DURATION_UNIT_RANK[maxUnit] ?? DURATION_UNIT_RANK.h;
  for (let i = DURATION_UNITS.length - 1; i >= 0; i--) {
    const u = DURATION_UNITS[i];
    if (DURATION_UNIT_RANK[u.value] > cap) continue;
    if (value % u.ms === 0) return u.value;
  }
  return 'ms';
}

/** For a range, the smaller of the two best units so both ends stay whole. */
function bestDurationUnitForRange(minMs, maxMs, maxUnit = 'h') {
  const a = bestDurationUnit(minMs, maxUnit);
  const b = bestDurationUnit(maxMs, maxUnit);
  return DURATION_UNIT_RANK[a] <= DURATION_UNIT_RANK[b] ? a : b;
}

/** Format a ms value as a trimmed number string in `unit` ('' for empty). */
function msToUnitValue(ms, unit) {
  if (ms === '' || ms == null || !Number.isFinite(Number(ms))) return '';
  const n = Number(ms) / durationUnitMs(unit);
  // Keep enough precision that toggling units never loses sub-second values.
  return String(Math.round(n * 1e6) / 1e6);
}

function durEscapeHtml(text) {
  return String(text == null ? '' : text).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

function durationUnitOptions(selected, maxUnit = 'h') {
  const cap = DURATION_UNIT_RANK[maxUnit] ?? DURATION_UNIT_RANK.h;
  return DURATION_UNITS
    .filter((u) => DURATION_UNIT_RANK[u.value] <= cap)
    .map((u) => `<option value="${u.value}"${u.value === selected ? ' selected' : ''}>${u.label}</option>`)
    .join('');
}

/**
 * Markup for a single duration field.
 * @param {{id:string, valueMs?:number|string, unit?:string, maxUnit?:string, placeholder?:string, inputClass?:string}} opts
 */
function durationFieldHTML({ id, valueMs = '', unit, maxUnit = 'h', placeholder = '', inputClass = '' } = {}) {
  const hasValue = valueMs !== '' && valueMs != null && Number.isFinite(Number(valueMs));
  const u = unit || (hasValue ? bestDurationUnit(Number(valueMs), maxUnit) : 'ms');
  const shown = hasValue ? msToUnitValue(valueMs, u) : '';
  const cls = ('duration-input-value ' + (inputClass || '')).trim();
  return `<div class="duration-input" data-duration>`
    + `<input type="number" id="${id}" class="${cls}" min="0" step="any" value="${shown}"`
    + `${placeholder ? ` placeholder="${durEscapeHtml(placeholder)}"` : ''}>`
    + `<select class="duration-input-unit" data-prev-unit="${u}" aria-label="Time unit">`
    + `${durationUnitOptions(u, maxUnit)}</select>`
    + `</div>`;
}

/**
 * Markup for a min–max duration range that shares one unit selector.
 * @param {{minId:string, maxId:string, minMs?:number, maxMs?:number, separator?:string, unit?:string, maxUnit?:string}} opts
 */
function durationRangeFieldHTML({ minId, maxId, minMs = 0, maxMs = 0, separator = 'to', unit, maxUnit = 'h' } = {}) {
  const u = unit || bestDurationUnitForRange(minMs, maxMs, maxUnit);
  return `<div class="duration-input duration-input--range" data-duration>`
    + `<input type="number" id="${minId}" class="duration-input-value" min="0" step="any" value="${msToUnitValue(minMs, u)}">`
    + `<span class="duration-input-dash">${durEscapeHtml(separator)}</span>`
    + `<input type="number" id="${maxId}" class="duration-input-value" min="0" step="any" value="${msToUnitValue(maxMs, u)}">`
    + `<select class="duration-input-unit" data-prev-unit="${u}" aria-label="Time unit">`
    + `${durationUnitOptions(u, maxUnit)}</select>`
    + `</div>`;
}

/** Read a duration field back in canonical milliseconds (null when empty/invalid). */
function readDurationMs(idOrEl) {
  const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!input) return null;
  const raw = String(input.value).trim();
  if (raw === '') return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  const wrap = input.closest('[data-duration]');
  const unit = wrap?.querySelector('.duration-input-unit')?.value || 'ms';
  return Math.round(n * durationUnitMs(unit));
}

/** Set a single duration field from a ms value, picking the cleanest unit. */
function setDurationMs(idOrEl, ms, { unit, maxUnit = 'h' } = {}) {
  const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!input) return;
  const empty = ms === '' || ms == null || !Number.isFinite(Number(ms));
  const u = unit || (empty ? 'ms' : bestDurationUnit(Number(ms), maxUnit));
  const wrap = input.closest('[data-duration]');
  const sel = wrap?.querySelector('.duration-input-unit');
  if (sel) {
    sel.value = u;
    sel.dataset.prevUnit = u;
  }
  input.value = empty ? '' : msToUnitValue(ms, u);
}

/** Set a min–max duration range from ms values, sharing one unit. */
function setDurationRangeMs(minId, maxId, minMs, maxMs, { unit, maxUnit = 'h' } = {}) {
  const minEl = document.getElementById(minId);
  const maxEl = document.getElementById(maxId);
  if (!minEl || !maxEl) return;
  const u = unit || bestDurationUnitForRange(minMs, maxMs, maxUnit);
  const sel = minEl.closest('[data-duration]')?.querySelector('.duration-input-unit');
  if (sel) {
    sel.value = u;
    sel.dataset.prevUnit = u;
  }
  minEl.value = msToUnitValue(minMs, u);
  maxEl.value = msToUnitValue(maxMs, u);
}

// When the unit changes, convert the displayed number(s) in place so the
// underlying millisecond value is preserved. Purely cosmetic — no re-save.
document.addEventListener('change', (e) => {
  const sel = e.target.closest?.('.duration-input-unit');
  if (!sel) return;
  const wrap = sel.closest('[data-duration]');
  if (!wrap) return;
  const prevUnit = sel.dataset.prevUnit || 'ms';
  const nextUnit = sel.value;
  sel.dataset.prevUnit = nextUnit;
  if (prevUnit === nextUnit) return;
  const factor = durationUnitMs(prevUnit) / durationUnitMs(nextUnit);
  wrap.querySelectorAll('.duration-input-value').forEach((inp) => {
    const n = parseFloat(inp.value);
    if (Number.isFinite(n)) {
      inp.value = String(Math.round(n * factor * 1e6) / 1e6);
    }
  });
});

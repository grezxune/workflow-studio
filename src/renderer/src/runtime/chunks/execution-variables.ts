/* Execution — live workflow variables panel (ported from WIP). Shares the execution runtime global scope. */

function syncExecutionVariables(variables) {
  executionVariablesState = Array.isArray(variables)
    ? variables.map((variable) => ({
      ...variable,
      value: !!variable.value
    }))
    : [];
  renderExecutionVariables();
}

function updateExecutionVariable(nextVariable) {
  if (!nextVariable?.id) return;

  const index = executionVariablesState.findIndex((variable) => variable.id === nextVariable.id);
  if (index === -1) {
    executionVariablesState.push({ ...nextVariable, value: !!nextVariable.value });
  } else {
    executionVariablesState[index] = {
      ...executionVariablesState[index],
      ...nextVariable,
      value: !!nextVariable.value
    };
  }

  renderExecutionVariables();
}

function renderExecutionVariables() {
  if (!executionVariables) return;

  const visibleVariables = executionVariablesState.filter((variable) => {
    const target = variable.indicatorTarget || 'both';
    return target === 'overlay' || target === 'both';
  });

  executionVariables.innerHTML = visibleVariables.map((variable) => {
    const active = !!variable.value;
    const timestamp = active && variable.triggeredAt
      ? `<span class="execution-variable-meta">Hit ${escapeHtml(formatVariableTimestamp(variable.triggeredAt))} · ${escapeHtml(formatTimeSince(variable.triggeredAt))}</span>`
      : '';
    return `
      <div class="execution-variable-pill ${active ? 'active' : ''}" style="--pill-color:${escapeHtml(variable.color || '#06b6d4')}">
        <span class="execution-variable-dot"></span>
        <span class="execution-variable-content">
          <span>${escapeHtml(variable.name || 'Variable')}</span>
          ${timestamp}
        </span>
        ${active ? `
          <button class="execution-variable-reset" data-variable-id="${escapeHtml(variable.id)}" title="Reset ${escapeHtml(variable.name || 'variable')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 3-6.7"/>
              <polyline points="3 3 3 9 9 9"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  executionVariables.classList.toggle('hidden', visibleVariables.length === 0);
  if (visibleVariables.some((variable) => variable.value && variable.triggeredAt)) {
    startExecutionVariableTicker();
  } else {
    stopExecutionVariableTicker();
  }

  const flashingVariable = visibleVariables.find((variable) => variable.value);
  if (executionStatusCard) {
    if (flashingVariable) {
      executionStatusCard.style.setProperty('--execution-flash-color', flashingVariable.color || '#06b6d4');
      executionStatusCard.classList.add('flashing');
    } else {
      executionStatusCard.classList.remove('flashing');
    }
  }

  executionVariables.querySelectorAll('[data-variable-id]').forEach((button) => {
    button.addEventListener('click', () => {
      resetExecutionVariable(button.dataset.variableId);
    });
  });
}

async function resetExecutionVariable(variableId) {
  if (!variableId) return;
  await window.workflowAPI.resetWorkflowVariable?.(variableId);
}

function startExecutionVariableTicker() {
  stopExecutionVariableTicker();
  if (!executionVariablesState.some((variable) => variable.value && variable.triggeredAt)) return;
  executionVariableTicker = setInterval(() => {
    renderExecutionVariables();
  }, 1000);
}

function stopExecutionVariableTicker() {
  if (executionVariableTicker) {
    clearInterval(executionVariableTicker);
    executionVariableTicker = null;
  }
}

/**
 * Format milliseconds for display
 */

function formatVariableTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatTimeSince(isoString) {
  const date = new Date(isoString);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime()) || diff < 0) return 'just now';
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s ago`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s ago`;
  return `${seconds}s ago`;
}

/**
 * Populate the follow-up workflow dropdown with all available workflows
 */

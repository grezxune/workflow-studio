/**
 * Workflow Studio - Analytics View
 *
 * Renders overall and per-workflow execution metrics from persisted run history.
 * Public API (used by app.js / workflows.js) is unchanged:
 *   - initAnalyticsView()
 *   - showWorkflowAnalytics(workflowId)
 *   - renderAnalyticsDashboard()
 */

const analyticsState = {
  selectedWorkflowId: null,
  isLoading: false
};

const analyticsElements = {
  summaryGrid: null,
  workflowTable: null,
  workflowSelect: null,
  workflowDetail: null,
  recentRuns: null,
  refreshButton: null
};

function initAnalyticsView() {
  analyticsElements.summaryGrid = document.getElementById('analytics-summary-grid');
  analyticsElements.workflowTable = document.getElementById('analytics-workflow-table');
  analyticsElements.workflowSelect = document.getElementById('analytics-workflow-select');
  analyticsElements.workflowDetail = document.getElementById('workflow-analytics-detail');
  analyticsElements.recentRuns = document.getElementById('analytics-recent-runs');
  analyticsElements.refreshButton = document.getElementById('btn-refresh-analytics');

  analyticsElements.refreshButton?.addEventListener('click', renderAnalyticsDashboard);
  analyticsElements.workflowSelect?.addEventListener('change', () => {
    analyticsState.selectedWorkflowId = analyticsElements.workflowSelect.value || null;
    renderAnalyticsDashboard();
  });
}

function showWorkflowAnalytics(workflowId) {
  analyticsState.selectedWorkflowId = workflowId;

  if (state.currentView === 'analytics') {
    renderAnalyticsDashboard();
  } else {
    navigateTo('analytics');
  }
}

async function renderAnalyticsDashboard() {
  if (!analyticsElements.summaryGrid) return;
  if (!window.workflowAPI?.getOverallAnalytics) return;

  analyticsState.isLoading = true;
  setAnalyticsLoadingState(true);

  try {
    const overall = await window.workflowAPI.getOverallAnalytics();
    ensureSelectedWorkflow(overall);
    renderWorkflowSelect(overall);

    const workflowAnalytics = analyticsState.selectedWorkflowId
      ? await window.workflowAPI.getWorkflowAnalytics(analyticsState.selectedWorkflowId)
      : null;

    renderOverallSummary(overall);
    renderWorkflowPerformanceTable(overall);
    renderWorkflowDetail(workflowAnalytics);
    renderRecentRuns(overall.recentRuns || []);
  } catch (error) {
    console.error('[Analytics] Failed to render:', error);
    analyticsElements.summaryGrid.innerHTML = '<div class="analytics-empty">Unable to load analytics</div>';
    analyticsElements.workflowTable.innerHTML = '';
    analyticsElements.workflowDetail.innerHTML = '';
    analyticsElements.recentRuns.innerHTML = '';
  } finally {
    analyticsState.isLoading = false;
    setAnalyticsLoadingState(false);
  }
}

function setAnalyticsLoadingState(loading) {
  if (analyticsElements.refreshButton) {
    analyticsElements.refreshButton.disabled = loading;
    analyticsElements.refreshButton.classList.toggle('checking', loading);
  }
}

function ensureSelectedWorkflow(overall) {
  const existingWorkflowIds = new Set((state.workflows || []).map(workflow => workflow.id));
  const selectedExists = analyticsState.selectedWorkflowId
    && (existingWorkflowIds.has(analyticsState.selectedWorkflowId)
      || overall.perWorkflow?.some(item => item.workflowId === analyticsState.selectedWorkflowId));

  if (selectedExists) return;

  analyticsState.selectedWorkflowId = overall.perWorkflow?.[0]?.workflowId
    || state.workflows?.[0]?.id
    || null;
}

function renderWorkflowSelect(overall) {
  const select = analyticsElements.workflowSelect;
  if (!select) return;

  const options = [...(state.workflows || [])]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(workflow => ({
      id: workflow.id,
      name: workflow.name || 'Untitled Workflow'
    }));

  const selectedInOptions = options.some(option => option.id === analyticsState.selectedWorkflowId);
  if (analyticsState.selectedWorkflowId && !selectedInOptions) {
    const historical = overall.perWorkflow?.find(item => item.workflowId === analyticsState.selectedWorkflowId);
    options.unshift({
      id: analyticsState.selectedWorkflowId,
      name: historical?.workflowName || 'Deleted Workflow'
    });
  }

  select.innerHTML = options.length
    ? options.map(option => `
      <option value="${analyticsEscapeHtml(option.id)}" ${option.id === analyticsState.selectedWorkflowId ? 'selected' : ''}>
        ${analyticsEscapeHtml(option.name)}
      </option>
    `).join('')
    : '<option value="">No workflows</option>';
}

function renderOverallSummary(overall) {
  const summary = overall.summary || {};
  const totalRuns = Number(summary.totalRuns) || 0;
  const recentRuns = overall.recentRuns || [];

  const hero = `
    <div class="analytics-hero">
      <div class="analytics-hero-ring">
        ${renderOutcomeDonut(summary)}
        <div class="analytics-hero-ring-caption">Run outcomes</div>
        ${renderOutcomeLegend(summary)}
      </div>
      <div class="analytics-hero-headline">
        <div class="analytics-hero-eyebrow">Total executions</div>
        <div class="analytics-hero-value">${formatAnalyticsNumber(totalRuns)}</div>
        <div class="analytics-hero-substats">
          <span><strong>${formatAnalyticsNumber(overall.workflowsRun || 0)}</strong> workflows</span>
          <span class="analytics-dot-sep"></span>
          <span><strong>${formatAnalyticsNumber(summary.totalActions)}</strong> actions</span>
          <span class="analytics-dot-sep"></span>
          <span>last run <strong>${analyticsEscapeHtml(formatAnalyticsDate(summary.lastRunAt, true))}</strong></span>
        </div>
      </div>
      <div class="analytics-hero-activity">
        <div class="analytics-hero-activity-label">Recent activity</div>
        ${renderActivityBars(recentRuns)}
      </div>
    </div>
  `;

  const cards = [
    { icon: 'clock', accent: '#22d3ee', label: 'Time Automated', value: formatAnalyticsDuration(summary.totalDurationMs), meta: `${formatAnalyticsDuration(summary.averageDurationMs)} avg run` },
    { icon: 'gauge', accent: '#60a5fa', label: 'Avg Duration', value: formatAnalyticsDuration(summary.averageDurationMs), meta: `across ${formatAnalyticsNumber(totalRuns)} runs` },
    { icon: 'gauge', accent: '#a78bfa', label: 'Longest Run', value: formatAnalyticsDuration(summary.longestDurationMs), meta: `${formatAnalyticsDuration(summary.shortestDurationMs)} shortest` },
    { icon: 'layers', accent: '#818cf8', label: 'Actions', value: formatAnalyticsNumber(summary.totalActions), meta: `${formatAnalyticsNumber(summary.averageActions, 1)} avg/run` },
    { icon: 'calendar', accent: '#fbbf24', label: 'Last Run', value: formatAnalyticsDate(summary.lastRunAt, true), meta: summary.lastStatus ? formatAnalyticsStatus(summary.lastStatus) : 'No runs' }
  ];

  const tiles = cards.map(card => `
    <div class="analytics-metric" style="--metric-accent: ${card.accent}">
      <div class="analytics-metric-top">
        <span class="analytics-metric-icon">${analyticsIcon(card.icon)}</span>
        <span class="analytics-metric-label">${analyticsEscapeHtml(card.label)}</span>
      </div>
      <div class="analytics-metric-value">${analyticsEscapeHtml(card.value)}</div>
      <div class="analytics-metric-meta">${analyticsEscapeHtml(card.meta)}</div>
    </div>
  `).join('');

  analyticsElements.summaryGrid.innerHTML = hero + tiles;
}

function renderWorkflowPerformanceTable(overall) {
  const rows = overall.perWorkflow || [];
  if (!rows.length) {
    analyticsElements.workflowTable.innerHTML = '<div class="analytics-empty">No workflow runs yet</div>';
    return;
  }

  analyticsElements.workflowTable.innerHTML = `
    <div class="analytics-table-row analytics-table-head workflow-performance-row">
      <div>Workflow</div>
      <div>Runs</div>
      <div>Total</div>
      <div>Average</div>
      <div>Completed</div>
      <div>Last</div>
    </div>
    ${rows.map(item => {
      const summary = item.summary || {};
      const active = item.workflowId === analyticsState.selectedWorkflowId;
      const rate = Number(summary.successRate) || 0;
      return `
        <button class="analytics-table-row workflow-performance-row ${active ? 'active' : ''}" data-workflow-id="${analyticsEscapeHtml(item.workflowId)}">
          <div class="analytics-table-primary">
            <span class="analytics-status-dot ${analyticsEscapeHtml(summary.lastStatus || 'idle')}"></span>
            <span class="analytics-table-primary-text">${analyticsEscapeHtml(item.workflowName || 'Untitled Workflow')}</span>
          </div>
          <div class="analytics-num">${formatAnalyticsNumber(summary.totalRuns)}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))}</div>
          <div class="analytics-success-cell">
            <span class="analytics-meter"><span style="width:${Math.round(rate * 100)}%"></span></span>
            <span class="analytics-num">${analyticsEscapeHtml(formatAnalyticsPercent(summary.successRate))}</span>
          </div>
          <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(summary.lastRunAt, true))}</div>
        </button>
      `;
    }).join('')}
  `;

  analyticsElements.workflowTable.querySelectorAll('[data-workflow-id]').forEach(row => {
    row.addEventListener('click', () => {
      analyticsState.selectedWorkflowId = row.dataset.workflowId;
      renderAnalyticsDashboard();
    });
  });
}

function renderWorkflowDetail(analytics) {
  if (!analytics || !analytics.summary) {
    analyticsElements.workflowDetail.innerHTML = '<div class="analytics-empty">Select a workflow above to see its run history.</div>';
    return;
  }

  const summary = analytics.summary;
  const runs = analytics.runs || [];
  const workflowName = analytics.workflow?.name || runs[0]?.workflowName || 'Deleted Workflow';
  const maxDuration = Math.max(...runs.map(run => Number(run.durationMs) || 0), 1);

  analyticsElements.workflowDetail.innerHTML = `
    <div class="workflow-analytics-title">
      <h2>${analyticsEscapeHtml(workflowName)}</h2>
      <span class="analytics-status ${analyticsEscapeHtml(summary.lastStatus || 'idle')}">
        <span class="analytics-status-dot ${analyticsEscapeHtml(summary.lastStatus || 'idle')}"></span>
        ${analyticsEscapeHtml(summary.lastStatus ? formatAnalyticsStatus(summary.lastStatus) : 'No runs')}
      </span>
    </div>

    <div class="analytics-detail-grid">
      <div class="analytics-metric" style="--metric-accent:#22d3ee">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('runs')}</span>
          <span class="analytics-metric-label">Runs</span>
        </div>
        <div class="analytics-metric-value">${formatAnalyticsNumber(summary.totalRuns)}</div>
        <div class="analytics-metric-meta">${formatAnalyticsNumber(summary.dryRuns)} dry runs</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#60a5fa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('clock')}</span>
          <span class="analytics-metric-label">Total Time</span>
        </div>
        <div class="analytics-metric-value">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
        <div class="analytics-metric-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))} avg</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#a78bfa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('gauge')}</span>
          <span class="analytics-metric-label">Fastest</span>
        </div>
        <div class="analytics-metric-value">${analyticsEscapeHtml(formatAnalyticsDuration(summary.shortestDurationMs))}</div>
        <div class="analytics-metric-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.longestDurationMs))} slowest</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#34d399">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('bolt')}</span>
          <span class="analytics-metric-label">Completed</span>
        </div>
        <div class="analytics-metric-value">${formatAnalyticsNumber(summary.completedRuns)}</div>
        <div class="analytics-metric-meta">${formatAnalyticsNumber(summary.stoppedRuns)} stopped, ${formatAnalyticsNumber(summary.errorRuns)} errors</div>
      </div>
    </div>

    <div class="analytics-duration-list">
      <div class="analytics-duration-caption">Run durations</div>
      ${runs.length ? runs.slice(0, 12).map(run => `
        <div class="analytics-duration-row">
          <div class="analytics-duration-info">
            <span>${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</span>
            <span class="analytics-status ${analyticsEscapeHtml(run.status)}">
              <span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>
              ${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}
            </span>
          </div>
          <div class="analytics-duration-bar">
            <span class="status-${analyticsEscapeHtml(run.status || 'idle')}" style="width: ${Math.max(4, ((Number(run.durationMs) || 0) / maxDuration) * 100)}%"></span>
          </div>
          <div class="analytics-duration-value">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        </div>
      `).join('') : '<div class="analytics-empty">No runs recorded</div>'}
    </div>

    ${renderRunLog(runs)}
  `;
}

function renderRunLog(runs) {
  if (!runs.length) return '';

  return `
    <div class="analytics-run-log">
      <div class="analytics-table-row analytics-table-head run-log-row">
        <div>Started</div>
        <div>Status</div>
        <div>Duration</div>
        <div>Loops</div>
        <div>Actions</div>
      </div>
      ${runs.map(run => `
        <div class="analytics-table-row run-log-row">
          <div class="analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</div>
          <div><span class="analytics-status ${analyticsEscapeHtml(run.status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}</span></div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsLoops(run))}</div>
          <div class="analytics-num">${formatAnalyticsNumber(run.actions || 0)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentRuns(runs) {
  if (!runs.length) {
    analyticsElements.recentRuns.innerHTML = '<div class="analytics-empty">No workflow runs yet</div>';
    return;
  }

  analyticsElements.recentRuns.innerHTML = `
    <div class="analytics-table-row analytics-table-head recent-run-row">
      <div>Workflow</div>
      <div>Status</div>
      <div>Duration</div>
      <div>Started</div>
    </div>
    ${runs.map(run => `
      <button class="analytics-table-row recent-run-row" data-workflow-id="${analyticsEscapeHtml(run.workflowId)}">
        <div class="analytics-table-primary">
          <span class="analytics-status-dot ${analyticsEscapeHtml(run.status || 'idle')}"></span>
          <span class="analytics-table-primary-text">${analyticsEscapeHtml(run.workflowName || 'Untitled Workflow')}</span>
        </div>
        <div><span class="analytics-status ${analyticsEscapeHtml(run.status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}</span></div>
        <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt, true))}</div>
      </button>
    `).join('')}
  `;

  analyticsElements.recentRuns.querySelectorAll('[data-workflow-id]').forEach(row => {
    row.addEventListener('click', () => {
      analyticsState.selectedWorkflowId = row.dataset.workflowId;
      renderAnalyticsDashboard();
    });
  });
}

/* ---------- Visualization helpers ---------- */

// A multi-segment donut showing how runs ended: completed / stopped / error.
// Replaces the old single "success rate" ring, which was ambiguous.
function renderOutcomeDonut(summary) {
  const total = Number(summary.totalRuns) || 0;
  const completed = Number(summary.completedRuns) || 0;
  const stopped = Number(summary.stoppedRuns) || 0;
  const errored = Number(summary.errorRuns) || 0;
  const other = Math.max(0, total - completed - stopped - errored);
  const completionPct = total ? Math.round((completed / total) * 100) : 0;

  // r chosen so circumference ≈ 100, letting stroke-dasharray act as a percentage.
  const segments = [
    { count: completed, color: '#34d399' },
    { count: stopped, color: '#fbbf24' },
    { count: errored, color: '#f87171' },
    { count: other, color: '#5b6478' }
  ].filter(seg => seg.count > 0);

  let circles = '<circle class="analytics-donut-track" cx="20" cy="20" r="15.915" />';
  if (total > 0) {
    let cumulative = 0;
    circles += segments.map(seg => {
      const len = (seg.count / total) * 100;
      const dashoffset = (25 - cumulative + 100) % 100;
      cumulative += len;
      return `<circle class="analytics-donut-seg" cx="20" cy="20" r="15.915" stroke="${seg.color}" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${dashoffset}" />`;
    }).join('');
  }

  return `
    <svg class="analytics-donut" viewBox="0 0 40 40" role="img" aria-label="${completionPct}% of runs completed">
      ${circles}
      <text class="analytics-donut-value" x="20" y="20" dominant-baseline="central" text-anchor="middle">${total ? completionPct + '%' : '—'}</text>
    </svg>
  `;
}

function renderOutcomeLegend(summary) {
  const items = [
    { label: 'Completed', cls: 'completed', count: Number(summary.completedRuns) || 0 },
    { label: 'Stopped', cls: 'stopped', count: Number(summary.stoppedRuns) || 0 },
    { label: 'Error', cls: 'error', count: Number(summary.errorRuns) || 0 }
  ];
  return `
    <div class="analytics-outcome-legend">
      ${items.map(item => `
        <span class="analytics-outcome-item">
          <span class="analytics-status-dot ${item.cls}"></span>
          <span class="analytics-outcome-label">${item.label}</span>
          <span class="analytics-outcome-count">${formatAnalyticsNumber(item.count)}</span>
        </span>
      `).join('')}
    </div>
  `;
}

function renderActivityBars(runs) {
  if (!runs || !runs.length) {
    return '<div class="analytics-activity-empty">No recent runs</div>';
  }
  // Oldest -> newest, up to 24 bars.
  const ordered = [...runs].slice(0, 24).reverse();
  const max = Math.max(...ordered.map(r => Number(r.durationMs) || 0), 1);
  const bars = ordered.map(run => {
    const h = Math.max(8, Math.round(((Number(run.durationMs) || 0) / max) * 100));
    const status = run.status || 'idle';
    const title = `${formatAnalyticsStatus(status)} · ${formatAnalyticsDuration(run.durationMs)}`;
    return `<span class="analytics-bar status-${analyticsEscapeHtml(status)}" style="height:${h}%" title="${analyticsEscapeHtml(title)}"></span>`;
  }).join('');
  return `<div class="analytics-activity-bars">${bars}</div>`;
}

function analyticsIcon(name) {
  const icons = {
    runs: '<path d="M5 3l14 9-14 9V3z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/>',
    layers: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
  };
  const body = icons[name] || icons.runs;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/* ---------- Formatting ---------- */

function formatAnalyticsNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  });
}

function formatAnalyticsPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0%';
  return `${Math.round(number * 100)}%`;
}

function formatAnalyticsDuration(ms) {
  const duration = Number(ms);
  if (!Number.isFinite(duration) || duration <= 0) return '0ms';

  if (duration < 1000) return `${Math.round(duration)}ms`;

  const totalSeconds = Math.round(duration / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatAnalyticsDate(isoString, compact = false) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  if (compact) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatAnalyticsStatus(status) {
  const labels = {
    completed: 'Completed',
    stopped: 'Stopped',
    error: 'Error',
    idle: 'No runs'
  };
  return labels[status] || status || 'Unknown';
}

function formatAnalyticsLoops(run) {
  const completed = run.completedLoops;
  const configured = run.loopsConfigured || 1;
  if (completed === null || completed === undefined) return String(configured);
  return `${completed}/${configured}`;
}

function analyticsEscapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === null || value === undefined ? '' : String(value);
  return div.innerHTML;
}

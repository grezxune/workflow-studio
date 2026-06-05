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
  isLoading: false,
  liveRun: null,
  liveTicker: null,
  renderTimer: null,
  liveFrame: null,
  needsLiveStructureRender: false,
  overallCache: null,
  workflowCache: new Map(),
  cacheLoaded: false,
  dataRequestSeq: 0,
  lastRendered: {
    summaryGrid: '',
    workflowSelect: '',
    workflowTable: '',
    workflowDetail: '',
    recentRuns: ''
  }
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

  analyticsElements.refreshButton?.addEventListener('click', () => {
    renderAnalyticsDashboard({ showLoading: true });
  });
  analyticsElements.workflowSelect?.addEventListener('change', () => {
    analyticsState.selectedWorkflowId = analyticsElements.workflowSelect.value || null;
    renderAnalyticsDashboard({ showLoading: false });
  });
}

function showWorkflowAnalytics(workflowId) {
  analyticsState.selectedWorkflowId = workflowId;

  if (state.currentView === 'analytics') {
    renderAnalyticsDashboard({ showLoading: false });
  } else {
    navigateTo('analytics');
  }
}

async function renderAnalyticsDashboard(options = {}) {
  await refreshAnalyticsDashboardData(options);
}

async function refreshAnalyticsDashboardData(options = {}) {
  if (!analyticsElements.summaryGrid) return;
  if (!window.workflowAPI?.getOverallAnalytics) return;

  const showLoading = options.showLoading !== false;
  const requestSeq = ++analyticsState.dataRequestSeq;

  if (showLoading) {
    analyticsState.isLoading = true;
    setAnalyticsLoadingState(true);
  }

  try {
    const overall = await window.workflowAPI.getOverallAnalytics();
    if (requestSeq !== analyticsState.dataRequestSeq) return;

    analyticsState.overallCache = overall || {};
    analyticsState.cacheLoaded = true;

    const snapshotOverall = getAnalyticsOverallSnapshot();
    ensureSelectedWorkflow(snapshotOverall);

    const workflowAnalytics = analyticsState.selectedWorkflowId
      ? await window.workflowAPI.getWorkflowAnalytics(analyticsState.selectedWorkflowId)
      : null;
    if (requestSeq !== analyticsState.dataRequestSeq) return;

    if (analyticsState.selectedWorkflowId) {
      analyticsState.workflowCache.set(analyticsState.selectedWorkflowId, workflowAnalytics || null);
    }

    renderCachedAnalyticsDashboard();
  } catch (error) {
    console.error('[Analytics] Failed to render:', error);

    if (!analyticsState.cacheLoaded) {
      setAnalyticsSectionHtml('summaryGrid', analyticsElements.summaryGrid, '<div class="analytics-empty">Unable to load analytics</div>');
      setAnalyticsSectionHtml('workflowTable', analyticsElements.workflowTable, '');
      setAnalyticsSectionHtml('workflowDetail', analyticsElements.workflowDetail, '');
      setAnalyticsSectionHtml('recentRuns', analyticsElements.recentRuns, '');
    }
  } finally {
    if (showLoading) {
      analyticsState.isLoading = false;
      setAnalyticsLoadingState(false);
    }
  }
}

function renderCachedAnalyticsDashboard() {
  if (!analyticsElements.summaryGrid) return;

  const overall = getAnalyticsOverallSnapshot();
  ensureSelectedWorkflow(overall);

  const workflowAnalytics = getAnalyticsWorkflowSnapshot();

  renderWorkflowSelect(overall);
  renderOverallSummary(overall);
  renderWorkflowPerformanceTable(overall);
  renderWorkflowDetail(workflowAnalytics);
  renderRecentRuns(overall.recentRuns || []);
}

function getAnalyticsOverallSnapshot() {
  return mergeLiveRunIntoOverall(analyticsState.overallCache || {});
}

function getAnalyticsWorkflowSnapshot() {
  if (!analyticsState.selectedWorkflowId) return null;
  const cached = analyticsState.workflowCache.has(analyticsState.selectedWorkflowId)
    ? analyticsState.workflowCache.get(analyticsState.selectedWorkflowId)
    : null;
  return mergeLiveRunIntoWorkflowAnalytics(cached);
}

function setAnalyticsLoadingState(loading) {
  if (analyticsElements.refreshButton) {
    analyticsElements.refreshButton.disabled = loading;
    analyticsElements.refreshButton.classList.toggle('checking', loading);
  }
}

function setAnalyticsSectionHtml(sectionKey, element, html) {
  if (!element) return false;
  if (analyticsState.lastRendered[sectionKey] === html) return false;

  analyticsState.lastRendered[sectionKey] = html;
  element.innerHTML = html;
  return true;
}

function setAnalyticsLiveExecution(execution, status = 'running') {
  if (!execution?.workflowId) return;

  const startedAtMs = Number(execution.startTime)
    || +new Date(execution.startedAt || 0)
    || Date.now();

  analyticsState.liveRun = {
    id: `live-${execution.workflowId}-${startedAtMs}`,
    workflowId: execution.workflowId,
    workflowName: execution.workflowName || execution.workflow?.name || 'Untitled Workflow',
    status: normalizeAnalyticsStatus(status),
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
    endedAt: null,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    loopsConfigured: execution.loopsConfigured ?? execution.loops ?? 1,
    completedLoops: execution.completedLoops ?? null,
    actions: Number(execution.actions) || 0,
    dryRun: !!execution.dryRun,
    error: execution.error || null,
    isLive: true
  };

  startAnalyticsLiveTicker();
  requestAnalyticsLiveRender({ structural: true });
}

function updateAnalyticsLiveExecution(patch = {}) {
  if (!analyticsState.liveRun) return;
  analyticsState.liveRun = {
    ...analyticsState.liveRun,
    ...patch,
    status: normalizeAnalyticsStatus(patch.status || analyticsState.liveRun.status)
  };
  updateAnalyticsLiveDuration();
  requestAnalyticsLiveRender({ structural: patch.status !== undefined });
}

function completeAnalyticsLiveExecution(status = 'completed', patch = {}) {
  if (!analyticsState.liveRun) return;

  const finalStatus = normalizeAnalyticsStatus(status);
  const endedAtMs = Date.now();
  analyticsState.liveRun = {
    ...analyticsState.liveRun,
    ...patch,
    status: finalStatus,
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: Math.max(0, endedAtMs - analyticsState.liveRun.startedAtMs),
    error: finalStatus === 'error' ? patch.error || analyticsState.liveRun.error || null : null
  };

  stopAnalyticsLiveTicker();
  requestAnalyticsLiveRender({ structural: true });

  const liveId = analyticsState.liveRun.id;
  setTimeout(() => {
    if (analyticsState.liveRun?.id === liveId && isTerminalAnalyticsStatus(analyticsState.liveRun.status)) {
      analyticsState.liveRun = null;
      requestAnalyticsLiveRender({ structural: true });
    }
  }, 5000);
}

function requestAnalyticsDashboardRefresh(options = {}) {
  if (state.currentView !== 'analytics') return;
  if (analyticsState.renderTimer) return;

  analyticsState.renderTimer = setTimeout(() => {
    analyticsState.renderTimer = null;
    renderAnalyticsDashboard({ showLoading: false });
  }, options.delay ?? 120);
}

function requestAnalyticsLiveRender(options = {}) {
  if (state.currentView !== 'analytics') return;

  analyticsState.needsLiveStructureRender = analyticsState.needsLiveStructureRender || !!options.structural;
  if (analyticsState.liveFrame) return;

  analyticsState.liveFrame = requestAnimationFrame(() => {
    analyticsState.liveFrame = null;

    if (analyticsState.needsLiveStructureRender) {
      analyticsState.needsLiveStructureRender = false;
      renderCachedAnalyticsDashboard();
    }

    patchAnalyticsLiveValues();
  });
}

function startAnalyticsLiveTicker() {
  if (analyticsState.liveTicker) return;
  analyticsState.liveTicker = setInterval(() => {
    if (!analyticsState.liveRun || isTerminalAnalyticsStatus(analyticsState.liveRun.status)) {
      stopAnalyticsLiveTicker();
      return;
    }
    updateAnalyticsLiveDuration();
    requestAnalyticsLiveRender();
  }, 1000);
}

function stopAnalyticsLiveTicker() {
  if (!analyticsState.liveTicker) return;
  clearInterval(analyticsState.liveTicker);
  analyticsState.liveTicker = null;
}

function updateAnalyticsLiveDuration() {
  if (!analyticsState.liveRun || analyticsState.liveRun.endedAt) return;
  analyticsState.liveRun.durationMs = Math.max(0, Date.now() - analyticsState.liveRun.startedAtMs);
}

function patchAnalyticsLiveValues() {
  if (!analyticsState.liveRun) return;

  updateAnalyticsLiveDuration();

  const liveRun = analyticsState.liveRun;
  const overall = getAnalyticsOverallSnapshot();
  const workflowAnalytics = getAnalyticsWorkflowSnapshot();
  const summary = overall.summary || {};
  const workflowSummary = (overall.perWorkflow || [])
    .find(item => item.workflowId === liveRun.workflowId)?.summary || null;
  const selectedWorkflowSummary = workflowAnalytics?.summary || null;

  patchAnalyticsBoundText('overall-total-runs', formatAnalyticsNumber(summary.totalRuns));
  patchAnalyticsBoundText('overall-total-actions', formatAnalyticsNumber(summary.totalActions));
  patchAnalyticsBoundText('overall-total-duration', formatAnalyticsDuration(summary.totalDurationMs));
  patchAnalyticsBoundText('overall-average-duration', formatAnalyticsDuration(summary.averageDurationMs));
  patchAnalyticsBoundText('overall-average-duration-meta', `${formatAnalyticsDuration(summary.averageDurationMs)} avg run`);
  patchAnalyticsBoundText('overall-longest-duration', formatAnalyticsDuration(summary.longestDurationMs));
  patchAnalyticsBoundText('overall-shortest-duration-meta', `${formatAnalyticsDuration(summary.shortestDurationMs)} shortest`);
  patchAnalyticsBoundText('overall-actions', formatAnalyticsNumber(summary.totalActions));
  patchAnalyticsBoundText('overall-average-actions-meta', `${formatAnalyticsNumber(summary.averageActions, 1)} avg/run`);

  if (workflowSummary) {
    const workflowSelector = `[data-analytics-workflow-id="${analyticsEscapeSelectorAttr(liveRun.workflowId)}"]`;
    patchAnalyticsText(`${workflowSelector}[data-analytics-bind="workflow-total-duration"]`, formatAnalyticsDuration(workflowSummary.totalDurationMs));
    patchAnalyticsText(`${workflowSelector}[data-analytics-bind="workflow-average-duration"]`, formatAnalyticsDuration(workflowSummary.averageDurationMs));
  }

  if (analyticsState.selectedWorkflowId === liveRun.workflowId && selectedWorkflowSummary) {
    patchAnalyticsBoundText('detail-total-runs', formatAnalyticsNumber(selectedWorkflowSummary.totalRuns));
    patchAnalyticsBoundText('detail-total-duration', formatAnalyticsDuration(selectedWorkflowSummary.totalDurationMs));
    patchAnalyticsBoundText('detail-average-duration-meta', `${formatAnalyticsDuration(selectedWorkflowSummary.averageDurationMs)} avg`);
    patchAnalyticsBoundText('detail-shortest-duration', formatAnalyticsDuration(selectedWorkflowSummary.shortestDurationMs));
    patchAnalyticsBoundText('detail-longest-duration-meta', `${formatAnalyticsDuration(selectedWorkflowSummary.longestDurationMs)} slowest`);
  }

  const duration = formatAnalyticsDuration(liveRun.durationMs);
  patchAnalyticsLiveFieldText(liveRun.id, 'duration', duration);
  patchAnalyticsLiveFieldText(liveRun.id, 'loops', formatAnalyticsLoops(liveRun));
  patchAnalyticsLiveFieldText(liveRun.id, 'actions', formatAnalyticsNumber(liveRun.actions || 0));
  patchAnalyticsLiveFieldAttribute(liveRun.id, 'duration-bar', 'data-duration-ms', String(Number(liveRun.durationMs) || 0));
  patchAnalyticsLiveFieldAttribute(liveRun.id, 'activity-bar', 'data-duration-ms', String(Number(liveRun.durationMs) || 0));
  patchAnalyticsLiveFieldAttribute(liveRun.id, 'activity-bar', 'title', `${formatAnalyticsStatus(liveRun.status)} Â· ${duration}`);
  patchAnalyticsScaledBars('[data-analytics-field="duration-bar"]', 'width', 4);
  patchAnalyticsScaledBars('[data-analytics-field="activity-bar"]', 'height', 8, true);
}

function patchAnalyticsBoundText(bindName, value) {
  patchAnalyticsText(`[data-analytics-bind="${analyticsEscapeSelectorAttr(bindName)}"]`, value);
}

function patchAnalyticsLiveFieldText(liveRunId, field, value) {
  patchAnalyticsText(analyticsLiveFieldSelector(liveRunId, field), value);
}

function patchAnalyticsLiveFieldAttribute(liveRunId, field, attr, value) {
  patchAnalyticsAttribute(analyticsLiveFieldSelector(liveRunId, field), attr, value);
}

function patchAnalyticsText(selector, value) {
  document.querySelectorAll(selector).forEach(element => {
    const next = value === null || value === undefined ? '' : String(value);
    if (element.textContent !== next) {
      element.textContent = next;
    }
  });
}

function patchAnalyticsAttribute(selector, attr, value) {
  document.querySelectorAll(selector).forEach(element => {
    const next = value === null || value === undefined ? '' : String(value);
    if (element.getAttribute(attr) !== next) {
      element.setAttribute(attr, next);
    }
  });
}

function patchAnalyticsScaledBars(selector, styleProp, minPercent, round = false) {
  const bars = [...document.querySelectorAll(selector)];
  if (!bars.length) return;

  const max = Math.max(...bars.map(bar => Number(bar.dataset.durationMs) || 0), 1);
  bars.forEach(bar => {
    const duration = Number(bar.dataset.durationMs) || 0;
    const raw = Math.max(minPercent, (duration / max) * 100);
    const next = `${round ? Math.round(raw) : raw}%`;
    if (bar.style[styleProp] !== next) {
      bar.style[styleProp] = next;
    }
  });
}

function getCurrentAnalyticsLiveRun(overall) {
  if (!analyticsState.liveRun) return null;
  updateAnalyticsLiveDuration();

  if (isPersistedAnalyticsRunPresent(overall, analyticsState.liveRun)) {
    analyticsState.liveRun = null;
    stopAnalyticsLiveTicker();
    return null;
  }

  return { ...analyticsState.liveRun };
}

function isPersistedAnalyticsRunPresent(overall, liveRun) {
  if (!isTerminalAnalyticsStatus(liveRun?.status)) return false;
  const runs = overall?.recentRuns || [];
  return runs.some(run => {
    const startedAtMs = +new Date(run.startedAt || 0);
    return run.workflowId === liveRun.workflowId
      && normalizeAnalyticsStatus(run.status) === liveRun.status
      && Math.abs(startedAtMs - liveRun.startedAtMs) < 5000;
  });
}

function mergeLiveRunIntoOverall(overall = {}) {
  const liveRun = getCurrentAnalyticsLiveRun(overall);
  if (!liveRun) return overall || {};

  const perWorkflow = [...(overall.perWorkflow || [])];
  const existingIndex = perWorkflow.findIndex(item => item.workflowId === liveRun.workflowId);
  if (existingIndex >= 0) {
    perWorkflow[existingIndex] = {
      ...perWorkflow[existingIndex],
      summary: addAnalyticsRunToSummary(perWorkflow[existingIndex].summary, liveRun)
    };
  } else {
    perWorkflow.unshift({
      workflowId: liveRun.workflowId,
      workflowName: liveRun.workflowName,
      summary: addAnalyticsRunToSummary(createEmptyAnalyticsSummary(), liveRun)
    });
  }

  perWorkflow.sort((a, b) => (b.summary?.totalRuns || 0) - (a.summary?.totalRuns || 0));

  return {
    ...overall,
    summary: addAnalyticsRunToSummary(overall.summary, liveRun),
    workflowsRun: perWorkflow.length,
    perWorkflow,
    recentRuns: [liveRun, ...(overall.recentRuns || [])].slice(0, 25)
  };
}

function mergeLiveRunIntoWorkflowAnalytics(workflowAnalytics) {
  const liveRun = getCurrentAnalyticsLiveRun();
  if (!liveRun || analyticsState.selectedWorkflowId !== liveRun.workflowId) return workflowAnalytics;

  const runs = workflowAnalytics?.runs || [];
  const alreadyPersisted = runs.some(run => {
    const startedAtMs = +new Date(run.startedAt || 0);
    return run.workflowId === liveRun.workflowId
      && normalizeAnalyticsStatus(run.status) === liveRun.status
      && Math.abs(startedAtMs - liveRun.startedAtMs) < 5000;
  });
  if (alreadyPersisted) return workflowAnalytics;

  return {
    workflow: workflowAnalytics?.workflow || (state.workflows || []).find(workflow => workflow.id === liveRun.workflowId) || null,
    summary: addAnalyticsRunToSummary(workflowAnalytics?.summary, liveRun),
    runs: [liveRun, ...runs]
  };
}

function createEmptyAnalyticsSummary() {
  return {
    totalRuns: 0,
    completedRuns: 0,
    stoppedRuns: 0,
    errorRuns: 0,
    runningRuns: 0,
    pausedRuns: 0,
    dryRuns: 0,
    successRate: 0,
    totalDurationMs: 0,
    averageDurationMs: 0,
    shortestDurationMs: 0,
    longestDurationMs: 0,
    totalActions: 0,
    averageActions: 0,
    totalCompletedLoops: 0,
    averageCompletedLoops: 0,
    firstRunAt: null,
    lastRunAt: null,
    lastStatus: null
  };
}

function addAnalyticsRunToSummary(summary = {}, run = {}) {
  const base = { ...createEmptyAnalyticsSummary(), ...(summary || {}) };
  const status = normalizeAnalyticsStatus(run.status);
  const totalRuns = (Number(base.totalRuns) || 0) + 1;
  const durationMs = Math.max(0, Number(run.durationMs) || 0);
  const totalDurationMs = (Number(base.totalDurationMs) || 0) + durationMs;
  const totalActions = (Number(base.totalActions) || 0) + (Number(run.actions) || 0);
  const completedLoops = Number(run.completedLoops);
  const totalCompletedLoops = (Number(base.totalCompletedLoops) || 0)
    + (Number.isFinite(completedLoops) ? completedLoops : 0);
  const previousShortest = Number(base.shortestDurationMs) || 0;
  const firstRunAt = pickEarlierDate(base.firstRunAt, run.startedAt);
  const lastRunAt = pickLaterDate(base.lastRunAt, run.startedAt);
  const runIsLast = lastRunAt === run.startedAt || !base.lastRunAt;

  return {
    ...base,
    totalRuns,
    completedRuns: (Number(base.completedRuns) || 0) + (status === 'completed' ? 1 : 0),
    stoppedRuns: 0,
    errorRuns: (Number(base.errorRuns) || 0) + (status === 'error' ? 1 : 0),
    runningRuns: (Number(base.runningRuns) || 0) + (status === 'running' ? 1 : 0),
    pausedRuns: (Number(base.pausedRuns) || 0) + (status === 'paused' ? 1 : 0),
    dryRuns: (Number(base.dryRuns) || 0) + (run.dryRun ? 1 : 0),
    successRate: totalRuns ? ((Number(base.completedRuns) || 0) + (status === 'completed' ? 1 : 0)) / totalRuns : 0,
    totalDurationMs,
    averageDurationMs: totalRuns ? totalDurationMs / totalRuns : 0,
    shortestDurationMs: previousShortest ? Math.min(previousShortest, durationMs) : durationMs,
    longestDurationMs: Math.max(Number(base.longestDurationMs) || 0, durationMs),
    totalActions,
    averageActions: totalRuns ? totalActions / totalRuns : 0,
    totalCompletedLoops,
    averageCompletedLoops: totalRuns ? totalCompletedLoops / totalRuns : 0,
    firstRunAt,
    lastRunAt,
    lastStatus: runIsLast ? status : normalizeAnalyticsStatus(base.lastStatus)
  };
}

function pickEarlierDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return +new Date(a) <= +new Date(b) ? a : b;
}

function pickLaterDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return +new Date(a) >= +new Date(b) ? a : b;
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

  const html = options.length
    ? options.map(option => `
      <option value="${analyticsEscapeHtml(option.id)}" ${option.id === analyticsState.selectedWorkflowId ? 'selected' : ''}>
        ${analyticsEscapeHtml(option.name)}
      </option>
    `).join('')
    : '<option value="">No workflows</option>';

  setAnalyticsSectionHtml('workflowSelect', select, html);
  if ((analyticsState.selectedWorkflowId || '') !== select.value) {
    select.value = analyticsState.selectedWorkflowId || '';
  }
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
        <div class="analytics-hero-value" data-analytics-bind="overall-total-runs">${formatAnalyticsNumber(totalRuns)}</div>
        <div class="analytics-hero-substats">
          <span><strong>${formatAnalyticsNumber(overall.workflowsRun || 0)}</strong> workflows</span>
          <span class="analytics-dot-sep"></span>
          <span><strong data-analytics-bind="overall-total-actions">${formatAnalyticsNumber(summary.totalActions)}</strong> actions</span>
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
    { icon: 'clock', accent: '#22d3ee', label: 'Time Automated', value: formatAnalyticsDuration(summary.totalDurationMs), meta: `${formatAnalyticsDuration(summary.averageDurationMs)} avg run`, valueBind: 'overall-total-duration', metaBind: 'overall-average-duration-meta' },
    { icon: 'gauge', accent: '#60a5fa', label: 'Avg Duration', value: formatAnalyticsDuration(summary.averageDurationMs), meta: `across ${formatAnalyticsNumber(totalRuns)} runs`, valueBind: 'overall-average-duration' },
    { icon: 'gauge', accent: '#a78bfa', label: 'Longest Run', value: formatAnalyticsDuration(summary.longestDurationMs), meta: `${formatAnalyticsDuration(summary.shortestDurationMs)} shortest`, valueBind: 'overall-longest-duration', metaBind: 'overall-shortest-duration-meta' },
    { icon: 'layers', accent: '#818cf8', label: 'Actions', value: formatAnalyticsNumber(summary.totalActions), meta: `${formatAnalyticsNumber(summary.averageActions, 1)} avg/run`, valueBind: 'overall-actions', metaBind: 'overall-average-actions-meta' },
    { icon: 'calendar', accent: '#fbbf24', label: 'Last Run', value: formatAnalyticsDate(summary.lastRunAt, true), meta: summary.lastStatus ? formatAnalyticsStatus(summary.lastStatus) : 'No runs' }
  ];

  const tiles = cards.map(card => `
    <div class="analytics-metric" style="--metric-accent: ${card.accent}">
      <div class="analytics-metric-top">
        <span class="analytics-metric-icon">${analyticsIcon(card.icon)}</span>
        <span class="analytics-metric-label">${analyticsEscapeHtml(card.label)}</span>
      </div>
      <div class="analytics-metric-value"${card.valueBind ? ` data-analytics-bind="${card.valueBind}"` : ''}>${analyticsEscapeHtml(card.value)}</div>
      <div class="analytics-metric-meta"${card.metaBind ? ` data-analytics-bind="${card.metaBind}"` : ''}>${analyticsEscapeHtml(card.meta)}</div>
    </div>
  `).join('');

  setAnalyticsSectionHtml('summaryGrid', analyticsElements.summaryGrid, hero + tiles);
}

function renderWorkflowPerformanceTable(overall) {
  const rows = overall.perWorkflow || [];
  if (!rows.length) {
    setAnalyticsSectionHtml('workflowTable', analyticsElements.workflowTable, '<div class="analytics-empty">No workflow runs yet</div>');
    return;
  }

  const html = `
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
      const status = normalizeAnalyticsStatus(summary.lastStatus || 'idle');
      return `
        <button class="analytics-table-row workflow-performance-row ${active ? 'active' : ''}" data-workflow-id="${analyticsEscapeHtml(item.workflowId)}">
          <div class="analytics-table-primary">
            <span class="analytics-status-dot ${analyticsEscapeHtml(status)}"></span>
            <span class="analytics-table-primary-text">${analyticsEscapeHtml(item.workflowName || 'Untitled Workflow')}</span>
          </div>
          <div class="analytics-num">${formatAnalyticsNumber(summary.totalRuns)}</div>
          <div class="analytics-num" data-analytics-workflow-id="${analyticsEscapeHtml(item.workflowId)}" data-analytics-bind="workflow-total-duration">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
          <div class="analytics-num" data-analytics-workflow-id="${analyticsEscapeHtml(item.workflowId)}" data-analytics-bind="workflow-average-duration">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))}</div>
          <div class="analytics-success-cell">
            <span class="analytics-meter"><span style="width:${Math.round(rate * 100)}%"></span></span>
            <span class="analytics-num">${analyticsEscapeHtml(formatAnalyticsPercent(summary.successRate))}</span>
          </div>
          <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(summary.lastRunAt, true))}</div>
        </button>
      `;
    }).join('')}
  `;

  if (!setAnalyticsSectionHtml('workflowTable', analyticsElements.workflowTable, html)) return;

  analyticsElements.workflowTable.querySelectorAll('[data-workflow-id]').forEach(row => {
    row.addEventListener('click', () => {
      analyticsState.selectedWorkflowId = row.dataset.workflowId;
      renderAnalyticsDashboard({ showLoading: false });
    });
  });
}

function renderWorkflowDetail(analytics) {
  if (!analytics || !analytics.summary) {
    setAnalyticsSectionHtml('workflowDetail', analyticsElements.workflowDetail, '<div class="analytics-empty">Select a workflow above to see its run history.</div>');
    return;
  }

  const summary = analytics.summary;
  const runs = analytics.runs || [];
  const workflowName = analytics.workflow?.name || runs[0]?.workflowName || 'Deleted Workflow';
  const maxDuration = Math.max(...runs.map(run => Number(run.durationMs) || 0), 1);
  const lastStatus = normalizeAnalyticsStatus(summary.lastStatus || 'idle');
  const activeRuns = (Number(summary.runningRuns) || 0) + (Number(summary.pausedRuns) || 0);
  const completionMeta = activeRuns
    ? `${formatAnalyticsNumber(activeRuns)} active, ${formatAnalyticsNumber(summary.errorRuns)} errors`
    : `${formatAnalyticsNumber(summary.errorRuns)} errors`;

  const html = `
    <div class="workflow-analytics-title">
      <h2>${analyticsEscapeHtml(workflowName)}</h2>
      <span class="analytics-status ${analyticsEscapeHtml(lastStatus)}">
        <span class="analytics-status-dot ${analyticsEscapeHtml(lastStatus)}"></span>
        ${analyticsEscapeHtml(lastStatus ? formatAnalyticsStatus(lastStatus) : 'No runs')}
      </span>
    </div>

    <div class="analytics-detail-grid">
      <div class="analytics-metric" style="--metric-accent:#22d3ee">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('runs')}</span>
          <span class="analytics-metric-label">Runs</span>
        </div>
        <div class="analytics-metric-value" data-analytics-bind="detail-total-runs">${formatAnalyticsNumber(summary.totalRuns)}</div>
        <div class="analytics-metric-meta">${formatAnalyticsNumber(summary.dryRuns)} dry runs</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#60a5fa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('clock')}</span>
          <span class="analytics-metric-label">Total Time</span>
        </div>
        <div class="analytics-metric-value" data-analytics-bind="detail-total-duration">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
        <div class="analytics-metric-meta" data-analytics-bind="detail-average-duration-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))} avg</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#a78bfa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('gauge')}</span>
          <span class="analytics-metric-label">Fastest</span>
        </div>
        <div class="analytics-metric-value" data-analytics-bind="detail-shortest-duration">${analyticsEscapeHtml(formatAnalyticsDuration(summary.shortestDurationMs))}</div>
        <div class="analytics-metric-meta" data-analytics-bind="detail-longest-duration-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.longestDurationMs))} slowest</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#34d399">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('bolt')}</span>
          <span class="analytics-metric-label">Completed</span>
        </div>
        <div class="analytics-metric-value">${formatAnalyticsNumber(summary.completedRuns)}</div>
        <div class="analytics-metric-meta">${analyticsEscapeHtml(completionMeta)}</div>
      </div>
    </div>

    <div class="analytics-duration-list">
      <div class="analytics-duration-caption">Run durations</div>
      ${runs.length ? runs.slice(0, 12).map(run => `
        <div class="analytics-duration-row"${analyticsLiveAttrs(run)}>
          ${(() => {
            const status = normalizeAnalyticsStatus(run.status);
            return `
          <div class="analytics-duration-info">
            <span>${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</span>
            <span class="analytics-status ${analyticsEscapeHtml(status)}">
              <span class="analytics-status-dot ${analyticsEscapeHtml(status)}"></span>
              ${analyticsEscapeHtml(formatAnalyticsStatus(status))}
            </span>
          </div>
          <div class="analytics-duration-bar">
            <span class="status-${analyticsEscapeHtml(status || 'idle')}" data-analytics-field="duration-bar" data-duration-ms="${Number(run.durationMs) || 0}"${analyticsLiveFieldAttrs(run, 'duration-bar')} style="width: ${Math.max(4, ((Number(run.durationMs) || 0) / maxDuration) * 100)}%"></span>
          </div>
            `;
          })()}
          <div class="analytics-duration-value"${analyticsLiveFieldAttrs(run, 'duration')}>${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        </div>
      `).join('') : '<div class="analytics-empty">No runs recorded</div>'}
    </div>

    ${renderRunLog(runs)}
  `;

  setAnalyticsSectionHtml('workflowDetail', analyticsElements.workflowDetail, html);
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
        <div class="analytics-table-row run-log-row"${analyticsLiveAttrs(run)}>
          ${(() => {
            const status = normalizeAnalyticsStatus(run.status);
            return `
          <div class="analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</div>
          <div><span class="analytics-status ${analyticsEscapeHtml(status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(status))}</span></div>
            `;
          })()}
          <div class="analytics-num"${analyticsLiveFieldAttrs(run, 'duration')}>${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
          <div class="analytics-num"${analyticsLiveFieldAttrs(run, 'loops')}>${analyticsEscapeHtml(formatAnalyticsLoops(run))}</div>
          <div class="analytics-num"${analyticsLiveFieldAttrs(run, 'actions')}>${formatAnalyticsNumber(run.actions || 0)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentRuns(runs) {
  if (!runs.length) {
    setAnalyticsSectionHtml('recentRuns', analyticsElements.recentRuns, '<div class="analytics-empty">No workflow runs yet</div>');
    return;
  }

  const html = `
    <div class="analytics-table-row analytics-table-head recent-run-row">
      <div>Workflow</div>
      <div>Status</div>
      <div>Duration</div>
      <div>Started</div>
    </div>
    ${runs.map(run => `
      <button class="analytics-table-row recent-run-row" data-workflow-id="${analyticsEscapeHtml(run.workflowId)}"${analyticsLiveAttrs(run)}>
        ${(() => {
          const status = normalizeAnalyticsStatus(run.status || 'idle');
          return `
        <div class="analytics-table-primary">
          <span class="analytics-status-dot ${analyticsEscapeHtml(status)}"></span>
          <span class="analytics-table-primary-text">${analyticsEscapeHtml(run.workflowName || 'Untitled Workflow')}</span>
        </div>
        <div><span class="analytics-status ${analyticsEscapeHtml(status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(status))}</span></div>
          `;
        })()}
        <div class="analytics-num"${analyticsLiveFieldAttrs(run, 'duration')}>${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt, true))}</div>
      </button>
    `).join('')}
  `;

  if (!setAnalyticsSectionHtml('recentRuns', analyticsElements.recentRuns, html)) return;

  analyticsElements.recentRuns.querySelectorAll('[data-workflow-id]').forEach(row => {
    row.addEventListener('click', () => {
      analyticsState.selectedWorkflowId = row.dataset.workflowId;
      renderAnalyticsDashboard({ showLoading: false });
    });
  });
}

/* ---------- Visualization helpers ---------- */

// A multi-segment donut showing historical success plus live running/paused state.
function renderOutcomeDonut(summary) {
  const total = Number(summary.totalRuns) || 0;
  const completed = Number(summary.completedRuns) || 0;
  const errored = Number(summary.errorRuns) || 0;
  const running = Number(summary.runningRuns) || 0;
  const paused = Number(summary.pausedRuns) || 0;
  const other = Math.max(0, total - completed - errored - running - paused);
  const completionPct = total ? Math.round((completed / total) * 100) : 0;

  // r chosen so circumference ≈ 100, letting stroke-dasharray act as a percentage.
  const segments = [
    { count: completed, color: '#34d399' },
    { count: running, color: '#38bdf8' },
    { count: paused, color: '#fbbf24' },
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
    { label: 'Running', cls: 'running', count: Number(summary.runningRuns) || 0 },
    { label: 'Paused', cls: 'paused', count: Number(summary.pausedRuns) || 0 },
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
    const status = normalizeAnalyticsStatus(run.status || 'idle');
    const title = `${formatAnalyticsStatus(status)} · ${formatAnalyticsDuration(run.durationMs)}`;
    return `<span class="analytics-bar status-${analyticsEscapeHtml(status)}" data-analytics-field="activity-bar" data-duration-ms="${Number(run.durationMs) || 0}"${analyticsLiveFieldAttrs(run, 'activity-bar')} style="height:${h}%" title="${analyticsEscapeHtml(title)}"></span>`;
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

function analyticsLiveAttrs(run) {
  if (!run?.isLive || !run.id) return '';
  return ` data-live-run-id="${analyticsEscapeHtml(run.id)}"`;
}

function analyticsLiveFieldAttrs(run, field) {
  if (!run?.isLive || !run.id) return '';
  return ` data-live-run-id="${analyticsEscapeHtml(run.id)}" data-live-field="${analyticsEscapeHtml(field)}"`;
}

function analyticsLiveFieldSelector(liveRunId, field) {
  return `[data-live-run-id="${analyticsEscapeSelectorAttr(liveRunId)}"][data-live-field="${analyticsEscapeSelectorAttr(field)}"]`;
}

function analyticsEscapeSelectorAttr(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
  const normalized = normalizeAnalyticsStatus(status);
  const labels = {
    completed: 'Completed',
    stopped: 'Completed',
    error: 'Error',
    running: 'Running',
    paused: 'Paused',
    idle: 'No runs'
  };
  return labels[normalized] || normalized || 'Unknown';
}

function normalizeAnalyticsStatus(status) {
  if (status === 'stopped') return 'completed';
  return status || 'idle';
}

function isTerminalAnalyticsStatus(status) {
  const normalized = normalizeAnalyticsStatus(status);
  return normalized === 'completed' || normalized === 'error';
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

async function initAIComposer() {
  if (!aiGenerateBtn || !aiGameSelect || !aiModelSelect) return;

  initAIComposerVisibility();
  syncAIComposerFromSettings();
  await loadAISupportedGames();

  aiGameSelect.addEventListener('change', updateAIContextPill);
  aiGenerateBtn.addEventListener('click', handleAIGenerateWorkflow);
  toggleAIBtn?.addEventListener('click', () => toggleAIComposerVisibility());
  aiPromptInput?.addEventListener('keydown', async (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      await handleAIGenerateWorkflow();
    }
  });

  window.addEventListener('settings:updated', () => {
    syncAIComposerFromSettings();
  });
}

function initAIComposerVisibility() {
  const storedValue = safeGetLocalStorage('editor.aiComposerCollapsed');
  const shouldCollapse = storedValue === null ? true : storedValue === 'true';
  toggleAIComposerVisibility(!shouldCollapse, false);
}

function toggleAIComposerVisibility(forceExpanded, persist = true) {
  if (!aiComposer) return;
  const expanded = typeof forceExpanded === 'boolean'
    ? forceExpanded
    : aiComposer.classList.contains('collapsed');

  aiComposer.classList.toggle('collapsed', !expanded);
  if (toggleAIBtn) {
    toggleAIBtn.classList.toggle('active', expanded);
    toggleAIBtn.setAttribute('aria-expanded', String(expanded));
    toggleAIBtn.title = expanded ? 'Hide AI Draft Panel' : 'Show AI Draft Panel';
  }

  if (persist) {
    safeSetLocalStorage('editor.aiComposerCollapsed', String(!expanded));
  }
}

async function loadAISupportedGames() {
  try {
    const supported = await window.workflowAPI.getAISupportedGames();
    if (!Array.isArray(supported) || supported.length === 0) {
      updateAIContextPill();
      return;
    }

    const existing = new Set(Array.from(aiGameSelect.options).map((option) => option.value));
    supported.forEach((game) => {
      if (!game?.id || !game?.name || existing.has(game.id)) return;
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      aiGameSelect.appendChild(option);
    });
  } catch (error) {
    console.warn('Failed to load AI supported games:', error);
  } finally {
    updateAIContextPill();
  }
}

function syncAIComposerFromSettings() {
  const preferredModel = state.settings?.ai?.preferredModel || 'codex-5.3';
  if (aiModelSelect) {
    aiModelSelect.value = preferredModel;
  }
}

function updateAIContextPill() {
  if (!aiContextPill || !aiGameSelect) return;
  const selectedText = aiGameSelect.options[aiGameSelect.selectedIndex]?.textContent || 'Generic context';
  aiContextPill.textContent = selectedText;
}

function safeGetLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage persistence errors (private mode, disabled storage, etc.)
  }
}

function setAIGeneratingState(isGenerating, message) {
  editorState.isAIGenerating = isGenerating;
  if (aiGenerateBtn) {
    if (!aiGenerateBtn.dataset.defaultHtml) {
      aiGenerateBtn.dataset.defaultHtml = aiGenerateBtn.innerHTML;
    }
    aiGenerateBtn.disabled = isGenerating;
    aiGenerateBtn.innerHTML = isGenerating
      ? 'Generating...'
      : aiGenerateBtn.dataset.defaultHtml;
  }
  if (aiComposerMeta) {
    aiComposerMeta.textContent = message || '';
  }
}

async function handleAIGenerateWorkflow() {
  if (editorState.isAIGenerating) return;
  if (!state.currentWorkflow) {
    showToast('warning', 'No Workflow', 'Create or open a workflow first.');
    return;
  }

  const prompt = aiPromptInput?.value?.trim() || '';
  if (!prompt) {
    showToast('warning', 'Prompt Required', 'Describe the workflow you want to generate.');
    return;
  }

  setAIGeneratingState(true, 'Generating...');
  let result;
  try {
    result = await window.workflowAPI.generateWorkflowWithAI({
      prompt,
      gameId: aiGameSelect?.value || 'generic',
      preferredModel: aiModelSelect?.value || state.settings?.ai?.preferredModel || 'codex-5.3',
      applyMode: aiApplyModeSelect?.value || 'replace',
      currentWorkflow: state.currentWorkflow
    });
  } catch (error) {
    console.error('[AI] Generation IPC failed:', error);
    showToast('error', 'AI Error', error.message || 'Failed to contact AI service.');
    setAIGeneratingState(false);
    return;
  }

  setAIGeneratingState(false);

  if (!result || !result.success) {
    showToast('error', 'AI Error', result?.error || 'No response from AI service.');
    return;
  }

  if (result.data?.action === 'clarify') {
    const clarifyingText = result.data.clarification || 'Please provide more detail.';
    showModal('AI Needs Clarification', `<p>${escapeHtml(clarifyingText)}</p>`, [
      { label: 'Close', class: 'btn-secondary' }
    ]);
    return;
  }

  applyAIGeneratedWorkflow(result.data, result.meta);
}

function applyAIGeneratedWorkflow(payload, meta = {}) {
  const workflowPatch = payload?.workflow || {};
  const actions = Array.isArray(workflowPatch.actions) ? workflowPatch.actions : [];
  if (!actions.length) {
    showToast('warning', 'No Actions', 'AI response did not include any actions.');
    return;
  }

  const actionMode = aiApplyModeSelect?.value || 'replace';
  if (actionMode === 'append') {
    state.currentWorkflow.actions = [...(state.currentWorkflow.actions || []), ...actions];
  } else {
    state.currentWorkflow.actions = actions;
  }

  if (workflowPatch.name) {
    state.currentWorkflow.name = workflowPatch.name;
    workflowNameInput.value = workflowPatch.name;
  }
  if (workflowPatch.description) {
    state.currentWorkflow.description = workflowPatch.description;
  }
  if (typeof workflowPatch.infiniteLoop === 'boolean') {
    state.currentWorkflow.infiniteLoop = workflowPatch.infiniteLoop;
    loopInfiniteInput.checked = workflowPatch.infiniteLoop;
    loopCountInput.disabled = workflowPatch.infiniteLoop;
  }
  if (workflowPatch.loopCount) {
    state.currentWorkflow.loopCount = workflowPatch.loopCount;
    loopCountInput.value = workflowPatch.loopCount;
  }
  if (workflowPatch.loopDelay) {
    state.currentWorkflow.loopDelay = workflowPatch.loopDelay;
    setDurationRangeMs('loop-delay-min', 'loop-delay-max', workflowPatch.loopDelay.min, workflowPatch.loopDelay.max);
  }

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();

  const modelLabel = meta?.model ? `Model: ${meta.model}` : 'AI draft generated';
  const summary = payload?.explanation || `${actions.length} action${actions.length !== 1 ? 's' : ''} generated`;
  showToast('success', 'AI Draft Applied', `${summary} · ${modelLabel}`);
}


/* Editor config — conditional + loop actions (ported from WIP). Shares the editor global scope. */

async function renderConditionalConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.condition = normalizeConditionalBranchCondition(action.condition);
  action.elseCondition = normalizeConditionalBranchCondition(action.elseCondition);
  action.useElseCondition = !!action.useElseCondition;
  action.waitUntilEitherCondition = !!action.waitUntilEitherCondition;
  action.pollInterval = Math.max(100, parseInt(action.pollInterval, 10) || 500);
  action.thenActions = action.thenActions || [];
  action.elseActions = action.elseActions || [];

  configBody.innerHTML = nameFieldHtml + `
    ${renderConditionalConditionFields('config-condition', 'If condition', action.condition)}
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-use-else-condition" ${action.useElseCondition ? 'checked' : ''}>
        Use a separate else condition
      </label>
      <p class="config-field-hint">Lets the else branch watch for its own image or pixel instead of firing whenever the if condition is false.</p>
    </div>
    <div id="else-condition-section" ${!action.useElseCondition ? 'style="display:none"' : ''}>
      ${renderConditionalConditionFields('config-else-condition', 'Else condition', action.elseCondition)}
      <div class="config-field">
        <label class="checkbox-label">
          <input type="checkbox" id="config-wait-until-either" ${action.waitUntilEitherCondition ? 'checked' : ''}>
          Keep checking until either branch matches
        </label>
        <p class="config-field-hint">Best for looping between two image checks. If both match on the same pass, the Then branch wins.</p>
      </div>
      <div class="config-field" id="conditional-poll-interval-field" ${!action.waitUntilEitherCondition ? 'style="display:none"' : ''}>
        <label>Check interval</label>
        ${durationFieldHTML({ id: 'config-conditional-poll-interval', valueMs: action.pollInterval ?? '', placeholder: '500' })}
        <p class="config-field-hint">How often to re-check both conditions while waiting.</p>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Then (if true): <span id="then-actions-count">${action.thenActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-then">Edit</button>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>${action.useElseCondition ? 'Else (if else condition matches)' : 'Else (if false)'}: <span id="else-actions-count">${action.elseActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-else">Edit</button>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  await bindConditionalConditionEditor('config-condition', action.condition, save);
  if (action.useElseCondition) {
    await bindConditionalConditionEditor('config-else-condition', action.elseCondition, save);
  }

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-use-else-condition').addEventListener('change', (e) => {
    action.useElseCondition = e.target.checked;
    if (!action.useElseCondition) {
      action.waitUntilEitherCondition = false;
    }
    save();
    renderConditionalConfig(configBody, action, index, nameFieldHtml, save);
  });

  document.getElementById('config-wait-until-either')?.addEventListener('change', (e) => {
    action.waitUntilEitherCondition = e.target.checked;
    document.getElementById('conditional-poll-interval-field').style.display = e.target.checked ? '' : 'none';
    save();
  });

  document.getElementById('config-conditional-poll-interval')?.addEventListener('change', () => {
    const ms = readDurationMs('config-conditional-poll-interval');
    action.pollInterval = Math.max(100, Math.min(30000, ms ?? 500));
    save();
  });

  document.getElementById('btn-edit-then').addEventListener('click', () => {
    openNestedActionsEditor(action, 'thenActions', 'Then Actions', index);
  });

  document.getElementById('btn-edit-else').addEventListener('click', () => {
    openNestedActionsEditor(action, 'elseActions', 'Else Actions', index);
  });

  document.getElementById('config-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Render Loop action config
 */
function renderLoopConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.actions = action.actions || [];
  action.delay = action.delay || { min: 500, max: 1000 };

  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-infinite" ${action.infinite ? 'checked' : ''}>
        Infinite loop
      </label>
      <p class="config-field-hint">Loop forever until the workflow is stopped</p>
    </div>
    <div class="config-field" id="loop-count-field" ${action.infinite ? 'style="display:none"' : ''}>
      <label>Number of Iterations</label>
      <input type="number" id="config-loop-count" min="1" max="10000" value="${action.count || 3}">
    </div>
    <div class="config-field">
      <label>Delay Between Iterations</label>
      ${durationRangeFieldHTML({ minId: 'config-loop-delay-min', maxId: 'config-loop-delay-max', minMs: action.delay.min || 500, maxMs: action.delay.max || 1000 })}
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Loop Actions: <span id="loop-actions-count">${action.actions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-loop-actions">Edit</button>
      </div>
      <p class="config-field-hint">These actions will repeat for each iteration</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-loop-infinite').addEventListener('change', (e) => {
    action.infinite = e.target.checked;
    document.getElementById('loop-count-field').style.display = e.target.checked ? 'none' : '';
    save();
  });

  document.getElementById('config-loop-count').addEventListener('change', (e) => {
    action.count = parseInt(e.target.value) || 3;
    save();
  });

  document.getElementById('config-loop-delay-min').addEventListener('change', () => {
    action.delay.min = readDurationMs('config-loop-delay-min') ?? 500;
    save();
  });

  document.getElementById('config-loop-delay-max').addEventListener('change', () => {
    action.delay.max = readDurationMs('config-loop-delay-max') ?? 1000;
    save();
  });

  document.getElementById('btn-edit-loop-actions').addEventListener('click', () => {
    openNestedActionsEditor(action, 'actions', 'Loop Actions', index);
  });

  document.getElementById('config-loop-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Render Image Detect action config
 */

/**
 * Open config editor for a single nested action (uses shared renderConfigFields)
 */
function openNestedActionConfig(action, nestedIndex, parentAction, actionsKey, parentTitle, parentIndex) {
  const meta = ACTION_TYPES[action.type] || { name: 'Action' };

  showModal(
    `Edit ${meta.name} (#${nestedIndex + 1} in ${parentTitle})`,
    `<div id="nested-config-body" class="nested-config-panel"></div>`,
    [
      { label: 'Back', class: 'btn-secondary', onClick: () => {
        updateAction(parentIndex, parentAction);
        setTimeout(() => openNestedActionsEditor(parentAction, actionsKey, parentTitle, parentIndex), 50);
      }, closeOnClick: true },
      { label: 'Done', primary: true, action: 'close', onClick: () => {
        updateAction(parentIndex, parentAction);
        updateNestedActionCounts(parentAction, actionsKey);
      }}
    ]
  );

  const configBody = document.getElementById('nested-config-body');
  if (!configBody) return;

  const save = () => updateAction(parentIndex, parentAction);
  renderConfigFields(action, parentIndex, configBody, save);
}

/**
 * Update the action counts displayed in the config panel for conditionals/loops
 */
function updateNestedActionCounts(parentAction, actionsKey) {
  const count = (parentAction[actionsKey] || []).length;

  // Map of actionsKey → possible element IDs that display the count
  const countElementIds = {
    thenActions: ['then-actions-count'],
    elseActions: ['else-actions-count'],
    actions: ['loop-actions-count', 'hold-actions-count']
  };

  const ids = countElementIds[actionsKey] || [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  }
}


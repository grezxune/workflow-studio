/**
 * Render inline children container for an action's branches.
 * Shared by loop, conditional, keyboard hold_and_act, and any future nested action types.
 *
 * **Nested Container Pattern**: Any action type that can contain sub-actions (loops,
 * conditionals, keyboard hold_and_act, and any future container action types) renders
 * its children inline in the workflow view. This is recursive — a loop inside a loop
 * inside a conditional will render all levels inline with proper indentation and full
 * drag/drop support at every depth. This is the standard, expected way to visualise
 * and interact with nested actions throughout Workflow Studio.
 *
 * Supports: drag/drop reorder within branch, drag from main sequence, drag new actions
 * from the palette, move-out to parent, edit, delete — all at arbitrary nesting depth.
 *
 * @param {Object}  action   - The parent action that owns the branches.
 * @param {number}  index    - Index of the parent action in the top-level actions array.
 * @param {Array}   branches - Array of { key, label, actions } branch descriptors.
 * @param {number}  [depth=0] - Current nesting depth (drives indentation).
 */
function renderInlineChildren(action, index, branches, depth) {
  if (typeof depth !== 'number') depth = 0;
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'inline-children';
  childrenContainer.dataset.depth = depth;

  branches.forEach(branch => {
    const branchEl = document.createElement('div');
    branchEl.className = 'inline-branch';

    const header = document.createElement('div');
    header.className = 'inline-branch-header';
    header.innerHTML = `
      <span class="inline-branch-label">${branch.label}</span>
      <span class="inline-branch-count">${branch.actions.length} action${branch.actions.length !== 1 ? 's' : ''}</span>
    `;
    branchEl.appendChild(header);

    const listEl = document.createElement('div');
    listEl.className = 'inline-branch-list';
    listEl.dataset.parentIndex = index;
    listEl.dataset.actionsKey = branch.key;

    if (branch.actions.length === 0) {
      listEl.innerHTML = '<div class="inline-empty">Drop actions here</div>';
    } else {
      let inlineDragIndex = null;
      let inlineDragAllowed = false;

      branch.actions.forEach((childAction, ci) => {
        const childEl = document.createElement('div');
        childEl.className = 'inline-child-item';
        childEl.draggable = true;
        childEl.dataset.childIndex = ci;
        childEl.innerHTML = `
          <span class="inline-child-handle" title="Drag to reorder">⋮⋮</span>
          <span class="inline-child-num">${ci + 1}</span>
          <span class="inline-child-name">${childAction.name ? escapeHtml(childAction.name) : (ACTION_TYPES[childAction.type]?.name || childAction.type)}</span>
          <span class="inline-child-summary">${getActionSummary(childAction)}</span>
          <div class="inline-child-buttons">
            <button class="btn btn-icon btn-sm inline-child-edit" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm inline-child-moveout" title="Move out to parent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm btn-danger inline-child-delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;

        // Drag handle
        const handle = childEl.querySelector('.inline-child-handle');
        handle.addEventListener('mousedown', () => { inlineDragAllowed = true; });

        childEl.addEventListener('dragstart', (e) => {
          if (!inlineDragAllowed) { e.preventDefault(); return; }
          e.stopPropagation();
          inlineDragAllowed = false;
          inlineDragIndex = ci;
          childEl.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'inline-child',
            childIndex: ci,
            branchKey: branch.key,
            parentIndex: index
          }));
          e.dataTransfer.effectAllowed = 'move';
        });

        childEl.addEventListener('dragend', (e) => {
          e.stopPropagation();
          childEl.classList.remove('dragging');
          inlineDragIndex = null;
          inlineDragAllowed = false;
          listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        childEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (inlineDragIndex !== null && ci !== inlineDragIndex) {
            childEl.classList.add('drag-over');
          }
        });

        childEl.addEventListener('dragleave', () => {
          childEl.classList.remove('drag-over');
        });

        childEl.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          childEl.classList.remove('drag-over');

          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            // Reorder within same branch
            if (data.type === 'inline-child' && data.branchKey === branch.key && data.parentIndex === index) {
              const arr = action[branch.key];
              const [moved] = arr.splice(data.childIndex, 1);
              arr.splice(ci, 0, moved);
              updateAction(index, action);
              markDirty();
              renderActionSequence();
              saveCurrentWorkflow();
              return;
            }
            // Move from main sequence into this branch at position ci
            if (data.type === 'main-action' && data.index !== index) {
              const mainActions = state.currentWorkflow.actions;
              const [movedAction] = mainActions.splice(data.index, 1);
              action[branch.key] = action[branch.key] || [];
              action[branch.key].splice(ci, 0, movedAction);
              const newIndex = data.index < index ? index - 1 : index;
              updateAction(newIndex, action);
              markDirty();
              renderActionSequence();
              saveCurrentWorkflow();
              return;
            }
          } catch (err) {}

          // New action from palette
          if (editorState.draggedAction?.isNew) {
            const newAction = createDefaultAction(editorState.draggedAction.type);
            action[branch.key] = action[branch.key] || [];
            action[branch.key].splice(ci, 0, newAction);
            updateAction(index, action);
            markDirty();
            renderActionSequence();
            saveCurrentWorkflow();
          }
        });

        // Edit button
        childEl.querySelector('.inline-child-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          openNestedActionConfig(childAction, ci, action, branch.key, branch.label, index);
        });

        // Move-out button
        childEl.querySelector('.inline-child-moveout').addEventListener('click', (e) => {
          e.stopPropagation();
          const branchArr = action[branch.key];
          if (!branchArr) return;
          const [movedAction] = branchArr.splice(ci, 1);
          state.currentWorkflow.actions.splice(index + 1, 0, movedAction);
          updateAction(index, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
        });

        // Delete button
        childEl.querySelector('.inline-child-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          action[branch.key].splice(ci, 1);
          updateAction(index, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
        });

        listEl.appendChild(childEl);

        // Recursive: if this child action itself has branches, render them nested
        const childBranches = getInlineBranches(childAction);
        if (childBranches.length > 0) {
          const nestedContainer = renderInlineChildren(childAction, index, childBranches, depth + 1);
          listEl.appendChild(nestedContainer);
        }
      });

      // Reset drag flag on mouseup
      document.addEventListener('mouseup', () => { inlineDragAllowed = false; });
    }

    branchEl.appendChild(listEl);
    childrenContainer.appendChild(branchEl);

    // Drag/drop onto inline branch list (from main sequence or palette)
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listEl.classList.add('drag-over');
    });

    listEl.addEventListener('dragleave', (e) => {
      if (!listEl.contains(e.relatedTarget)) {
        listEl.classList.remove('drag-over');
      }
    });

    listEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listEl.classList.remove('drag-over');

      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'main-action' && data.index !== index) {
          const mainActions = state.currentWorkflow.actions;
          const [movedAction] = mainActions.splice(data.index, 1);
          action[branch.key] = action[branch.key] || [];
          action[branch.key].push(movedAction);
          const newIndex = data.index < index ? index - 1 : index;
          updateAction(newIndex, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
          return;
        }
      } catch (err) {}

      // New action from palette dropped onto the branch list
      if (editorState.draggedAction?.isNew) {
        const newAction = createDefaultAction(editorState.draggedAction.type);
        action[branch.key] = action[branch.key] || [];
        action[branch.key].push(newAction);
        updateAction(index, action);
        markDirty();
        renderActionSequence();
        saveCurrentWorkflow();
      }
    });
  });

  return childrenContainer;
}


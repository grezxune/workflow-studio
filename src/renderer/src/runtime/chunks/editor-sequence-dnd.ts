/**
 * Get action color
 */
function getActionColor(type, alpha = 1) {
  const colors = {
    mouse_move: `rgba(34, 211, 238, ${alpha})`,
    mouse_click: `rgba(96, 165, 250, ${alpha})`,
    keyboard: `rgba(167, 139, 250, ${alpha})`,
    wait: `rgba(251, 191, 36, ${alpha})`,
    conditional: `rgba(52, 211, 153, ${alpha})`,
    loop: `rgba(251, 113, 133, ${alpha})`,
    image_detect: `rgba(129, 140, 248, ${alpha})`,
    pixel_detect: `rgba(244, 114, 182, ${alpha})`
  };
  return colors[type] || `rgba(161, 161, 170, ${alpha})`;
}

/**
 * Get a compact label for an action (used in compact view)
 */
function getCompactLabel(action) {
  switch (action.type) {
    case 'mouse_move':
      if (action.moveMode === 'image' && action.imageId) {
        return `🖼${action.imageId.substring(0, 6)}`;
      }
      if (action.moveMode === 'bounds' && action.bounds) {
        return `□${action.bounds.x},${action.bounds.y}`;
      }
      return action.x !== undefined ? `${action.x},${action.y}` : 'pos';
    case 'mouse_click':
      const btn = (action.button || 'left')[0].toUpperCase();
      return action.clickType === 'double' ? `${btn}x2` : btn;
    case 'keyboard':
      if (action.mode === 'type') {
        const text = action.text || '';
        return text.substring(0, 8) + (text.length > 8 ? '…' : '');
      }
      return action.key || 'key';
    case 'wait':
      if (action.duration) {
        const ms = action.duration.min || action.duration;
        return `${ms}ms`;
      }
      return 'wait';
    case 'conditional':
      return 'if';
    case 'loop':
      return action.infinite ? '×∞' : `×${action.count || 1}`;
    case 'image_detect':
      return 'img';
    case 'pixel_detect':
      return 'px';
    default:
      return action.type;
  }
}

/**
 * Get a summary string for an action
 */
function getActionSummary(action) {
  const variableSuffix = getActionVariableSuffix(action);
  switch (action.type) {
    case 'mouse_move':
      if (action.moveMode === 'image' && action.imageId) {
        return `Move to image "${action.imageId}"`;
      }
      if (action.moveMode === 'bounds' && action.bounds) {
        const b = action.bounds;
        return `Random in (${b.x}, ${b.y}) ${b.width}×${b.height}`;
      }
      return action.x !== undefined ? `Move to (${action.x}, ${action.y})` : 'Move to position';
    case 'mouse_click':
      const btn = action.button || 'left';
      const click = action.clickType === 'double' ? 'Double click' : 'Click';
      return `${click} ${btn} button`;
    case 'keyboard':
      if (action.mode === 'type') {
        const text = action.text || '';
        return `Type "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;
      }
      if (action.mode === 'hold_and_act') {
        const subCount = action.actions?.length || 0;
        return `Hold ${action.key || 'key'} + ${subCount} action${subCount !== 1 ? 's' : ''}`;
      }
      return `Press ${action.key || 'key'}`;
    case 'wait':
      if (action.duration) {
        const min = action.duration.min || action.duration;
        const max = action.duration.max || action.duration;
        return `${min === max ? `Wait ${min}ms` : `Wait ${min}-${max}ms`}${variableSuffix}`;
      }
      return `Wait for condition${variableSuffix}`;
    case 'conditional':
      if (action.useElseCondition) {
        return `${action.waitUntilEitherCondition ? 'Wait for either condition' : 'Check two conditions'}${variableSuffix}`;
      }
      return `${action.condition?.type || 'If condition'}${variableSuffix}`;
    case 'loop':
      return action.infinite ? 'Repeat forever' : `Repeat ${action.count || 1} times`;
    case 'image_detect': {
      const absent = action.detectMode === 'absent';
      const verb = absent ? 'Detect missing image' : 'Find image';
      const imgText = action.imageId ? (absent ? 'Detect missing saved image' : 'Find saved image') : verb;
      return (action.soundId && action.soundId !== 'none'
        ? `${imgText} + ${action.soundId === 'tts' ? 'speech' : 'sound'}`
        : imgText) + variableSuffix;
    }
    case 'pixel_detect':
      return `${action.color ? `Find color #${action.color.r.toString(16)}${action.color.g.toString(16)}${action.color.b.toString(16)}` : 'Find pixel color'}${variableSuffix}`;
    default:
      return '';
  }
}

/**
 * Handle dragover for drop zone
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = editorState.draggedAction?.isNew ? 'copy' : 'move';
  actionSequence.classList.add('drag-over');

  // Find drop position
  const afterElement = getDragAfterElement(actionSequence, e.clientY);
  const dragging = document.querySelector('.sequence-item.dragging');

  if (afterElement == null) {
    if (dragging) actionSequence.appendChild(dragging);
  } else {
    if (dragging) actionSequence.insertBefore(dragging, afterElement);
  }
}

/**
 * Handle drop
 */
function handleDrop(e) {
  e.preventDefault();
  actionSequence.classList.remove('drag-over');

  if (!editorState.draggedAction) return;

  if (editorState.draggedAction.isTemplate) {
    // Insert template actions
    const dropIndex = getDropIndex(e.clientY);
    insertTemplateIntoWorkflow(editorState.draggedAction.templateId, dropIndex);
  } else if (editorState.draggedAction.isNew) {
    // Add new action
    const dropIndex = getDropIndex(e.clientY);
    addActionToSequence(editorState.draggedAction.type, dropIndex);
  } else {
    // Reorder existing action
    const fromIndex = editorState.draggedAction.index;
    const toIndex = getDropIndex(e.clientY);

    if (fromIndex !== toIndex) {
      reorderAction(fromIndex, toIndex);
    }
  }

  editorState.draggedAction = null;
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
  if (!actionSequence.contains(e.relatedTarget)) {
    actionSequence.classList.remove('drag-over');
  }
}

/**
 * Get drop index from mouse position
 */
function getDropIndex(y) {
  const items = [...actionSequence.querySelectorAll('.sequence-item:not(.dragging)')];
  if (items.length === 0) return 0;

  for (let i = 0; i < items.length; i++) {
    const box = items[i].getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0) return i;
  }

  return items.length;
}

/**
 * Get element to insert after based on Y position
 */
function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.sequence-item:not(.dragging)')];

  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


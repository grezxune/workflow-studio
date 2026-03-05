/**
 * Create a new workflow
 */
async function createNewWorkflow() {
  try {
    const workflow = await window.workflowAPI.createWorkflow({
      name: 'Untitled Workflow',
      description: '',
      actions: []
    });

    state.workflows.unshift(workflow);
    renderWorkflowList();

    // Open in editor
    openWorkflowInEditor(workflow.id);

    showToast('success', 'Created', 'New workflow created');
  } catch (error) {
    console.error('Failed to create workflow:', error);
    showToast('error', 'Error', 'Failed to create workflow');
  }
}

/**
 * Open a workflow in the editor
 */
async function openWorkflowInEditor(workflowId) {
  try {
    const workflow = await window.workflowAPI.getWorkflow(workflowId);
    if (!workflow) {
      showToast('error', 'Error', 'Workflow not found');
      return;
    }

    state.currentWorkflow = workflow;
    loadWorkflowIntoEditor(workflow);
    navigateTo('editor');
  } catch (error) {
    console.error('Failed to open workflow:', error);
    showToast('error', 'Error', 'Failed to open workflow');
  }
}

/**
 * Run a workflow
 */
async function runWorkflow(workflowId) {
  try {
    const workflow = await window.workflowAPI.getWorkflow(workflowId);
    if (!workflow) {
      showToast('error', 'Error', 'Workflow not found');
      return;
    }

    if (!workflow.actions || workflow.actions.length === 0) {
      showToast('warning', 'Empty', 'This workflow has no actions');
      return;
    }

    // Check permissions first (macOS) to keep permission flow explicit
    if (window.platform.isMac) {
      try {
        const status = await window.workflowAPI.getPermissionStatus();
        if (!status.accessibility) {
          showAccessibilityPermissionModal();
          return;
        }
      } catch (err) {
        console.warn('Could not check permissions:', err);
      }
    }

    const result = await window.workflowAPI.executeWorkflow(workflow);

    if (!result.success) {
      if (result.error && result.error.includes('Accessibility permission')) {
        showAccessibilityPermissionModal();
      } else {
        showToast('error', 'Error', result.error || 'Failed to start workflow');
      }
    }
  } catch (error) {
    console.error('Failed to run workflow:', error);
    showToast('error', 'Error', 'Failed to run workflow');
  }
}

function showAccessibilityPermissionModal() {
  showModal('Accessibility Permission Required', `
    <p>Workflow Studio needs Accessibility permission to control mouse and keyboard.</p>
    <p>Please grant access in:</p>
    <ol style="margin: 12px 0; padding-left: 20px;">
      <li>Open System Settings</li>
      <li>Go to Privacy & Security > Accessibility</li>
      <li>Add and enable Workflow Studio</li>
    </ol>
    <p>After granting permission, run the workflow again.</p>
  `, [
    {
      label: 'Open Accessibility Settings',
      class: 'btn-primary',
      onClick: async () => {
        await window.workflowAPI.requestAccessibilityPermission();
      }
    },
    { label: 'Cancel', class: 'btn-secondary' }
  ]);
}

/**
 * Duplicate a workflow
 */
async function duplicateWorkflow(workflowId) {
  try {
    const duplicated = await window.workflowAPI.duplicateWorkflow(workflowId);
    state.workflows.unshift(duplicated);
    renderWorkflowList();
    showToast('success', 'Duplicated', 'Workflow duplicated');
  } catch (error) {
    console.error('Failed to duplicate workflow:', error);
    showToast('error', 'Error', 'Failed to duplicate workflow');
  }
}

/**
 * Confirm and delete a workflow
 */
function confirmDeleteWorkflow(workflow) {
  showConfirm(
    'Delete Workflow',
    `Are you sure you want to delete "${escapeHtml(workflow.name)}"? This cannot be undone.`,
    () => deleteWorkflow(workflow.id)
  );
}

/**
 * Delete a workflow
 */
async function deleteWorkflow(workflowId) {
  try {
    await window.workflowAPI.deleteWorkflow(workflowId);
    state.workflows = state.workflows.filter(w => w.id !== workflowId);
    renderWorkflowList();
    showToast('success', 'Deleted', 'Workflow deleted');
  } catch (error) {
    console.error('Failed to delete workflow:', error);
    showToast('error', 'Error', 'Failed to delete workflow');
  }
}

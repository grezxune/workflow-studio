const SHARED_BUTTON_SELECTOR = 'button.btn, button.nav-tab, button.status-indicator';

function enhanceButton(button: HTMLButtonElement): void {
  if (button.dataset.sharedButtonReady === 'true') {
    return;
  }

  button.dataset.sharedButtonReady = 'true';
  button.classList.add('ui-btn');

  const directChildren = Array.from(button.children);

  for (const child of directChildren) {
    if (child.tagName.toLowerCase() !== 'svg') {
      continue;
    }

    const svg = child as SVGElement;
    const wrapper = document.createElement('span');
    wrapper.className = 'btn-icon-slot';
    button.insertBefore(wrapper, svg);
    wrapper.appendChild(svg);
  }
}

function enhanceButtonsIn(root: ParentNode): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(SHARED_BUTTON_SELECTOR);
  buttons.forEach(enhanceButton);
}

function initSharedButtonSystem(): void {
  enhanceButtonsIn(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        if (node.matches?.(SHARED_BUTTON_SELECTOR)) {
          enhanceButton(node as HTMLButtonElement);
        }

        enhanceButtonsIn(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

initSharedButtonSystem();

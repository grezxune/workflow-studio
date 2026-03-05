import { useEffect, useMemo } from 'react';
import legacyDocument from '../legacy/index.legacy.html?raw';

function extractLegacyShell(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return '<div id="app"></div>';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const appRoot = doc.querySelector('#app');
  return appRoot?.outerHTML ?? '<div id="app"></div>';
}

/**
 * React host component for the migrated renderer shell.
 * Existing feature behavior is preserved through typed legacy modules.
 */
export function App() {
  const shellMarkup = useMemo(() => extractLegacyShell(legacyDocument), []);

  useEffect(() => {
    if ((window as Window & { __workflowLegacyBootstrapped?: boolean }).__workflowLegacyBootstrapped) {
      return;
    }
    (window as Window & { __workflowLegacyBootstrapped?: boolean }).__workflowLegacyBootstrapped = true;
    void import('../legacy/legacy-app');
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: shellMarkup }} />;
}

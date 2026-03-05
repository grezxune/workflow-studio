import { useEffect, useMemo } from 'react';
import parse from 'html-react-parser';
import appShellDocument from './runtime/app-shell.html?raw';
import { bootstrapRendererRuntime } from './runtime/bootstrap';

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
 * Existing feature behavior is preserved through modular runtime chunks.
 */
export function App() {
  const shellMarkup = useMemo(() => extractLegacyShell(appShellDocument), []);
  const shellNode = useMemo(() => parse(shellMarkup), [shellMarkup]);

  useEffect(() => {
    if ((window as Window & { __workflowRuntimeBootstrapped?: boolean }).__workflowRuntimeBootstrapped) {
      return;
    }
    (window as Window & { __workflowRuntimeBootstrapped?: boolean }).__workflowRuntimeBootstrapped = true;
    void bootstrapRendererRuntime();
  }, []);

  return <>{shellNode}</>;
}

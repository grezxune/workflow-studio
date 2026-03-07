const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const DEVTOOLS_PROTOCOL = 'devtools:';

export function getRendererDevOrigin(rendererUrl = process.env.ELECTRON_RENDERER_URL): string | null {
  if (!rendererUrl) {
    return null;
  }

  try {
    return new URL(rendererUrl).origin;
  } catch {
    return null;
  }
}

export function isTrustedRendererNavigationUrl(url: string, rendererDevOrigin?: string | null): boolean {
  if (!url) {
    return false;
  }

  const devOrigin = rendererDevOrigin ?? getRendererDevOrigin();

  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'file:' || parsed.protocol === DEVTOOLS_PROTOCOL) {
      return true;
    }

    return Boolean(devOrigin && parsed.origin === devOrigin);
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

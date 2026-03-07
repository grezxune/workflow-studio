import { describe, expect, test } from 'bun:test';
import {
  getRendererDevOrigin,
  isSafeExternalUrl,
  isTrustedRendererNavigationUrl
} from '../../src/main/lib/window-security-rules';

describe('window-security-rules', () => {
  test('parses renderer dev origin when URL is valid', () => {
    expect(getRendererDevOrigin('http://localhost:5173/')).toBe('http://localhost:5173');
  });

  test('returns null when renderer URL is invalid', () => {
    expect(getRendererDevOrigin('not-a-url')).toBeNull();
  });

  test('allows trusted renderer URLs and blocks unknown origins', () => {
    const trustedOrigin = 'http://localhost:5173';
    expect(isTrustedRendererNavigationUrl('file:///tmp/index.html', trustedOrigin)).toBe(true);
    expect(isTrustedRendererNavigationUrl('devtools://devtools/bundled/devtools_app.html', trustedOrigin)).toBe(true);
    expect(isTrustedRendererNavigationUrl('http://localhost:5173/index.html', trustedOrigin)).toBe(true);
    expect(isTrustedRendererNavigationUrl('https://example.com', trustedOrigin)).toBe(false);
  });

  test('only allows http/https external URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('mailto:test@example.com')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });
});

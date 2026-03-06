import { describe, expect, test } from 'bun:test';
import { assertSafeFileId, resolvePathWithin } from '../../src/main/lib/safe-path';

describe('safe-path', () => {
  test('accepts a valid identifier', () => {
    expect(assertSafeFileId('workflow-123')).toBe('workflow-123');
  });

  test('rejects invalid identifiers', () => {
    expect(() => assertSafeFileId('../secrets')).toThrow();
    expect(() => assertSafeFileId('')).toThrow();
    expect(() => assertSafeFileId('   ')).toThrow();
    expect(() => assertSafeFileId(null)).toThrow();
  });

  test('blocks traversal outside the base directory', () => {
    expect(() => resolvePathWithin('/tmp/workflow', '../escape.json')).toThrow('Unsafe path');
  });

  test('allows a path within the base directory', () => {
    const resolved = resolvePathWithin('/tmp/workflow', 'abc.json');
    expect(resolved).toBe('/tmp/workflow/abc.json');
  });
});

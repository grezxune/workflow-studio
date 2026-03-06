import path from 'node:path';

export function assertSafeFileId(id: unknown, label = 'id', maxLength = 200): string {
  if (typeof id !== 'string') {
    throw new Error(`Invalid ${label}: expected string`);
  }

  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new Error(`Invalid ${label}: must be between 1 and ${maxLength} characters`);
  }
  if (trimmed.includes('\0')) {
    throw new Error(`Invalid ${label}: contains null byte`);
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error(`Invalid ${label}: path separators are not allowed`);
  }

  return trimmed;
}

export function resolvePathWithin(baseDir: string, fileName: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, fileName);

  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Unsafe path');
  }

  return resolvedPath;
}

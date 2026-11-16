export type StreamServerId = 'server1' | 'server2' | 'server3';

const INVALID_URL_PLACEHOLDERS = new Set([
  '',
  'null',
  'undefined',
  'none',
  'n/a',
  'na',
  'nil',
  'empty',
  'broken',
  'corrupt',
  'corrupted',
  'invalid',
  'missing',
  'todo',
  'tbd',
  'placeholder',
  '...',
  '-',
]);

/**
 * Validates whether a candidate stream URL is present and non-corrupt.
 * Accepts valid http(s) URLs, relative proxy/asset paths (`/api/...`), `blob:`, `data:`, and `filesystem:` URLs.
 * Rejects empty values, placeholder tokens ("null", "undefined", "corrupt", etc.), whitespace-only strings,
 * and malformed protocols like `"http://"` or bare garbage text.
 */
export function isValidStreamUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (INVALID_URL_PLACEHOLDERS.has(lower)) return false;

  // Reject unquoted error/HTML fragments
  if (lower.startsWith('<') || lower.includes('object object')) return false;

  // Allow valid relative proxy/media paths (e.g. `/api/stream-proxy?url=...`)
  if (trimmed.startsWith('/')) {
    return trimmed.length > 1 && !/\s/.test(trimmed);
  }

  // Allow browser local/offline schemes
  if (lower.startsWith('blob:') || lower.startsWith('data:') || lower.startsWith('filesystem:')) {
    return trimmed.length > 8;
  }

  // Strictly validate standard http/https URLs
  if (/^https?:\/\//i.test(trimmed)) {
    if (/\s/.test(trimmed)) return false;
    try {
      const parsed = new URL(trimmed);
      return Boolean(parsed.hostname && parsed.hostname.length >= 2 && !INVALID_URL_PLACEHOLDERS.has(parsed.hostname.toLowerCase()));
    } catch {
      return false;
    }
  }

  return false;
}

export function extractValidQualityLinksMap(
  ...sources: Array<Record<string, any> | any[] | undefined | null>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const item of src) {
        if (item && typeof item === 'object' && item.id && isValidStreamUrl(item.url)) {
          if (!result[item.id]) result[item.id] = String(item.url).trim();
        }
      }
      continue;
    }
    if (typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (isValidStreamUrl(v) && !result[k]) {
          result[k] = String(v).trim();
        }
      }
    }
  }
  return result;
}

export function hasAnyValidLinkInSources(
  videoSources: Record<string, Record<string, any>> | undefined | null
): boolean {
  if (!videoSources || typeof videoSources !== 'object') return false;
  return Object.values(videoSources).some(
    (langMap) =>
      langMap &&
      typeof langMap === 'object' &&
      Object.values(langMap).some((val) => isValidStreamUrl(val))
  );
}

export interface ServerLinkAvailability {
  server1: boolean;
  server2: boolean;
  server3: boolean;
}

/**
 * Resolves which server to show:
 * - NEVER changes away from `desiredServer` when `desiredServer` has valid (non-missing, non-corrupt) links.
 * - ONLY falls back to another available server when `desiredServer`'s link is missing or corrupt.
 */
export function resolveServerWhenMissingOrCorrupt(
  desiredServer: StreamServerId,
  availability: ServerLinkAvailability
): StreamServerId {
  if (desiredServer === 'server1' && availability.server1) return 'server1';
  if (desiredServer === 'server2' && availability.server2) return 'server2';
  if (desiredServer === 'server3' && availability.server3) return 'server3';

  if (availability.server1) return 'server1';
  if (availability.server2) return 'server2';
  if (availability.server3) return 'server3';

  return desiredServer;
}

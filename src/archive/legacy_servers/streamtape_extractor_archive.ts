/**
 * ARCHIVED: Server 2 (Streamtape) Extraction & Parsing Engine
 * Preserved on 2026-11-20
 * 
 * Features:
 * - Unblocked mirror race (streamta.pe, strtape.tech, strcloud.link)
 * - Anti-bot token decoding (videolink / botlink DOM parser)
 * - Single-connection tokenized CDN management (tapecontent.net)
 */

export interface StreamtapeExtractionResult {
  streamUrl: string;
  streamTapeDirectUrl?: string;
  sourceType: 'STREAMTAPE_DIRECT';
  quality: string;
  headers: Record<string, string>;
}

export const STREAMTAPE_UNBLOCKED_DOMAINS = [
  'streamta.pe',
  'strtape.tech',
  'strcloud.link',
  'streamtape.to',
  'streamtape.net',
  'streamtape.com',
];

export async function extractStreamtapeDirectUrl(
  pageUrl: string,
  fetchHtmlFn: (url: string) => Promise<string>
): Promise<StreamtapeExtractionResult | null> {
  const match = pageUrl.match(/\/(?:v|e)\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const videoId = match[1];

  let rawHtml = '';
  let resolvedMirror = 'https://streamta.pe';

  for (const domain of STREAMTAPE_UNBLOCKED_DOMAINS) {
    try {
      const candidateUrl = `https://${domain}/e/${videoId}`;
      const html = await fetchHtmlFn(candidateUrl);
      if (html && (html.includes('videolink') || html.includes('botlink') || html.includes('token='))) {
        rawHtml = html;
        resolvedMirror = `https://${domain}`;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!rawHtml) return null;

  // Streamtape obfuscates link across two script tags or token slices
  let streamUrl = '';
  const tokenRegex = /id=["'](?:robotlink|botlink|videolink)["'][^>]*>([^<]+)<\//i;
  const scriptRegex = /document\.getElementById\(["'](?:robotlink|botlink|videolink)["']\)\.innerHTML\s*=\s*["']([^"']+)["']\s*\+\s*\(["']([^"']+)["']\)\.substring\((\d+)\)/i;

  const scriptMatch = rawHtml.match(scriptRegex);
  if (scriptMatch) {
    const part1 = scriptMatch[1];
    const part2 = scriptMatch[2];
    const offset = parseInt(scriptMatch[3], 10) || 0;
    streamUrl = `https:${part1}${part2.substring(offset)}`;
  } else {
    const tokenMatch = rawHtml.match(tokenRegex);
    if (tokenMatch && tokenMatch[1]) {
      const part = tokenMatch[1].trim();
      streamUrl = part.startsWith('//') ? `https:${part}` : part;
    }
  }

  if (!streamUrl || !streamUrl.includes('tapecontent.net') && !streamUrl.includes('/get_video')) {
    return null;
  }

  return {
    streamUrl,
    streamTapeDirectUrl: streamUrl,
    sourceType: 'STREAMTAPE_DIRECT',
    quality: '1080p',
    headers: {
      Referer: `${resolvedMirror}/`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  };
}

export interface SafeLink {
  id: string;
  url: string;
  label: string;
  active: boolean;
  createdAt: string;
  lastRun?: string;
  lastResult?: 'success' | 'failed' | 'skipped';
  lastDestUrl?: string;
}

export interface LinkLog {
  id: string;
  linkId: string;
  linkLabel: string;
  originalUrl: string;
  destUrl?: string;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

// =============================================
// Safelink Bypass Engine
// Supports multiple common safelink patterns
// =============================================

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Try to extract the real destination URL from a safelink page.
 * Returns the destination URL string or throws an error.
 */
export async function bypassSafelink(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching safelink`);
  }

  const html = await res.text();

  // Strategy 1: window.location redirect
  const windowLocMatch = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
  if (windowLocMatch) return decodeURIComponent(windowLocMatch[1]);

  // Strategy 2: meta refresh redirect
  const metaMatch = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]*;\s*url=([^"'>\s]+)/i);
  if (metaMatch) return decodeURIComponent(metaMatch[1]);

  // Strategy 3: Base64 encoded URL in page
  const base64Matches = html.matchAll(/(?:url|link|href)\s*[:=]\s*['"]([A-Za-z0-9+/]{20,}={0,2})['"]/gi);
  for (const match of base64Matches) {
    try {
      const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    } catch { /* skip */ }
  }

  // Strategy 4: data-url attribute
  const dataUrlMatch = html.match(/data-url=["']([^"']+)["']/);
  if (dataUrlMatch) return decodeURIComponent(dataUrlMatch[1]);

  // Strategy 5: Common safelink GET param (?url=... or ?link=...)
  const urlParam = new URL(url);
  const paramUrl = urlParam.searchParams.get('url') || urlParam.searchParams.get('link') || urlParam.searchParams.get('go');
  if (paramUrl) {
    try {
      const decoded = Buffer.from(paramUrl, 'base64').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    } catch { /* skip */ }
    if (paramUrl.startsWith('http')) return paramUrl;
  }

  // Strategy 6: Look for any visible link inside <a> with class containing "btn" or "get"
  const btnLinkMatch = html.match(/<a[^>]+(?:class=["'][^"']*(?:btn|get-link|download)[^"']*["'])[^>]+href=["']([^"']+)["']/i);
  if (btnLinkMatch && btnLinkMatch[1].startsWith('http')) return btnLinkMatch[1];

  // Strategy 7: ouo.io / short.fc pattern - look for location assign
  const locAssignMatch = html.match(/location\.(?:assign|replace)\(['"]([^'"]+)['"]\)/);
  if (locAssignMatch) return locAssignMatch[1];

  throw new Error('Could not extract destination URL from safelink page. The safelink format may not be supported.');
}

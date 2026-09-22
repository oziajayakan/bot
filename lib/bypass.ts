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

// User-Agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildHeaders(referer?: string, cookies?: string): Record<string, string> {
  const ua = randomUA();
  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
  };
  if (referer) headers['Referer'] = referer;
  if (cookies) headers['Cookie'] = cookies;
  return headers;
}

/**
 * Fetch a URL with automatic cookie grabbing and multi-step / retry handling
 */
async function fetchPage(targetUrl: string, referer?: string): Promise<{ html: string; finalUrl: string; cookies: string }> {
  const parsed = new URL(targetUrl);
  const origin = `${parsed.protocol}//${parsed.hostname}`;

  let cookies = '';

  // Step 1: Pre-fetch homepage for cookies if no cookies yet
  try {
    const homeRes = await fetch(origin, {
      headers: buildHeaders(undefined, undefined),
      redirect: 'follow',
    });
    const setCookie = homeRes.headers.get('set-cookie');
    if (setCookie) {
      cookies = setCookie
        .split(',')
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // Continue if homepage fails
  }

  // Step 2: Fetch target URL
  let res = await fetch(targetUrl, {
    headers: buildHeaders(referer || origin + '/', cookies || undefined),
    redirect: 'follow',
  });

  // Retry with Google referer if 403
  if (res.status === 403) {
    res = await fetch(targetUrl, {
      headers: buildHeaders('https://www.google.com/', undefined),
      redirect: 'follow',
    });
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching safelink`);
  }

  const finalSetCookie = res.headers.get('set-cookie');
  if (finalSetCookie) {
    const newCookies = finalSetCookie
      .split(',')
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    cookies = cookies ? `${cookies}; ${newCookies}` : newCookies;
  }

  const html = await res.text();
  return { html, finalUrl: res.url, cookies };
}

/**
 * Try to extract the real destination URL from a safelink page.
 * Returns the destination URL string or throws an error.
 */
export async function bypassSafelink(url: string): Promise<string> {
  const { html, finalUrl, cookies } = await fetchPage(url);

  // Special Handler: Auto-submit form (e.g. sfl.gl, safelinku, etc.)
  // Patterns like: <form action="https://app.khaddavi.net/redirect.php" id="form" method="GET">
  const formMatch = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch) {
    const formAction = formMatch[1];
    const formBody = formMatch[2];
    const isAutoSubmit =
      html.includes('.submit()') ||
      html.includes('DOMContentLoaded') ||
      formBody.includes('ray_id') ||
      formBody.includes('alias');

    if (isAutoSubmit && formAction.startsWith('http')) {
      // Parse inputs from form
      const inputs = [...formBody.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]+value=["']([^"']*)["']/gi)];
      const targetUrl = new URL(formAction);
      for (const input of inputs) {
        targetUrl.searchParams.set(input[1], input[2]);
      }

      // Execute GET submission
      try {
        const redirectRes = await fetch(targetUrl.toString(), {
          headers: buildHeaders(url, cookies || undefined),
          redirect: 'manual',
        });

        const locationHeader = redirectRes.headers.get('location');
        if (locationHeader) {
          const resolvedLocation = new URL(locationHeader, targetUrl).toString();
          return resolvedLocation;
        }

        // If it followed redirect automatically or 200
        if (redirectRes.url && redirectRes.url !== targetUrl.toString()) {
          return redirectRes.url;
        }

        return targetUrl.toString();
      } catch {
        // Fallback to targetUrl string if network fails
        return targetUrl.toString();
      }
    }
  }

  // Strategy 1: window.location redirect
  const windowLocMatch = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
  if (windowLocMatch && windowLocMatch[1].startsWith('http')) return decodeURIComponent(windowLocMatch[1]);

  // Strategy 2: meta refresh redirect
  const metaMatch = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]*;\s*url=([^"'>\s]+)/i);
  if (metaMatch) return decodeURIComponent(metaMatch[1]);

  // Strategy 3: Base64 encoded URL di dalam halaman
  const base64Matches = html.matchAll(/(?:url|link|href|goto|target)\s*[:=]\s*['"]([A-Za-z0-9+/]{20,}={0,2})['"]/gi);
  for (const match of base64Matches) {
    try {
      const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    } catch { /* skip */ }
  }

  // Strategy 4: data-url / data-link / data-href attribute
  const dataAttrMatch = html.match(/data-(?:url|link|href|target)=["']([^"']+)["']/i);
  if (dataAttrMatch) {
    const val = decodeURIComponent(dataAttrMatch[1]);
    if (val.startsWith('http')) return val;
  }

  // Strategy 5: URL di dalam atribut action form standard
  if (formMatch && formMatch[1].startsWith('http')) {
    return formMatch[1];
  }

  // Strategy 6: Common safelink GET param (?url= / ?link= / ?go= / ?ref=)
  const urlParam = new URL(finalUrl);
  const paramUrl =
    urlParam.searchParams.get('url') ||
    urlParam.searchParams.get('link') ||
    urlParam.searchParams.get('go') ||
    urlParam.searchParams.get('ref') ||
    urlParam.searchParams.get('to');
  if (paramUrl) {
    try {
      const decoded = Buffer.from(paramUrl, 'base64').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    } catch { /* skip */ }
    if (paramUrl.startsWith('http')) return paramUrl;
  }

  // Strategy 7: Tombol/link dengan class btn, get-link, download
  const btnLinkMatch = html.match(/<a[^>]+(?:class=["'][^"']*(?:btn|get-link|download|link-btn)[^"']*["'])[^>]+href=["']([^"']+)["']/i);
  if (btnLinkMatch && btnLinkMatch[1].startsWith('http')) return btnLinkMatch[1];

  // Strategy 8: location.assign / location.replace
  const locAssignMatch = html.match(/location\.(?:assign|replace)\(['"]([^'"]+)['"]\)/);
  if (locAssignMatch && locAssignMatch[1].startsWith('http')) return locAssignMatch[1];

  // Strategy 9: Cari semua <a href> yang mengarah ke domain lain (eksternal)
  const parsedOrigin = new URL(url).hostname;
  const allLinks = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi)];
  for (const match of allLinks) {
    const href = match[1];
    try {
      const hrefHost = new URL(href).hostname;
      if (hrefHost !== parsedOrigin && !href.includes('google') && !href.includes('facebook') && !href.includes('twitter')) {
        return href;
      }
    } catch { /* skip */ }
  }

  // Strategy 10: Jika halaman sudah di-redirect ke URL lain (finalUrl != url)
  if (finalUrl !== url && finalUrl.startsWith('http')) {
    const finalParsed = new URL(finalUrl);
    if (finalParsed.hostname !== new URL(url).hostname) {
      return finalUrl;
    }
  }

  throw new Error(
    'Tidak dapat mengekstrak URL tujuan dari halaman safelink ini. ' +
    'Format safelink mungkin memerlukan interaksi manual.'
  );
}

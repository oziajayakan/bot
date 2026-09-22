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
// Safelink Bypass Engine v2
// Handles 403/bot-detection dengan multi-step:
//  1. Kunjungi homepage domain dulu (dapat cookie)
//  2. Baru fetch halaman safelink dengan cookie + referer
// =============================================

// Beberapa User-Agent acak agar tidak selalu sama
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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
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
 * Ambil cookie dari homepage domain sebelum fetch safelink.
 * Ini meniru perilaku browser yang mengunjungi site dari awal.
 */
async function fetchWithCookies(targetUrl: string): Promise<{ html: string; finalUrl: string }> {
  const parsed = new URL(targetUrl);
  const origin = `${parsed.protocol}//${parsed.hostname}`;

  let cookies = '';

  // Step 1: Kunjungi homepage dulu untuk dapat cookie sesi
  try {
    const homeRes = await fetch(origin, {
      headers: buildHeaders(undefined, undefined),
      redirect: 'follow',
    });
    // Extract Set-Cookie header
    const setCookie = homeRes.headers.get('set-cookie');
    if (setCookie) {
      // Parse multiple cookies menjadi satu string "key=val; key2=val2"
      cookies = setCookie
        .split(',')
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // Abaikan jika homepage gagal, tetap lanjut ke halaman target
  }

  // Step 2: Fetch halaman safelink dengan cookie + referer
  const res = await fetch(targetUrl, {
    headers: buildHeaders(origin + '/', cookies || undefined),
    redirect: 'follow',
  });

  // Jika masih 403, coba tanpa cookie sama sekali tapi dengan referer Google
  if (res.status === 403) {
    const retryRes = await fetch(targetUrl, {
      headers: buildHeaders('https://www.google.com/', undefined),
      redirect: 'follow',
    });
    if (!retryRes.ok) {
      throw new Error(`HTTP ${retryRes.status} when fetching safelink (after retry with Google referer)`);
    }
    const html = await retryRes.text();
    return { html, finalUrl: retryRes.url };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching safelink`);
  }

  const html = await res.text();
  return { html, finalUrl: res.url };
}

/**
 * Try to extract the real destination URL from a safelink page.
 * Returns the destination URL string or throws an error.
 */
export async function bypassSafelink(url: string): Promise<string> {
  const { html, finalUrl } = await fetchWithCookies(url);

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

  // Strategy 5: URL di dalam atribut action form
  const formActionMatch = html.match(/<form[^>]+action=["']([^"']+)["']/i);
  if (formActionMatch && formActionMatch[1].startsWith('http')) return formActionMatch[1];

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
      // Jika link mengarah ke domain berbeda, kemungkinan besar itu tujuan
      if (hrefHost !== parsedOrigin && !href.includes('google') && !href.includes('facebook')) {
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
    'Format safelink mungkin belum didukung atau menggunakan JavaScript dinamis.'
  );
}

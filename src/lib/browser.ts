export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  createdAt: number;
}

const STORAGE_KEY_TABS = 'quietnotes_browser_tabs_v1';
const STORAGE_KEY_ACTIVE_TAB = 'quietnotes_browser_active_tab_v1';

export const DEFAULT_HOMEPAGE = 'https://www.google.com';

/**
 * Normalizes input string to a valid http/https URL or search query.
 */
export function normalizeBrowserUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_HOMEPAGE;

  // Check if already has http/https protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Check for dangerous schemes
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) {
    return DEFAULT_HOMEPAGE;
  }

  // If looks like a domain name (e.g. google.com, github.com/user, localhost:3000)
  const isLikelyDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed) || /^localhost(:[0-9]+)?(\/.*)?$/i.test(trimmed);

  if (isLikelyDomain) {
    return `https://${trimmed}`;
  }

  // Otherwise, treat as search query on Google
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

/**
 * Validates whether a URL is safe to navigate to
 */
export function validateUrlSafety(url: string): { safe: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { safe: false, error: 'URL ไม่ถูกต้อง' };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) {
    return { safe: false, error: 'ไม่อนุญาตให้เปิดโปรโตคอลนี้เพื่อความปลอดภัย' };
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return { safe: false, error: 'รองรับเฉพาะ http และ https เท่านั้น' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'โปรโตคอลไม่ถูกต้อง' };
    }
    return { safe: true };
  } catch (err) {
    return { safe: false, error: 'รูปแบบ URL ไม่ถูกต้อง' };
  }
}

/**
 * Extracts a friendly hostname/title from a URL
 */
export function getFriendlyTabTitle(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('google.') && parsed.searchParams.has('q')) {
      return `Search: ${parsed.searchParams.get('q')}`;
    }
    return parsed.hostname.replace(/^www\./i, '') || 'New Tab';
  } catch (e) {
    return 'New Tab';
  }
}

/**
 * Local-First persistence: Loads saved browser tabs and active tab ID
 */
export function loadSavedBrowserState(): { tabs: BrowserTab[]; activeTabId: string } {
  if (typeof window === 'undefined') {
    const initialId = crypto.randomUUID();
    return {
      tabs: [{ id: initialId, url: DEFAULT_HOMEPAGE, title: 'Google', createdAt: Date.now() }],
      activeTabId: initialId,
    };
  }

  try {
    const savedTabsRaw = localStorage.getItem(STORAGE_KEY_TABS);
    const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);

    if (savedTabsRaw) {
      const parsedTabs = JSON.parse(savedTabsRaw);
      if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
        const validTabs: BrowserTab[] = parsedTabs.map((t: any) => ({
          id: String(t.id || crypto.randomUUID()),
          url: typeof t.url === 'string' && t.url.trim() ? t.url : DEFAULT_HOMEPAGE,
          title: typeof t.title === 'string' && t.title.trim() ? t.title : getFriendlyTabTitle(t.url || DEFAULT_HOMEPAGE),
          createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
        }));

        let activeId = validTabs[0].id;
        if (savedActiveId && validTabs.some((t) => t.id === savedActiveId)) {
          activeId = savedActiveId;
        }

        return { tabs: validTabs, activeTabId: activeId };
      }
    }
  } catch (err) {
    console.warn('Failed to load saved browser tabs, initializing defaults:', err);
  }

  // Default initial tab
  const newId = crypto.randomUUID();
  const defaultTab: BrowserTab = {
    id: newId,
    url: DEFAULT_HOMEPAGE,
    title: 'Google',
    createdAt: Date.now(),
  };

  return { tabs: [defaultTab], activeTabId: newId };
}

/**
 * Local-First persistence: Saves browser tabs and active tab ID
 */
export function saveBrowserState(tabs: BrowserTab[], activeTabId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId);
  } catch (err) {
    console.warn('Failed to save browser tabs to localStorage:', err);
  }
}

// ─────────────────────────────────────────────
// TAURI DESKTOP NATIVE IPC CALLS
// ─────────────────────────────────────────────

export async function checkIsTauri(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    return isTauri();
  } catch {
    return false;
  }
}

export async function nativeCreateTab(
  tabId: string, 
  url: string, 
  bounds: { x: number; y: number; width: number; height: number }
): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_create_tab', {
      tabId,
      url,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  } catch (err) {
    console.warn('nativeCreateTab error:', err);
  }
}

export async function nativeSwitchTab(activeTabId: string, allTabIds: string[]): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_switch_tab', { activeTabId, allTabIds });
  } catch (err) {
    console.warn('nativeSwitchTab error:', err);
  }
}

export async function nativeNavigate(tabId: string, url: string): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_navigate', { tabId, url });
  } catch (err) {
    console.warn('nativeNavigate error:', err);
  }
}

export async function nativeReload(tabId: string): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_reload', { tabId });
  } catch (err) {
    console.warn('nativeReload error:', err);
  }
}

export async function nativeBack(tabId: string): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_back', { tabId });
  } catch (err) {
    console.warn('nativeBack error:', err);
  }
}

export async function nativeForward(tabId: string): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_forward', { tabId });
  } catch (err) {
    console.warn('nativeForward error:', err);
  }
}

export async function nativeCloseTab(tabId: string): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_close_tab', { tabId });
  } catch (err) {
    console.warn('nativeCloseTab error:', err);
  }
}

export async function nativeUpdateBounds(
  activeTabId: string, 
  bounds: { x: number; y: number; width: number; height: number }
): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_update_bounds', {
      activeTabId,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  } catch (err) {
    console.warn('nativeUpdateBounds error:', err);
  }
}

export async function nativeHideAll(allTabIds: string[]): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_hide_all', { allTabIds });
  } catch (err) {
    console.warn('nativeHideAll error:', err);
  }
}

export async function nativeCleanupAll(): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_cleanup_all');
  } catch (err) {
    console.warn('nativeCleanupAll error:', err);
  }
}

export async function nativeGetUrl(tabId: string): Promise<string | null> {
  if (!(await checkIsTauri())) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const url = await invoke<string>('browser_get_url', { tabId });
    return url;
  } catch {
    return null;
  }
}

export async function nativePauseMedia(): Promise<void> {
  if (!(await checkIsTauri())) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_pause_media');
  } catch (err) {
    console.warn('nativePauseMedia error:', err);
  }
}

/**
 * Listen for Windows system-wide audio events emitted by the native audio monitor.
 * Returns an unlisten function.
 */
export async function listenAudioInterruption(callback: () => void): Promise<() => void> {
  if (!(await checkIsTauri())) return () => {};
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen('quietnotes://audio-detected', () => {
      callback();
    });
    return unlisten;
  } catch (err) {
    console.warn('Failed to register audio interruption listener:', err);
    return () => {};
  }
}

"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Globe, 
  Plus, 
  X, 
  RotateCw, 
  ArrowLeft, 
  ArrowRight, 
  ExternalLink, 
  Lock, 
  Search, 
  ShieldCheck, 
  Info,
} from 'lucide-react';
import { 
  BrowserTab, 
  DEFAULT_HOMEPAGE, 
  normalizeBrowserUrl, 
  validateUrlSafety, 
  getFriendlyTabTitle, 
  loadSavedBrowserState, 
  saveBrowserState, 
  checkIsTauri, 
  nativeCreateTab, 
  nativeSwitchTab, 
  nativeNavigate, 
  nativeReload, 
  nativeBack,
  nativeForward,
  nativeCloseTab, 
  nativeUpdateBounds,
  nativeHideAll,
  nativeCleanupAll,
  nativeGetUrl
} from '@/lib/browser';
import { openExternalUrl } from './NoteEditor';

interface BrowserModeViewProps {
  onCloseMode?: () => void;
  isActive?: boolean;
}

export function BrowserModeView({ onCloseMode, isActive = true }: BrowserModeViewProps) {
  // Load saved tabs from local-first persistence
  const [tabsState, setTabsState] = useState<{ tabs: BrowserTab[]; activeTabId: string }>(() => 
    loadSavedBrowserState()
  );
  const { tabs, activeTabId } = tabsState;

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const [inputUrl, setInputUrl] = useState(activeTab?.url || DEFAULT_HOMEPAGE);
  const [isTauriDesktop, setIsTauriDesktop] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Detect Tauri desktop
  useEffect(() => {
    checkIsTauri().then(setIsTauriDesktop);
  }, []);

  // Sync address input when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
      setErrorMessage(null);
    }
  }, [activeTab?.id, activeTab?.url]);

  // Persist browser tabs to localStorage
  useEffect(() => {
    if (tabs.length > 0 && activeTabId) {
      saveBrowserState(tabs, activeTabId);
    }
  }, [tabs, activeTabId]);

  // Helper to get viewport bounds in window logical pixels
  const getViewportBounds = useCallback(() => {
    if (!viewportRef.current) return { x: 0, y: 120, width: 800, height: 600 };
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.max(100, Math.round(rect.width)),
      height: Math.max(100, Math.round(rect.height)),
    };
  }, []);

  // Update native Tauri Webview position and active tab
  const syncNativeWebviews = useCallback(async () => {
    if (!isTauriDesktop || !activeTab || !isActive) return;
    const bounds = getViewportBounds();
    if (bounds.width <= 100 || bounds.height <= 100) return;
    const allIds = tabs.map(t => t.id);

    // 1. Ensure active tab is created or updated
    await nativeCreateTab(activeTab.id, activeTab.url, bounds);
    // 2. Switch visibility so only active tab is shown
    await nativeSwitchTab(activeTab.id, allIds);
    // 3. Update bounds
    await nativeUpdateBounds(activeTab.id, bounds);

    // 4. Update address bar with live URL from existing webview
    const liveUrl = await nativeGetUrl(activeTab.id);
    if (liveUrl && liveUrl !== activeTab.url) {
      setTabsState(prev => {
        const nextTabs = prev.tabs.map(t => 
          t.id === activeTab.id ? { ...t, url: liveUrl, title: getFriendlyTabTitle(liveUrl) } : t
        );
        return { ...prev, tabs: nextTabs };
      });
      setInputUrl(liveUrl);
    }
  }, [isTauriDesktop, activeTab, tabs, getViewportBounds, isActive]);

  // Track live URL changes from the native WebView2 (e.g. in-page link clicks, video navigation)
  useEffect(() => {
    if (!isTauriDesktop || !activeTabId || !isActive) return;

    let isMounted = true;
    const pollLiveUrl = async () => {
      try {
        const liveUrl = await nativeGetUrl(activeTabId);
        if (isMounted && liveUrl && typeof liveUrl === 'string') {
          setTabsState(prev => {
            const currentTab = prev.tabs.find(t => t.id === activeTabId);
            if (currentTab && currentTab.url !== liveUrl) {
              const updatedTabs = prev.tabs.map(t =>
                t.id === activeTabId
                  ? { ...t, url: liveUrl, title: getFriendlyTabTitle(liveUrl) }
                  : t
              );
              if (document.activeElement !== addressInputRef.current) {
                setInputUrl(liveUrl);
              }
              return { ...prev, tabs: updatedTabs };
            }
            return prev;
          });
        }
      } catch {}
    };

    const interval = setInterval(pollLiveUrl, 1000);
    pollLiveUrl();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isTauriDesktop, activeTabId, isActive]);

  // Handle active/inactive mode changes cleanly
  useEffect(() => {
    if (!isActive) {
      if (isTauriDesktop) {
        nativeHideAll(tabs.map(t => t.id));
      }
    } else {
      syncNativeWebviews();
    }
  }, [isActive, isTauriDesktop, tabs, syncNativeWebviews]);

  // Trigger sync on tab switch, resize, or viewport changes with ResizeObserver
  useEffect(() => {
    if (!isActive) return;
    syncNativeWebviews();

    const el = viewportRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncNativeWebviews();
      });
      resizeObserver.observe(el);
    }

    const handleWindowResize = () => {
      syncNativeWebviews();
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [syncNativeWebviews, isActive]);

  // Hide all native Webviews when unmounting (leaving Browser Mode)
  useEffect(() => {
    return () => {
      if (isTauriDesktop) {
        nativeHideAll(tabs.map(t => t.id));
      }
    };
  }, [isTauriDesktop, tabs]);

  // Clean shutdown listener on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTauriDesktop) {
        nativeCleanupAll();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTauriDesktop]);

  // ─────────────────────────────────────────────
  // TAB MANAGEMENT
  // ─────────────────────────────────────────────

  const handleCreateTab = (initialUrl: string = DEFAULT_HOMEPAGE) => {
    const newId = crypto.randomUUID();
    const newTab: BrowserTab = {
      id: newId,
      url: initialUrl,
      title: getFriendlyTabTitle(initialUrl),
      createdAt: Date.now(),
    };

    const nextTabs = [...tabs, newTab];
    setTabsState({ tabs: nextTabs, activeTabId: newId });

    if (isTauriDesktop) {
      const bounds = getViewportBounds();
      nativeCreateTab(newId, initialUrl, bounds);
    }
  };

  const handleSelectTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    setTabsState(prev => ({ ...prev, activeTabId: tabId }));
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (isTauriDesktop) {
      nativeCloseTab(tabId);
    }

    const remaining = tabs.filter(t => t.id !== tabId);

    if (remaining.length === 0) {
      // If closing the last tab, create a fresh homepage tab
      const freshId = crypto.randomUUID();
      const freshTab: BrowserTab = {
        id: freshId,
        url: DEFAULT_HOMEPAGE,
        title: 'Google',
        createdAt: Date.now(),
      };
      setTabsState({ tabs: [freshTab], activeTabId: freshId });
    } else {
      // If closing the active tab, activate the closest remaining tab
      let nextActiveId = activeTabId;
      if (tabId === activeTabId) {
        const closedIdx = tabs.findIndex(t => t.id === tabId);
        const nextIdx = Math.max(0, closedIdx - 1);
        nextActiveId = remaining[nextIdx].id;
      }
      setTabsState({ tabs: remaining, activeTabId: nextActiveId });
    }
  };

  // ─────────────────────────────────────────────
  // NAVIGATION ACTIONS
  // ─────────────────────────────────────────────

  const handleNavigate = (targetRawUrl: string) => {
    const normalized = normalizeBrowserUrl(targetRawUrl);
    const safety = validateUrlSafety(normalized);

    if (!safety.safe) {
      setErrorMessage(safety.error || 'URL ไม่ปลอดภัย');
      return;
    }

    setErrorMessage(null);
    setIsNavigating(true);

    const updatedTabs = tabs.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          url: normalized,
          title: getFriendlyTabTitle(normalized),
        };
      }
      return t;
    });

    setTabsState(prev => ({ ...prev, tabs: updatedTabs }));
    setInputUrl(normalized);

    if (isTauriDesktop) {
      nativeNavigate(activeTabId, normalized);
    }

    setTimeout(() => setIsNavigating(false), 500);
  };

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputUrl);
  };

  const handleReload = () => {
    if (isTauriDesktop && activeTab) {
      nativeReload(activeTab.id);
    } else if (activeTab) {
      handleNavigate(activeTab.url);
    }
  };

  const handleBack = () => {
    if (isTauriDesktop && activeTab) {
      nativeBack(activeTab.id);
    }
  };

  const handleForward = () => {
    if (isTauriDesktop && activeTab) {
      nativeForward(activeTab.id);
    }
  };

  const handleOpenExternal = () => {
    if (activeTab?.url) {
      openExternalUrl(activeTab.url);
    }
  };

  // ─────────────────────────────────────────────
  // KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if user is typing in standard note editor
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      // Ctrl+T: New tab
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleCreateTab();
      }
      // Ctrl+W: Close active tab
      else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      }
      // Ctrl+L: Focus address bar
      else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
      }
      // Ctrl+R: Reload
      else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReload();
      }
      // Alt+Left: Back
      else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
      // Alt+Right: Forward
      else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, isTauriDesktop]);

  return (
    <div className="relative flex-1 flex flex-col h-screen overflow-hidden bg-stone-100">
      {/* 1. Tab Bar */}
      <div className="h-10 bg-stone-200/80 border-b border-stone-300/70 flex items-center px-2 pt-1 gap-1 select-none overflow-x-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                title={tab.url}
                className={`group relative flex items-center gap-2 px-3 py-1.5 max-w-[200px] min-w-[110px] h-9 text-xs rounded-t-lg transition-all cursor-pointer truncate border-t border-x ${
                  isActive
                    ? 'bg-white text-stone-900 font-semibold border-stone-300 shadow-2xs z-10'
                    : 'bg-stone-200/60 text-stone-600 border-transparent hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                <Globe size={13} className={isActive ? 'text-blue-600 shrink-0' : 'text-stone-400 shrink-0'} />
                <span className="truncate flex-1 text-[11px]">{tab.title || 'New Tab'}</span>
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close Tab (Ctrl+W)"
                  className="opacity-60 group-hover:opacity-100 hover:bg-stone-200 hover:text-red-500 rounded p-0.5 transition-all shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            type="button"
            onClick={() => handleCreateTab()}
            title="New Tab (Ctrl+T)"
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-300/60 rounded-md transition-colors shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Runtime Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono text-stone-500 bg-stone-300/40 border border-stone-300 shrink-0">
          <ShieldCheck size={11} className="text-emerald-600" />
          <span>{isTauriDesktop ? 'WebView2 Desktop' : 'Web Sandbox'}</span>
        </div>
      </div>

      {/* 2. Navigation & Address Bar */}
      <div className="h-12 bg-white border-b border-stone-200 px-3 flex items-center justify-between gap-2 shrink-0">
        {/* Navigation Controls: Back, Forward, Reload */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            title="Back (Alt+Left)"
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            onClick={handleForward}
            title="Forward (Alt+Right)"
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={handleReload}
            title="Reload Page (Ctrl+R)"
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            <RotateCw size={14} className={isNavigating ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleSubmitUrl} className="flex-1 max-w-4xl mx-2 flex items-center">
          <div className="relative w-full flex items-center bg-stone-100 border border-stone-200 hover:border-stone-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400 rounded-full px-3 py-1 transition-all">
            <Lock size={12} className="text-emerald-600 mr-2 shrink-0" />
            <input
              ref={addressInputRef}
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search Google or enter URL (e.g. github.com)..."
              className="w-full bg-transparent text-xs text-stone-800 placeholder:text-stone-400 outline-none font-sans"
            />
            <button
              type="submit"
              title="Navigate"
              className="p-1 text-stone-400 hover:text-blue-600 transition-colors shrink-0 ml-1"
            >
              <Search size={12} />
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleOpenExternal}
            title="Open in System Default Browser (เปิดในเบราว์เซอร์หลักของเครื่อง)"
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors flex items-center gap-1 text-xs"
          >
            <ExternalLink size={13} />
            <span className="hidden md:inline text-[11px]">Open External</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-1.5 text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-800">
            <X size={12} />
          </button>
        </div>
      )}

      {/* 3. Browser Viewport Area */}
      <div 
        ref={viewportRef}
        className="flex-1 w-full h-full relative overflow-hidden bg-white"
      >
        {isTauriDesktop ? (
          /* Desktop Tauri: Background container over which native WebView2 is placed */
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50/60 text-stone-400 select-none">
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <Globe className="w-8 h-8 text-stone-300" />
              <span className="text-xs font-medium text-stone-400">{activeTab?.title || 'Loading web page...'}</span>
              <span className="text-[11px] font-mono text-stone-300 max-w-sm truncate px-4">{activeTab?.url}</span>
            </div>
          </div>
        ) : (
          /* Web Application: Informative Sandbox & Direct Portal */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-stone-50/70 text-center">
            <div className="max-w-md bg-white border border-stone-200 rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Globe size={24} />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-stone-800">
                  {activeTab?.title || 'Devtool Web Portal'}
                </h3>
                <p className="text-xs text-stone-500 break-all font-mono px-2">
                  {activeTab?.url}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 text-left flex gap-2">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  บนระบบ Web เบราว์เซอร์มีนโยบายความปลอดภัย <code>X-Frame-Options</code> ป้องกันการฝังเว็บไซต์ภายนอก สำหรับการใช้งาน Devtool แบบมัลติแท็บเต็มรูปแบบ กรุณาเปิดผ่าน <strong>QuietNotes Windows Desktop App (WebView2)</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2 w-full">
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>เปิดเว็บไซต์ในแท็บใหม่ (Open Site)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

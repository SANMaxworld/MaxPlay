import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ExternalLink, Sparkles, X, Check } from 'lucide-react';
import { NativeBridgeService } from '../../services/nativeBridgeService';

interface NativeBannerProps {
  className?: string;
  screen?: string;
}

export interface ActiveEventBannerItem {
  id?: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  themeColor?: string;
  screenBanners?: Record<string, string>;
}

export const NativeBanner: React.FC<NativeBannerProps> = ({ className = '', screen }) => {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasAdLoaded, setHasAdLoaded] = useState<boolean>(true);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // 0. Zero-Latency Instant Initial Render from Persistent Cache
  const [activeEventBanner, setActiveEventBanner] = useState<ActiveEventBannerItem | null>(() => {
    try {
      const cached = localStorage.getItem('maxplay_cached_event_banner');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.imageUrl && parsed.targetUrl) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // 1. Real-time Firebase Sync for Active Admin Custom Event Banners
  useEffect(() => {
    let unsubs: Array<() => void> = [];
    try {
      // Primary: settings/event_banners (guaranteed permissions under settings/*)
      const unsubSettings = onSnapshot(
        doc(db, 'settings', 'event_banners'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const activeBanner =
              data.activeBanner ||
              (data.active ? data : null) ||
              (Array.isArray(data.banners) ? data.banners.find((b: any) => b.active) : null);

            if (activeBanner && activeBanner.imageUrl && activeBanner.targetUrl && activeBanner.active !== false) {
              const bannerData: ActiveEventBannerItem = {
                id: activeBanner.id || 'primary_event',
                title: activeBanner.title || 'Featured Event',
                imageUrl: activeBanner.imageUrl,
                targetUrl: activeBanner.targetUrl,
                themeColor: activeBanner.themeColor || activeBanner.color || '#8B5CF6',
                screenBanners: (activeBanner.screenBanners && typeof activeBanner.screenBanners === 'object') ? activeBanner.screenBanners : undefined,
              };
              setActiveEventBanner(bannerData);
              try {
                localStorage.setItem('maxplay_cached_event_banner', JSON.stringify(bannerData));
                const preloadImg = new Image();
                preloadImg.src = bannerData.imageUrl;
              } catch {}
              return;
            }
          }

          // If settings doc doesn't have an active banner, query collection as secondary fallback
          try {
            const q = query(collection(db, 'event_banners'), where('active', '==', true));
            const unsubColl = onSnapshot(
              q,
              (snapshot) => {
                if (!snapshot.empty) {
                  const firstDoc = snapshot.docs[0].data();
                  if (firstDoc.imageUrl && firstDoc.targetUrl) {
                    const bannerData: ActiveEventBannerItem = {
                      id: snapshot.docs[0].id,
                      title: firstDoc.title || 'Featured Event',
                      imageUrl: firstDoc.imageUrl,
                      targetUrl: firstDoc.targetUrl,
                      themeColor: firstDoc.themeColor || firstDoc.color || '#8B5CF6',
                      screenBanners: (firstDoc.screenBanners && typeof firstDoc.screenBanners === 'object') ? firstDoc.screenBanners : undefined,
                    };
                    setActiveEventBanner(bannerData);
                    try {
                      localStorage.setItem('maxplay_cached_event_banner', JSON.stringify(bannerData));
                      const preloadImg = new Image();
                      preloadImg.src = bannerData.imageUrl;
                    } catch {}
                    return;
                  }
                }
                setActiveEventBanner(null);
                try {
                  localStorage.removeItem('maxplay_cached_event_banner');
                } catch {}
              },
              () => {
                setActiveEventBanner(null);
              }
            );
            unsubs.push(unsubColl);
          } catch {
            setActiveEventBanner(null);
          }
        },
        () => {
          setActiveEventBanner(null);
        }
      );
      unsubs.push(unsubSettings);
    } catch {
      setActiveEventBanner(null);
    }
    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // 2. Load Ad Provider iframe when no custom event banner is active
  useEffect(() => {
    if (user?.isPremium || activeEventBanner || !iframeRef.current) return;

    const onMessage = (e: MessageEvent) => {
      if (e.data === 'MAXPLAY_NATIVE_BANNER_EMPTY') {
        setHasAdLoaded(false);
      } else if (e.data === 'MAXPLAY_NATIVE_BANNER_READY') {
        setHasAdLoaded(true);
      }
    };
    window.addEventListener('message', onMessage);

    const timer = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; background: transparent; }
              </style>
            </head>
            <body>
              <div id="container-06b7881a58031e798d9d74f29f7f7f86"></div>
              <script type="text/javascript">
                (function() {
                  var mirrors = [
                    "profitableratecpmnetwork.com",
                    "highperformanceformat.com",
                    "highratecpm.com",
                    "topcreativeformat.com"
                  ];
                  var idx = 0;
                  function tryLoad() {
                    if (idx >= mirrors.length) {
                      try { window.parent.postMessage("MAXPLAY_NATIVE_BANNER_EMPTY", "*"); } catch (_) {}
                      return;
                    }
                    var s = document.createElement("script");
                    s.type = "text/javascript";
                    s.async = true;
                    s.setAttribute("data-cfasync", "false");
                    s.src = "https://pl31325139." + mirrors[idx] + "/06b7881a58031e798d9d74f29f7f7f86/invoke.js";
                    idx++;
                    s.onload = function() {
                      setTimeout(function() {
                        var c = document.getElementById("container-06b7881a58031e798d9d74f29f7f7f86");
                        if (c && c.innerHTML.trim().length > 0) {
                          try { window.parent.postMessage("MAXPLAY_NATIVE_BANNER_READY", "*"); } catch (_) {}
                        } else if (idx < mirrors.length) {
                          tryLoad();
                        }
                      }, 1200);
                    };
                    s.onerror = function() {
                      tryLoad();
                    };
                    document.body.appendChild(s);
                  }
                  tryLoad();
                })();
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
  }, [user?.isPremium, activeEventBanner]);

  const handleBannerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleConfirmEnterEvent = () => {
    setShowConfirmModal(false);
    if (!activeEventBanner?.targetUrl) return;
    NativeBridgeService.openExternalUrl(activeEventBanner.targetUrl);
  };

  // If a custom event banner is active, replace the ad banner!
  if (activeEventBanner) {
    const theme = activeEventBanner.themeColor || '#8B5CF6';
    const effectiveImageUrl =
      (screen && activeEventBanner.screenBanners && activeEventBanner.screenBanners[screen]?.trim())
        ? activeEventBanner.screenBanners[screen].trim()
        : activeEventBanner.imageUrl;

    return (
      <>
        <div className={`w-full flex justify-center items-center overflow-hidden my-2.5 px-3 sm:px-4 ${className}`}>
          <div
            onClick={handleBannerClick}
            style={{
              borderColor: `${theme}55`,
              boxShadow: `0 4px 20px -2px ${theme}33`,
            }}
            className="relative block w-full max-w-4xl rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] group cursor-pointer bg-[#121216]"
          >
            {/* Banner Image */}
            <img
              src={effectiveImageUrl}
              alt={activeEventBanner.title}
              className="w-full max-h-32 sm:max-h-40 object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Custom Theme Color Bottom Accent Line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[3px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme}, transparent)`,
              }}
            />

            {/* Custom Theme Color Badge */}
            <div
              className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider backdrop-blur-md flex items-center gap-1 shadow-lg border"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: theme,
                borderColor: `${theme}88`,
              }}
            >
              <Sparkles className="w-2.5 h-2.5" style={{ color: theme }} />
              <span>Event</span>
            </div>
          </div>
        </div>

        {/* Enter Event Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div
              className="relative w-full max-w-sm rounded-2xl bg-[#141418] border p-5 shadow-2xl animate-in zoom-in-95 duration-150 select-none text-left"
              style={{ borderColor: `${theme}60` }}
            >
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-3 right-3 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${theme}25`, color: theme }}
                >
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide">Enter Event</h4>
                  <p className="text-[11px] text-zinc-400">External Web Redirect</p>
                </div>
              </div>

              <p className="text-xs text-zinc-200 font-medium mb-1.5 leading-relaxed">
                Do you want to enter the event?
              </p>

              <p className="text-[11px] text-zinc-400 line-clamp-2 mb-4 bg-black/40 p-2 rounded-lg border border-white/5 break-all">
                {activeEventBanner.title || activeEventBanner.targetUrl}
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-300 transition cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnterEvent}
                  style={{
                    backgroundColor: theme,
                    boxShadow: `0 4px 14px ${theme}50`,
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white transition hover:opacity-95 active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Open in Chrome</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (user?.isPremium || !hasAdLoaded) return null;

  return (
    <div className={`w-full flex justify-center items-center overflow-hidden my-2 min-h-[60px] ${className}`}>
      <iframe
        ref={iframeRef}
        title="Advertisement"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', height: '90px', border: 'none', overflow: 'hidden' }}
        scrolling="no"
      />
    </div>
  );
};

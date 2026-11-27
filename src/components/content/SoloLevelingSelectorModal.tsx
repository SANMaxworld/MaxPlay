import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  Layers, 
  Sparkles, 
  Check, 
  X, 
  Zap, 
  Radio, 
  Crown,
  Play
} from 'lucide-react';

interface LanguageOption {
  code: string;
  name: string;
  badge?: string;
  description?: string;
}

interface SeasonOption {
  index: number;
  title: string;
  episodesCount: number;
  badge?: string;
}

interface SoloLevelingSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  type: 'language' | 'season' | 'quality' | 'server';
  selectedServer?: 'server1' | 'server2' | 'server3';
  onSelectServer?: (server: 'server1' | 'server2' | 'server3') => void;
  isAnime?: boolean;
  // Language props
  languages?: string[];
  activeLanguage?: string;
  onSelectLanguage?: (lang: string) => void;
  // Season props
  seasons?: SeasonOption[];
  selectedSeasonIndex?: number;
  onSelectSeason?: (seasonIndex: number) => void;
  // Quality props
  qualities?: string[];
  activeQuality?: string;
  onSelectQuality?: (qual: string) => void;
  // Context
  contentTitle?: string;
}

export const SoloLevelingSelectorModal: React.FC<SoloLevelingSelectorModalProps> = React.memo(({
  isOpen,
  onClose,
  triggerRef,
  type,
  selectedServer = 'server1',
  onSelectServer,
  isAnime = false,
  languages = [],
  activeLanguage = '',
  onSelectLanguage,
  seasons = [],
  selectedSeasonIndex = 0,
  onSelectSeason,
  qualities = [],
  activeQuality = 'auto',
  onSelectQuality,
  contentTitle = 'Content'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // If clicked inside the dropdown modal, do nothing
      if (modalRef.current && modalRef.current.contains(target)) {
        return;
      }
      // If clicked on or inside the trigger button that opens this modal, ignore
      // so the trigger button's own onClick can cleanly toggle it closed
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      // Also check by data attribute for safety
      if ((target as Element)?.closest?.(`[data-selector-trigger="${type}"]`)) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef, type]);

  // Helper to get formatted language metadata
  const getLanguageMeta = (lang: string): LanguageOption => {
    const l = lang.toLowerCase();
    let badge = 'ORIGINAL';
    let description = 'High Fidelity Audio';

    if (l.includes('hindi')) {
      badge = 'HINDI DUB';
      description = 'Studio Master • 5.1 Stereo';
    } else if (l.includes('jap') || l.includes('jp')) {
      badge = 'ORIGINAL JP';
      description = 'Master JP Voice • Hi-Res';
    } else if (l.includes('eng')) {
      badge = 'ENG DUB';
      description = 'English Cast • Clear Audio';
    } else if (l.includes('tamil') || l.includes('telugu')) {
      badge = 'REGIONAL DUB';
      description = 'Regional Audio Stream';
    } else if (l.includes('dual') || l.includes('multi')) {
      badge = 'MULTI AUDIO';
      description = 'Multi-Track Supported';
    }

    return {
      code: lang,
      name: lang,
      badge,
      description
    };
  };

  const getQualityMeta = (q: string) => {
    const clean = q.toLowerCase().trim();
    const baseQ = q.replace(/\s*\[(S1|S2|S3)\]/i, '').trim();

    if (clean === 'auto') {
      return { name: 'Auto (Smart Adaptive)', badge: 'ADAPTIVE', baseQ: 'auto' };
    }
    if (clean.includes('1080')) {
      return { name: '1080p Full HD', badge: 'ULTRA HD', baseQ };
    }
    if (clean.includes('720')) {
      return { name: '720p HD Ready', badge: 'BALANCED', baseQ };
    }
    if (clean.includes('480')) {
      return { name: '480p Standard', badge: 'SMOOTH', baseQ };
    }
    if (clean.includes('360')) {
      return { name: '360p Data Saver', badge: 'FAST LOAD', baseQ };
    }
    return { name: baseQ.toUpperCase(), badge: 'STREAM', baseQ };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Lightweight GPU-Composited Backdrop below the video player (no backdrop-blur over video to prevent mobile GPU stutter) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'linear' }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{ willChange: 'opacity', transform: 'translateZ(0)' }}
            className="fixed inset-x-0 bottom-0 top-[min(56.25vw,42vh)] z-[95] bg-black/65"
          />

          {/* Hardware-Accelerated Slide-up Panel anchored directly below the video player */}
          <motion.div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{
              y: 0,
              transition: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.22 }
            }}
            exit={{
              y: '100%',
              transition: { type: 'tween', ease: [0.4, 0, 1, 1], duration: 0.16 }
            }}
            style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
            className="fixed inset-x-0 bottom-0 top-[min(56.25vw,42vh)] z-[100] bg-[#101116] text-white rounded-t-2xl border-t border-white/10 shadow-2xl flex flex-col overflow-hidden select-none"
          >
            {/* Top Drag Handle & Header */}
            <div className="px-4 pt-3 pb-3 border-b border-white/10 bg-[#14151c] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  type === 'quality'
                    ? selectedServer === 'server3'
                      ? 'bg-[#E11D48]/15 border-rose-500/40 text-rose-300'
                      : selectedServer === 'server2'
                      ? 'bg-[#F59E0B]/15 border-amber-500/40 text-amber-300'
                      : 'bg-[#8B5CF6]/15 border-purple-500/40 text-purple-300'
                    : 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A855F7]'
                }`}>
                  {type === 'language' ? (
                    <Volume2 className="w-4 h-4" />
                  ) : type === 'quality' ? (
                    <Sparkles className="w-4 h-4" />
                  ) : type === 'server' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {type === 'language'
                        ? 'Select Audio Language'
                        : type === 'quality'
                        ? 'Select Video Quality'
                        : type === 'server'
                        ? 'Select Streaming Server'
                        : 'Select Season'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {type === 'server' && isAnime
                      ? 'AnimeSalt Single-Source Multi-Audio Engine'
                      : `${contentTitle} • Uploaded by MaxPlay Admin`}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition border border-white/10 cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Options List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10">
              {type === 'server' ? (
                (() => {
                  const serverOptions = isAnime
                    ? [
                        {
                          id: 'server1' as const,
                          name: '⚡ AnimeSalt (Multi-Audio HD)',
                          badge: '',
                          description: 'Single-Source Master • Multi-Audio (JP, EN, HI, TE, TA) • Full HD',
                          pill: '01',
                        },
                        {
                          id: 'server2' as const,
                          name: '🌍 AnimeWorld (Multi-Audio)',
                          badge: '',
                          description: 'High Speed CDN • Multi-Audio (JP, EN, HI, TE, TA) • Multi-Bitrate',
                          pill: '02',
                        },
                        {
                          id: 'server3' as const,
                          name: '🛡️ Server 1 (Backup)',
                          badge: '',
                          description: 'Standard Mirror • Instant Fallback Stream',
                          pill: '03',
                        },
                      ]
                    : [
                        {
                          id: 'server1' as const,
                          name: '⚡ Server 1 (Fast HLS)',
                          badge: '',
                          description: 'Ultra Low Latency Adaptive HLS Stream',
                          pill: '01',
                        },
                        {
                          id: 'server2' as const,
                          name: '🌍 Server 2 (AnimeWorld / Mirror)',
                          badge: '',
                          description: 'High-Capacity Redundant Mirror',
                          pill: '02',
                        },
                        {
                          id: 'server3' as const,
                          name: '🛡️ Server 3 (Backup)',
                          badge: '',
                          description: 'Fallback Stream Mirror',
                          pill: '03',
                        },
                      ];

                  return serverOptions.map((srv) => {
                    const isSelected = selectedServer === srv.id;
                    return (
                      <div
                        key={srv.id}
                        onClick={() => {
                          onSelectServer?.(srv.id);
                          onClose();
                        }}
                        className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-150 border flex items-center justify-between ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#8B5CF6]/20 via-[#6366F1]/15 to-transparent border-[#8B5CF6] shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                            : 'bg-[#181920] hover:bg-[#1e2029] border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                              isSelected
                                ? 'bg-gradient-to-br from-[#A855F7] to-[#6366F1] text-white shadow'
                                : 'bg-white/5 text-zinc-400 border border-white/10'
                            }`}
                          >
                            {srv.pill}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white truncate">
                                {srv.name}
                              </span>
                              {srv.badge ? (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                    isSelected
                                      ? 'bg-[#8B5CF6]/25 text-purple-200 border border-[#8B5CF6]/50'
                                      : 'bg-white/5 text-zinc-400 border border-white/10'
                                  }`}
                                >
                                  {srv.badge}
                                </span>
                              ) : null}
                              {isSelected && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-white/80 border border-white/15">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 truncate">{srv.description}</p>
                          </div>
                        </div>

                        <div className="shrink-0 ml-3">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-[#A855F7] bg-[#A855F7] text-white'
                                : 'border-zinc-500 bg-transparent'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : type === 'language' ? (
                (() => {
                  const rawList = languages.length > 0 ? languages : [activeLanguage || 'Hindi'];
                  const cleanBase = (s: string) => s.replace(/\[.*?\]|\(.*?\)/g, '').trim().toLowerCase();
                  const seen = new Set<string>();
                  const uniqueLanguages = rawList.filter(l => {
                    const b = cleanBase(l);
                    if (!b || seen.has(b)) return false;
                    seen.add(b);
                    return true;
                  });
                  return uniqueLanguages.map((lang, index) => {
                    const meta = getLanguageMeta(lang);
                    const cleanCur = (activeLanguage || '').replace(/\[.*?\]|\(.*?\)/g, '').trim().toLowerCase();
                    const cleanTarget = lang.replace(/\[.*?\]|\(.*?\)/g, '').trim().toLowerCase();
                    const isSelected = cleanCur === cleanTarget || activeLanguage.toLowerCase() === lang.toLowerCase();

                  return (
                    <div
                      key={lang}
                      onClick={() => {
                        onSelectLanguage?.(lang);
                        onClose();
                      }}
                      className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-150 border flex items-center justify-between ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#8B5CF6]/20 via-[#6366F1]/15 to-transparent border-[#8B5CF6] shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                          : 'bg-[#181920] hover:bg-[#1e2029] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-br from-[#A855F7] to-[#6366F1] text-white shadow'
                              : 'bg-white/5 text-zinc-400 border border-white/10'
                          }`}
                        >
                          0{index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {meta.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                isSelected
                                  ? 'bg-[#8B5CF6]/25 text-purple-200 border border-[#8B5CF6]/50'
                                  : 'bg-white/5 text-zinc-400 border border-white/10'
                              }`}
                            >
                              {meta.badge}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">{meta.description}</p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-[#A855F7] bg-[#A855F7] text-white'
                              : 'border-zinc-500 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              })()
              ) : type === 'quality' ? (
                (() => {
                  const currentQualities = qualities.filter(q => !q.match(/\[(S1|S2|S3)\]/i));

                  const activeTheme = {
                    border: 'border-[#8B5CF6]',
                    bg: 'bg-gradient-to-r from-[#8B5CF6]/20 via-[#6366F1]/15 to-transparent',
                    shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.25)]',
                    pill: 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white border-purple-300/60',
                    badge: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
                    check: 'border-[#8B5CF6] bg-[#8B5CF6] text-white',
                  };

                  return (
                    <div className="space-y-2.5">
                      <div className="px-1 py-0.5 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-white/90 uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                          Stream Qualities
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">Instant Switch</span>
                      </div>

                      {currentQualities.map((q, index) => {
                        const meta = getQualityMeta(q);
                        const isSelected = (activeQuality || 'auto').toLowerCase() === meta.baseQ.toLowerCase();

                        return (
                          <div
                            key={q}
                            onClick={() => {
                              onSelectQuality?.(q);
                              onClose();
                            }}
                            className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-150 border flex items-center justify-between ${
                              isSelected
                                ? `${activeTheme.bg} ${activeTheme.border} ${activeTheme.shadow}`
                                : 'bg-[#181920] hover:bg-[#1e2029] border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                                  isSelected
                                    ? activeTheme.pill
                                    : 'bg-white/5 text-zinc-400 border border-white/10'
                                }`}
                              >
                                {q.toLowerCase() === 'auto' ? 'AI' : `0${index}`}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-white truncate">
                                    {meta.name}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                      isSelected
                                        ? activeTheme.badge
                                        : 'bg-white/5 text-zinc-400 border border-white/10'
                                    }`}
                                  >
                                    {meta.badge}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-white/80 border border-white/15">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 ml-3">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? activeTheme.check
                                    : 'border-zinc-500 bg-transparent'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                seasons.map((season) => {
                  const isSelected = selectedSeasonIndex === season.index;

                  return (
                    <div
                      key={season.index}
                      onClick={() => {
                        onSelectSeason?.(season.index);
                        onClose();
                      }}
                      className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-150 border flex items-center justify-between ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#8B5CF6]/20 via-[#6366F1]/15 to-transparent border-[#8B5CF6] shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                          : 'bg-[#181920] hover:bg-[#1e2029] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-br from-[#A855F7] to-[#6366F1] text-white shadow'
                              : 'bg-white/5 text-zinc-400 border border-white/10'
                          }`}
                        >
                          S{season.index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {season.title}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              ({season.episodesCount} Episodes)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-[#A855F7] bg-[#A855F7] text-white'
                              : 'border-zinc-500 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

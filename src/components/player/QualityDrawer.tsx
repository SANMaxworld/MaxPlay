import React, { useRef } from 'react';
import { Check, X, ShieldCheck, Sparkles, Zap, ChevronRight } from 'lucide-react';
import { NativeBridgeService } from '../../services/nativeBridgeService';

interface QualityDrawerProps {
  visible: boolean;
  currentQuality: string; // '480p' | '720p' | '1080p' | '360p'
  availableQualities: string[];
  isAutoMode?: boolean;
  actualQuality?: string;
  selectedServer?: 'server1' | 'server2' | 'server3';
  onSelectQuality: (quality: string) => void;
  onClose: () => void;
}

export const QualityDrawer: React.FC<QualityDrawerProps> = React.memo(({
  visible,
  currentQuality,
  availableQualities,
  isAutoMode = false,
  actualQuality,
  selectedServer = 'server1',
  onSelectQuality,
  onClose,
}) => {
  if (!visible) return null;

  const getQualityBadge = (q: string) => {
    const lower = q.toLowerCase();
    if (lower.includes('1080')) return { label: 'Full HD', color: 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/40' };
    if (lower.includes('720')) return { label: 'HD', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    if (lower.includes('480')) return { label: 'SD', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    if (lower.includes('360')) return { label: 'Fast Load', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    return { label: 'Auto', color: 'bg-zinc-700/50 text-zinc-300 border-zinc-600' };
  };

  const activeColor = { text: 'text-[#8B5CF6]', border: 'border-[#8B5CF6]/50', bg: 'bg-[#8B5CF6]/20', check: 'text-[#8B5CF6]' };

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    // Swipe right or down to dismiss
    if (deltaX > 45 || deltaY > 65) {
      NativeBridgeService.triggerHaptic('light');
      onClose();
    }
  };

  const handleSelect = (q: string) => {
    NativeBridgeService.triggerHaptic('medium');
    onSelectQuality(q);
  };

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex justify-end bg-black/65 transition-opacity duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex h-full w-[260px] sm:w-[280px] flex-col bg-[#121216] p-4 border-l border-[#1C1C1E] shadow-2xl animate-in slide-in-from-right duration-200 select-none"
      >
        <div className="flex items-center justify-between border-b border-[#1C1C1E] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${activeColor.text}`} />
            <h3 className="text-sm font-bold text-white tracking-wide">Video Quality</h3>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 font-medium hidden sm:inline">Swipe ➔</span>
            <button
              onClick={() => {
                NativeBridgeService.triggerHaptic('light');
                onClose();
              }}
              className="p-1 rounded-full text-[#A1A1AA] hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close quality selector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto py-1">
          {(() => {
            const rawSpecific = availableQualities.filter((q) => q.toLowerCase() !== 'auto');
            const specificQualities = rawSpecific.length > 0 ? rawSpecific : ['1080p', '720p', '480p', '360p', '240p'];
            
            // Scenario 1: Only a Single Quality exists
            if (specificQualities.length === 1) {
              const singleQ = specificQualities[0];
              const badge = getQualityBadge(singleQ);
              return (
                <div className="flex flex-col gap-2">
                  <div className="px-2 py-1 text-[11px] font-semibold text-[#A1A1AA] flex items-center justify-between">
                    <span>Source Quality</span>
                    <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded">Single Quality</span>
                  </div>
                  <button
                    onClick={() => {
                      handleSelect(singleQ);
                      onClose();
                    }}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer border ${activeColor.bg} ${activeColor.border} text-white shadow-md`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-extrabold tracking-wide">{singleQ.toUpperCase()}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <Check className={`h-4 w-4 ${activeColor.check}`} />
                  </button>
                </div>
              );
            }

            // Scenario 2: Multiple Qualities exist (Auto + All options)
            if (specificQualities.length > 1) {
              return (
                <>
                  {/* Auto Quality Option */}
                  <button
                    onClick={() => {
                      handleSelect('auto');
                      onClose();
                    }}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer border ${
                      isAutoMode
                        ? `${activeColor.bg} ${activeColor.border} text-white shadow-md`
                        : 'border-transparent text-[#A1A1AA] hover:bg-[#1C1C1E] hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold tracking-wide">AUTO</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${activeColor.bg} text-[#C4B5FD] ${activeColor.border} flex items-center gap-1`}>
                          <Zap className="h-2.5 w-2.5 text-amber-400" />
                          Fast Start & Adaptive
                        </span>
                      </div>
                      {isAutoMode && actualQuality && (
                        <span className="text-[10px] font-medium text-[#A1A1AA]">
                          Current Stream: <span className="text-white uppercase font-bold">{actualQuality}</span>
                        </span>
                      )}
                    </div>
                    {isAutoMode && <Check className={`h-4 w-4 ${activeColor.check}`} />}
                  </button>

                  <div className="my-1 border-t border-white/5" />

                  {specificQualities.map((q) => {
                    const serverMatch = q.match(/\[(S1|S2|S3)\]/i);
                    const serverTag = serverMatch ? (serverMatch[1].toUpperCase() as 'S1' | 'S2' | 'S3') : null;
                    const baseQ = q.replace(/\s*\[(S1|S2|S3)\]/i, '').trim();
                    const isActive = !serverTag && !isAutoMode && currentQuality.toLowerCase() === baseQ.toLowerCase();
                    const badge = getQualityBadge(baseQ);

                    return (
                      <button
                        key={q}
                        onClick={() => {
                          handleSelect(q);
                          onClose();
                        }}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer border ${
                          isActive
                            ? `${activeColor.bg} ${activeColor.border} text-white shadow-md`
                            : serverTag === 'S1'
                            ? 'border-purple-500/40 bg-gradient-to-r from-[#8B5CF6]/15 to-transparent text-white hover:from-[#8B5CF6]/25'
                            : serverTag === 'S2'
                            ? 'border-rose-500/40 bg-gradient-to-r from-[#E11D48]/15 to-transparent text-white hover:from-[#E11D48]/25'
                            : serverTag === 'S3'
                            ? 'border-amber-500/40 bg-gradient-to-r from-[#F59E0B]/15 to-transparent text-white hover:from-[#F59E0B]/25'
                            : 'border-transparent text-[#A1A1AA] hover:bg-[#1C1C1E] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {serverTag && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black border shadow-sm ${
                                serverTag === 'S1'
                                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white border-purple-300/50'
                                  : serverTag === 'S2'
                                  ? 'bg-gradient-to-r from-[#E11D48] to-[#9F1239] text-white border-rose-300/50'
                                  : 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-black border-amber-300/60'
                              }`}
                            >
                              {serverTag}
                            </span>
                          )}
                          <span className="text-sm font-extrabold tracking-wide">{baseQ.toUpperCase()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        {isActive ? (
                          <Check className={`h-4 w-4 ${activeColor.check}`} />
                        ) : serverTag ? (
                          <span className={`text-[9px] font-bold ${serverTag === 'S1' ? 'text-purple-300' : serverTag === 'S2' ? 'text-rose-300' : 'text-amber-300'}`}>
                            Switch {serverTag}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </>
              );
            }

            // Scenario 3: No discrete qualities detected (Default Auto stream)
            return (
              <button
                onClick={() => {
                  handleSelect('auto');
                  onClose();
                }}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer border bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-white shadow-md shadow-purple-500/10"
              >
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-wide">AUTO</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-[#8B5CF6]/20 text-[#C4B5FD] border-[#8B5CF6]/40 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5 text-amber-400" />
                      Default Stream
                    </span>
                  </div>
                  {actualQuality && (
                    <span className="text-[10px] font-medium text-[#A1A1AA]">
                      Current Stream: <span className="text-white uppercase font-bold">{actualQuality}</span>
                    </span>
                  )}
                </div>
                <Check className="h-4 w-4 text-[#8B5CF6]" />
              </button>
            );
          })()}
        </div>

        <div className="mt-auto pt-3 border-t border-[#1C1C1E] flex items-center justify-center gap-1.5 text-[10px] text-[#71717A]">
          <Sparkles className="h-3 w-3 text-[#8B5CF6]" />
          <span>Auto selects lowest on start for 0-lag play</span>
        </div>
      </div>
    </div>
  );
});

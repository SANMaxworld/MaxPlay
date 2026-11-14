import React, { useState } from 'react';
import { Heart, Music2, Pause, Play, SkipForward, X } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';

interface MiniMusicPlayerProps {
  hasBottomNav?: boolean;
}

export const MiniMusicPlayer: React.FC<MiniMusicPlayerProps> = ({ hasBottomNav = true }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isFullScreenPlayerOpen,
    setIsFullScreenPlayerOpen,
    togglePlayPause,
    playNextTrack,
    toggleFavorite,
    clearQueue,
  } = useMusic();

  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  if (!currentTrack || isFullScreenPlayerOpen) return null;

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const showArt = Boolean(currentTrack.artworkUrl && !imgFailed[currentTrack.id]);

  return (
    <div
      className={`fixed left-2.5 right-2.5 md:left-[92px] md:right-4 z-[85] transition-all duration-300 select-none ${
        hasBottomNav ? 'bottom-[72px] md:bottom-3' : 'bottom-3'
      }`}
    >
      <div
        onClick={() => setIsFullScreenPlayerOpen(true)}
        className="relative overflow-hidden rounded-2xl bg-[#141418]/95 backdrop-blur-xl border border-[#8E2DE2]/35 shadow-[0_12px_36px_rgba(106,17,203,0.42)] px-3 py-2.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
      >
        {/* Subtle ambient purple sheen */}
        <div className="pointer-events-none absolute -left-8 -top-8 w-28 h-28 rounded-full bg-[#6A11CB]/25 blur-2xl" />

        {/* Artwork or MaxPlay Purple Fallback */}
        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[#6A11CB] via-[#8E2DE2] to-[#1C1C22] border border-white/15 flex items-center justify-center shadow-md">
          {showArt ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={() =>
                setImgFailed((prev) => ({ ...prev, [currentTrack.id]: true }))
              }
            />
          ) : (
            <Music2 className="w-5 h-5 text-white drop-shadow" />
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-end justify-center gap-0.5 pb-1.5">
              <span className="w-0.5 h-2.5 bg-[#B517FF] rounded-full animate-pulse" />
              <span className="w-0.5 h-3.5 bg-white rounded-full animate-bounce" />
              <span className="w-0.5 h-2 bg-[#8E2DE2] rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-tight">
            {currentTrack.title}
          </p>
          <p className="text-[11px] font-medium text-[#A1A1AA] truncate mt-0.5">
            {currentTrack.artist}
            {currentTrack.album && currentTrack.album !== 'Unknown Album'
              ? ` • ${currentTrack.album}`
              : ''}
          </p>
        </div>

        {/* Controls */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleFavorite(currentTrack.id)}
            aria-label="Favorite Song"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-300 hover:text-white active:scale-90 transition-transform"
          >
            <Heart
              className={`w-4 h-4 ${
                currentTrack.isFavorite
                  ? 'fill-[#B517FF] text-[#B517FF]'
                  : 'text-zinc-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6A11CB] to-[#8E2DE2] text-white flex items-center justify-center shadow-[0_0_14px_rgba(142,45,226,0.55)] active:scale-90 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextTrack}
            aria-label="Next Track"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform"
          >
            <SkipForward className="w-4 h-4 fill-white" />
          </button>

          <button
            type="button"
            onClick={clearQueue}
            aria-label="Close Mini Player"
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-transform"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Progress Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

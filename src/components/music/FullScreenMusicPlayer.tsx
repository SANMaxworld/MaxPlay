import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Disc3,
  Gauge,
  Heart,
  Info,
  ListMusic,
  MoreVertical,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Speaker,
  Trash2,
  X,
} from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { formatMusicDuration } from '../../utils/musicUtils';
import { SleepTimerMode } from '../../types/music';

export const FullScreenMusicPlayer: React.FC = () => {
  const {
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    repeatMode,
    isShuffle,
    isFullScreenPlayerOpen,
    setIsFullScreenPlayerOpen,
    sleepTimerMode,
    sleepTimerRemainingSec,
    activeQueueSourceLabel,
    settings,
    playlists,
    togglePlayPause,
    playNextTrack,
    playPreviousTrack,
    seekTo,
    setPlaybackSpeed,
    cycleRepeatMode,
    toggleShuffle,
    setSleepTimer,
    toggleFavorite,
    removeFromQueueIndex,
    moveQueueItem,
    clearQueue,
    jumpToQueueIndex,
    createPlaylist,
    addTracksToPlaylist,
  } = useMusic();

  const [artFailed, setArtFailed] = useState<Record<string, boolean>>({});
  const [activeSheet, setActiveSheet] = useState<
    null | 'queue' | 'sleep' | 'speed' | 'info' | 'menu' | 'playlist'
  >(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const effectiveDuration = duration || currentTrack.durationSec || 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;
  const hasArt = Boolean(currentTrack.artworkUrl && !artFailed[currentTrack.id]);

  const sleepOptions: { label: string; value: SleepTimerMode }[] = [
    { label: 'Off', value: 'off' },
    { label: '5 minutes', value: '5' },
    { label: '10 minutes', value: '10' },
    { label: '15 minutes', value: '15' },
    { label: '30 minutes', value: '30' },
    { label: '45 minutes', value: '45' },
    { label: '60 minutes', value: '60' },
    { label: 'End of current song', value: 'end_of_song' },
  ];

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="fixed inset-0 z-[130] bg-[#0A0A0C] text-white flex flex-col justify-between overflow-hidden select-none animate-in fade-in slide-in-from-bottom-4 duration-250">
      {/* Ambient Purple Obsidian Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full bg-gradient-to-br from-[#6A11CB]/35 via-[#8E2DE2]/25 to-[#B517FF]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/90 to-transparent" />

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[150] bg-[#1C1C22] border border-[#8E2DE2]/50 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* 1. Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2">
        <button
          type="button"
          onClick={() => setIsFullScreenPlayerOpen(false)}
          aria-label="Minimize Player"
          className="w-10 h-10 rounded-full bg-[#141418] border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center min-w-0 px-3">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#B517FF]">
            NOW PLAYING
          </span>
          <span className="text-xs font-semibold text-[#A1A1AA] truncate max-w-[200px] mt-0.5">
            {activeQueueSourceLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setActiveSheet('menu')}
          aria-label="Track Options"
          className="w-10 h-10 rounded-full bg-[#141418] border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Center Artwork Section */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-7 py-2 min-h-0">
        <div
          className={`relative w-full max-w-[300px] aspect-square overflow-hidden border border-white/15 shadow-[0_24px_64px_rgba(106,17,203,0.45)] transition-transform duration-500 ${
            settings.artworkRounded === 'square' ? 'rounded-xl' : 'rounded-3xl'
          } ${isPlaying ? 'scale-100' : 'scale-[0.96]'}`}
        >
          {hasArt ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={() =>
                setArtFailed((prev) => ({ ...prev, [currentTrack.id]: true }))
              }
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1C1C22] via-[#231338] to-[#0A0A0C] flex flex-col items-center justify-center p-6 relative">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] flex items-center justify-center shadow-[0_0_40px_rgba(181,23,255,0.5)]">
                <Disc3
                  className={`w-14 h-14 text-white ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '8s' }}
                />
              </div>
              <span className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-purple-300/80">
                MaxPlay Audio
              </span>
              <span className="mt-1 text-[10px] font-semibold text-zinc-400">
                {currentTrack.format || 'MP3'} • Local Lossless Engine
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Song Info + Progress + Main & Secondary Controls */}
      <div className="relative z-10 px-6 pb-7 pt-2 space-y-5">
        {/* Song Title, Artist, Album & Favorite Heart */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <p className="text-sm font-semibold text-[#A1A1AA] truncate mt-1">
              {currentTrack.artist}
              {currentTrack.album && currentTrack.album !== 'Unknown Album'
                ? ` • ${currentTrack.album}`
                : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleFavorite(currentTrack.id)}
            aria-label="Toggle Favorite"
            className="w-11 h-11 rounded-full bg-[#141418] border border-white/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                currentTrack.isFavorite
                  ? 'fill-[#B517FF] text-[#B517FF]'
                  : 'text-zinc-400'
              }`}
            />
          </button>
        </div>

        {/* Interactive Progress Seek Bar */}
        <div className="space-y-1.5">
          <div className="relative w-full h-5 flex items-center">
            <div className="w-full h-1.5 bg-[#1C1C22] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6A11CB] via-[#8E2DE2] to-[#B517FF]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 100}
              step={0.5}
              value={Math.min(currentTime, effectiveDuration || 100)}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label="Seek Audio Position"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_#B517FF] -ml-1.5"
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-[#A1A1AA]">
            <span>{formatMusicDuration(currentTime)}</span>
            <span>{formatMusicDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label="Shuffle"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isShuffle
                ? 'text-[#B517FF] bg-[#8E2DE2]/15'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={playPreviousTrack}
            aria-label="Previous Track"
            className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <SkipBack className="w-7 h-7 fill-white" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] text-white flex items-center justify-center shadow-[0_10px_30px_rgba(142,45,226,0.65)] active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextTrack}
            aria-label="Next Track"
            className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <SkipForward className="w-7 h-7 fill-white" />
          </button>

          <button
            type="button"
            onClick={cycleRepeatMode}
            aria-label="Repeat Mode"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              repeatMode !== 'off'
                ? 'text-[#B517FF] bg-[#8E2DE2]/15'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Secondary Controls Row */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveSheet('queue')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] text-xs font-bold text-zinc-200 transition-colors"
          >
            <ListMusic className="w-4 h-4 text-[#B517FF]" />
            <span>Queue ({queue.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('sleep')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              sleepTimerMode !== 'off'
                ? 'bg-[#6A11CB]/30 border border-[#B517FF]/50 text-white'
                : 'bg-[#141418] hover:bg-[#1C1C22] text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4 text-[#B517FF]" />
            <span>
              {sleepTimerMode === 'off'
                ? 'Sleep'
                : sleepTimerMode === 'end_of_song'
                ? 'End of Song'
                : sleepTimerRemainingSec !== null
                ? formatMusicDuration(sleepTimerRemainingSec)
                : `${sleepTimerMode}m`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('speed')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] text-xs font-bold text-zinc-200 transition-colors"
          >
            <Gauge className="w-4 h-4 text-[#B517FF]" />
            <span>{playbackSpeed}x</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('info')}
            aria-label="Song Information"
            className="p-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] text-zinc-200 transition-colors"
          >
            <Info className="w-4 h-4 text-[#B517FF]" />
          </button>
        </div>
      </div>

      {/* SHEET 1: UP NEXT QUEUE MANAGEMENT */}
      {activeSheet === 'queue' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full max-h-[82vh] bg-[#141418] border-t border-white/15 rounded-t-3xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-white">Playing Queue</h3>
                <p className="text-xs text-[#A1A1AA]">
                  {queue.length} songs • {activeQueueSourceLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const pl = createPlaylist(
                        `Queue ${new Date().toLocaleDateString()}`,
                        queue.map((t) => t.id)
                      );
                      showToast(`Saved "${pl.name}" to Playlists`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#6A11CB]/30 border border-[#8E2DE2]/50 text-xs font-bold text-purple-200"
                  >
                    Save as Playlist
                  </button>
                )}
                {queue.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearQueue();
                      setActiveSheet(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-300"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSheet(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 px-3 py-2">
              {queue.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={`${item.id}_${idx}`}
                    onClick={() => jumpToQueueIndex(idx)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isCurrent ? 'bg-[#6A11CB]/25 border border-[#8E2DE2]/40' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-7 text-center text-xs font-mono font-bold text-[#A1A1AA]">
                      {isCurrent ? (
                        <Music2 className="w-4 h-4 text-[#B517FF] mx-auto animate-pulse" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold truncate ${
                          isCurrent ? 'text-[#B517FF]' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-[#A1A1AA] truncate">
                        {item.artist} • {formatMusicDuration(item.durationSec)}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveQueueItem(idx, idx - 1)}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === queue.length - 1}
                        onClick={() => moveQueueItem(idx, idx + 1)}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromQueueIndex(idx)}
                        className="p-1.5 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 2: SLEEP TIMER */}
      {activeSheet === 'sleep' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">Sleep Timer</h3>
                <p className="text-xs text-[#A1A1AA]">
                  Automatically pause music playback after timer ends
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {sleepOptions.map((opt) => {
                const active = sleepTimerMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSleepTimer(opt.value);
                      setActiveSheet(null);
                      showToast(
                        opt.value === 'off'
                          ? 'Sleep timer turned off'
                          : `Sleep timer set: ${opt.label}`
                      );
                    }}
                    className={`px-4 py-3 rounded-xl text-left text-xs font-bold border transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#6A11CB]/40 to-[#8E2DE2]/40 border-[#B517FF] text-white'
                        : 'bg-[#1C1C22] border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 3: PLAYBACK SPEED */}
      {activeSheet === 'speed' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Playback Speed</h3>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {speedOptions.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setPlaybackSpeed(sp);
                    setActiveSheet(null);
                  }}
                  className={`py-3 rounded-xl text-xs font-extrabold border ${
                    playbackSpeed === sp
                      ? 'bg-[#6A11CB] border-[#B517FF] text-white'
                      : 'bg-[#1C1C22] border-white/10 text-zinc-300'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 4: SONG INFORMATION DIALOG */}
      {activeSheet === 'info' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#B517FF]" />
                <h3 className="text-base font-extrabold text-white">Song Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">Song Name</span>
                <span className="font-bold text-white text-right">{currentTrack.title}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">Artist</span>
                <span className="font-bold text-white text-right">{currentTrack.artist}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">Album</span>
                <span className="font-bold text-white text-right">{currentTrack.album}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">Duration</span>
                <span className="font-bold text-white">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">Audio Format</span>
                <span className="font-bold text-[#B517FF]">
                  {currentTrack.format || 'MP3'} ({currentTrack.mimeType})
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A1A1AA]">File Size</span>
                <span className="font-bold text-white">{currentTrack.sizeMb} MB</span>
              </div>
              <div className="flex flex-col gap-1 py-1.5">
                <span className="text-[#A1A1AA]">File Path</span>
                <span className="font-mono text-[11px] text-zinc-300 bg-[#1C1C22] px-3 py-2 rounded-xl break-all">
                  {currentTrack.folderPath}/{currentTrack.fileName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHEET 5: 3-DOT OPTIONS MENU */}
      {activeSheet === 'menu' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-[#A1A1AA] truncate">{currentTrack.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveSheet('playlist')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4 text-[#B517FF]" />
              <span>Add to Playlist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleFavorite(currentTrack.id);
                setActiveSheet(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-sm font-semibold text-white"
            >
              <Heart className="w-4 h-4 text-[#B517FF]" />
              <span>
                {currentTrack.isFavorite ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('sleep')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-sm font-semibold text-white"
            >
              <Clock className="w-4 h-4 text-[#B517FF]" />
              <span>Sleep Timer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('info')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-sm font-semibold text-white"
            >
              <Info className="w-4 h-4 text-[#B517FF]" />
              <span>Song Information</span>
            </button>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1C1C22]/60 text-xs text-[#A1A1AA]">
              <Speaker className="w-4 h-4 text-[#B517FF]" />
              <span>Audio Output: Local Hardware Speaker / Active Headset</span>
            </div>
          </div>
        </div>
      )}

      {/* SHEET 6: ADD TO PLAYLIST */}
      {activeSheet === 'playlist' && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Add to Playlist</h3>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 bg-[#1C1C22] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B517FF]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPlaylistName.trim()) return;
                  const created = createPlaylist(newPlaylistName, [currentTrack.id]);
                  setNewPlaylistName('');
                  setActiveSheet(null);
                  showToast(`Added to "${created.name}"`);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white"
              >
                Create
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    addTracksToPlaylist(pl.id, [currentTrack.id]);
                    setActiveSheet(null);
                    showToast(`Added to "${pl.name}"`);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1C1C22] hover:bg-white/10 text-left"
                >
                  <span className="text-sm font-bold text-white">{pl.name}</span>
                  <span className="text-xs text-[#A1A1AA]">{pl.trackIds.length} songs</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

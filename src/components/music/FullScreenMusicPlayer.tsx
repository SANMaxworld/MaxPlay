import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  Clock,
  Disc3,
  FastForward,
  Heart,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListMusic,
  ListPlus,
  MinusCircle,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Scissors,
  Share2,
  Shirt,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { SleepTimerMode } from '../../types/music';
import { formatMusicDuration } from '../../utils/musicUtils';
import { NativeBridgeService } from '../../services/nativeBridgeService';
import { useGeneralSettings } from '../../hooks/useGeneralSettings';

type ActivePlayerModal =
  | null
  | 'three_dot_menu'
  | 'queue'
  | 'sleep_timer'
  | 'speed'
  | 'add_to_playlist'
  | 'ringtone_editor'
  | 'edit_song_info'
  | 'album_cover'
  | 'home_widget'
  | 'song_info';

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
    setIsEqualizerOpen,
    equalizer,
    sleepTimerMode,
    sleepTimerRemainingSec,
    activeQueueSourceLabel,
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
    updateSongMetadata,
    removeFromQueueIndex,
    moveQueueItem,
    clearQueue,
    jumpToQueueIndex,
    createPlaylist,
    addTracksToPlaylist,
  } = useMusic();

  const { shareDownloadUrl, apkDownloadUrl } = useGeneralSettings();

  const [activeModal, setActiveModal] = useState<ActivePlayerModal>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [playerSkin, setPlayerSkin] = useState<'purple' | 'warm' | 'midnight'>('purple');
  const [toastText, setToastText] = useState<string | null>(null);

  // Edit Song Info form states
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editArtworkUrl, setEditArtworkUrl] = useState('');
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  // Ringtone Editor states
  const [ringStartSec, setRingStartSec] = useState(0);
  const [ringEndSec, setRingEndSec] = useState(30);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 2600);
  };

  useEffect(() => {
    if (currentTrack) {
      setEditTitle(currentTrack.title);
      setEditArtist(currentTrack.artist);
      setEditAlbum(currentTrack.album);
      setEditArtworkUrl(currentTrack.artworkUrl || '');
      const dur = Math.max(10, Math.floor(duration || currentTrack.durationSec || 30));
      setRingStartSec(0);
      setRingEndSec(Math.min(30, dur));
    }
  }, [currentTrack, duration]);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const effectiveDuration = duration > 0 ? duration : currentTrack.durationSec || 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;
  const showArt = Boolean(currentTrack.artworkUrl && !imgFailed[currentTrack.id]);

  const sleepOptions: { mode: SleepTimerMode; label: string }[] = [
    { mode: 'off', label: 'Off' },
    { mode: '5', label: '5 minutes' },
    { mode: '10', label: '10 minutes' },
    { mode: '15', label: '15 minutes' },
    { mode: '30', label: '30 minutes' },
    { mode: '45', label: '45 minutes' },
    { mode: '60', label: '60 minutes' },
    { mode: 'end_of_song', label: 'End of current track' },
  ];

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const handleShareSong = async () => {
    const appLink =
      (shareDownloadUrl && shareDownloadUrl.trim()) ||
      (apkDownloadUrl && apkDownloadUrl.trim()) ||
      window.location.origin;
    const shareMessage = `🎵 Listening to "${currentTrack.title}" by ${currentTrack.artist} on MaxPlay Music!\n\nDownload MaxPlay App:\n${appLink}`;

    if (NativeBridgeService.isRunningInKotlinApp()) {
      NativeBridgeService.shareContentNative(currentTrack.title, shareMessage, appLink);
      setActiveModal(null);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: shareMessage,
        });
        setActiveModal(null);
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareMessage);
      showToast('Song share link copied to clipboard!');
    } catch {}
    setActiveModal(null);
  };

  const handleCoverFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditArtworkUrl(reader.result);
        updateSongMetadata(currentTrack.id, { artworkUrl: reader.result });
        setImgFailed((prev) => ({ ...prev, [currentTrack.id]: false }));
        showToast('Album cover updated!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const skinBackdrop =
    playerSkin === 'warm'
      ? 'from-[#7C2D12]/35 via-[#431407]/20 to-transparent'
      : playerSkin === 'midnight'
      ? 'from-[#1E3A8A]/35 via-[#172554]/20 to-transparent'
      : 'from-[#6A11CB]/35 via-[#8E2DE2]/15 to-transparent';

  return (
    <div
      data-testid="fullscreen-music-player"
      className="fixed inset-0 z-[105] bg-[#0A0A0C] text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Hidden Cover File Picker */}
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFilePick}
      />

      {/* Ambient Atmospheric Glow */}
      <div
        className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-gradient-to-b ${skinBackdrop} blur-3xl`}
      />

      {/* Toast Notice */}
      {toastText && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[150] px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold shadow-xl">
          {toastText}
        </div>
      )}

      {/* Top Bar matching music_page_three_dot_settings screenshot */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          aria-label="Minimize Player"
          onClick={() => setIsFullScreenPlayerOpen(false)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center min-w-0 px-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#B517FF]">
            NOW PLAYING
          </span>
          <span className="text-xs font-semibold text-zinc-300 truncate max-w-[180px]">
            {activeQueueSourceLabel}
          </span>
        </div>

        {/* Right Header Icons: Theme Shirt, Equaliser Sliders, 3-Dot Menu */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Switch Player Theme"
            onClick={() => {
              const next =
                playerSkin === 'purple'
                  ? 'warm'
                  : playerSkin === 'warm'
                  ? 'midnight'
                  : 'purple';
              setPlayerSkin(next);
              showToast(`Player theme: ${next.toUpperCase()}`);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <Shirt className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Open Equaliser"
            onClick={() => setIsEqualizerOpen(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition cursor-pointer ${
              equalizer.enabled ? 'text-[#B517FF]' : 'text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Track Options"
            onClick={() => setActiveModal('three_dot_menu')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Large Album Artwork */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-7 py-2 min-h-0">
        <div className="relative w-full max-w-[310px] aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-[#2A124C] via-[#15151C] to-[#0E0E12] border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.75)] flex items-center justify-center">
          {showArt ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() =>
                setImgFailed((prev) => ({ ...prev, [currentTrack.id]: true }))
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#6A11CB] to-[#B517FF] flex items-center justify-center shadow-[0_0_40px_rgba(181,23,255,0.5)] mb-4">
                <Disc3
                  className={`w-12 h-12 text-white ${
                    isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                  }`}
                />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-purple-300/80">
                MaxPlay Audio
              </span>
              <span className="text-[11px] text-zinc-400 mt-1">
                {currentTrack.format || 'MP3'} • Local Lossless Engine
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Area */}
      <div className="relative z-10 px-6 pb-7 pt-2 flex flex-col gap-4 max-w-xl mx-auto w-full">
        {/* Title, Artist & Favorite Heart */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate">
              {currentTrack.title}
            </h2>
            <p className="text-sm text-[#A0A0AB] truncate mt-0.5">
              {currentTrack.artist} • {currentTrack.album}
            </p>
          </div>

          <button
            type="button"
            aria-label="Toggle Favorite"
            onClick={() => toggleFavorite(currentTrack.id)}
            className={`w-11 h-11 rounded-full flex items-center justify-center border transition cursor-pointer ${
              currentTrack.isFavorite
                ? 'bg-[#B517FF]/20 border-[#B517FF]/50 text-[#B517FF]'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Heart
              className={`w-5 h-5 ${currentTrack.isFavorite ? 'fill-[#B517FF]' : ''}`}
            />
          </button>
        </div>

        {/* Interactive Seek Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="relative w-full h-6 flex items-center">
            <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              aria-label="Seek Audio Position"
              min={0}
              max={effectiveDuration || 100}
              step={0.5}
              value={Math.min(currentTime, effectiveDuration || 100)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_#B517FF] border-2 border-[#8E2DE2]"
              style={{ left: `calc(${progressPct}% - 7px)` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-[#A0A0AB] tabular-nums">
            <span>{formatMusicDuration(currentTime)}</span>
            <span>{formatMusicDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Primary Transport Row: Shuffle | Previous | Play/Pause | Next | Repeat */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Shuffle"
            onClick={toggleShuffle}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              isShuffle
                ? 'text-[#B517FF] bg-[#8E2DE2]/15'
                : 'text-[#A0A0AB] hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Previous Track"
            onClick={playPreviousTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlayPause}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] text-white flex items-center justify-center shadow-[0_0_30px_rgba(142,45,226,0.65)] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            aria-label="Next Track"
            onClick={playNextTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            aria-label="Repeat Mode"
            onClick={cycleRepeatMode}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              repeatMode !== 'off'
                ? 'text-[#B517FF] bg-[#8E2DE2]/15'
                : 'text-[#A0A0AB] hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Secondary Bottom Utility Row: Queue | Equaliser | Sleep Timer | Speed | Info */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-[#A0A0AB]">
          <button
            type="button"
            onClick={() => setActiveModal('queue')}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 transition cursor-pointer"
          >
            <ListMusic className="w-4 h-4 text-[#B517FF]" />
            <span>Queue ({queue.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEqualizerOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition cursor-pointer ${
              equalizer.enabled
                ? 'bg-[#8E2DE2]/20 text-purple-200 border border-[#8E2DE2]/40'
                : 'bg-white/5 hover:bg-white/10 text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#B517FF]" />
            <span>Equaliser</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('sleep_timer')}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition cursor-pointer ${
              sleepTimerMode !== 'off'
                ? 'bg-[#8E2DE2]/25 text-purple-200 border border-[#8E2DE2]/40'
                : 'bg-white/5 hover:bg-white/10 text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4 text-[#B517FF]" />
            <span>
              {sleepTimerMode === 'end_of_song'
                ? 'End'
                : sleepTimerRemainingSec !== null
                ? formatMusicDuration(sleepTimerRemainingSec)
                : 'Sleep'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('speed')}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 transition cursor-pointer tabular-nums"
          >
            <span>{playbackSpeed}x</span>
          </button>

          <button
            type="button"
            aria-label="Song Information"
            onClick={() => setActiveModal('song_info')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 transition cursor-pointer"
          >
            <Info className="w-4 h-4 text-[#B517FF]" />
          </button>
        </div>
      </div>

      {/* ========================================================================
          MODAL 1: 3-DOT SETTINGS SHEET (Matching music_page_three_dot_settings)
      ======================================================================== */}
      {activeModal === 'three_dot_menu' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-[28px] bg-[#16161D] border-t border-white/15 px-5 pt-4 pb-8 flex flex-col gap-1 shadow-2xl"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />

            <button
              type="button"
              onClick={() => setActiveModal('add_to_playlist')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <ListPlus className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Add to playlist</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('sleep_timer')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Clock className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Sleep timer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('speed')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <FastForward className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Playback speed</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('ringtone_editor')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Bell className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Ringtone editor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('edit_song_info')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Pencil className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Edit song info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('album_cover')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <ImageIcon className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Current album cover</span>
            </button>

            <button
              type="button"
              onClick={handleShareSong}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Share</span>
            </button>

            <button
              type="button"
              onClick={() => {
                removeFromQueueIndex(currentIndex);
                setActiveModal(null);
                showToast('Removed from queue');
              }}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <MinusCircle className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Remove from queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('home_widget')}
              className="flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <LayoutGrid className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Home screen widget</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: RINGTONE EDITOR
      ======================================================================== */}
      {activeModal === 'ringtone_editor' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-[#B517FF]" />
                <h3 className="text-base font-extrabold text-white">Ringtone editor</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Select the start and end range for <strong className="text-white">{currentTrack.title}</strong> to preview and save as a ringtone clip.
            </p>

            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300 tabular-nums">
                <span>Start: {formatMusicDuration(ringStartSec)}</span>
                <span>Clip Length: {Math.max(1, ringEndSec - ringStartSec)}s</span>
                <span>End: {formatMusicDuration(ringEndSec)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-zinc-400">Start Time</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, (effectiveDuration || 60) - 5)}
                  value={ringStartSec}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRingStartSec(v);
                    if (ringEndSec <= v) setRingEndSec(Math.min(effectiveDuration || 60, v + 15));
                  }}
                  className="w-full accent-[#8B5CF6]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-zinc-400">End Time</label>
                <input
                  type="range"
                  min={ringStartSec + 5}
                  max={Math.max(ringStartSec + 5, effectiveDuration || 60)}
                  value={ringEndSec}
                  onChange={(e) => setRingEndSec(Number(e.target.value))}
                  className="w-full accent-[#8B5CF6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  seekTo(ringStartSec);
                  if (!isPlaying) togglePlayPause();
                }}
                className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition cursor-pointer"
              >
                Preview Clip
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(
                    `Ringtone saved (${formatMusicDuration(ringStartSec)} - ${formatMusicDuration(ringEndSec)})!`
                  );
                  setActiveModal(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-xs font-bold shadow-lg shadow-purple-700/30 transition cursor-pointer"
              >
                Save Ringtone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: EDIT SONG INFO
      ======================================================================== */}
      {activeModal === 'edit_song_info' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Edit song info</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Song Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/15 transition cursor-pointer"
              >
                Change Cover Image
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSongMetadata(currentTrack.id, {
                    title: editTitle.trim() || currentTrack.title,
                    artist: editArtist.trim() || currentTrack.artist,
                    album: editAlbum.trim() || currentTrack.album,
                    artworkUrl: editArtworkUrl || currentTrack.artworkUrl,
                  });
                  showToast('Song info updated!');
                  setActiveModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-xs font-bold text-white hover:bg-[#6D28D9] transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 4: CURRENT ALBUM COVER
      ======================================================================== */}
      {activeModal === 'album_cover' && (
        <div
          className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161D] border border-white/15 p-5 flex flex-col items-center gap-4"
          >
            <div className="w-full flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Current album cover</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-60 h-60 rounded-2xl overflow-hidden bg-gradient-to-br from-[#6A11CB] to-[#181820] border border-white/15 flex items-center justify-center">
              {showArt ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3 className="w-20 h-20 text-white/80" />
              )}
            </div>

            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              className="w-full py-3 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition cursor-pointer"
            >
              Choose New Album Cover from Device
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 5: HOME SCREEN & NOTIFICATION WIDGET PREVIEW
      ======================================================================== */}
      {activeModal === 'home_widget' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                Notification & Lock-Screen Widget
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              MaxPlay automatically displays this live media widget in your Android Notification Shade and Lock Screen whenever music is playing.
            </p>

            {/* Live Interactive Android Notification Shade Preview Card */}
            <div className="rounded-2xl bg-gradient-to-r from-[#281845] via-[#1E1633] to-[#161426] border border-purple-400/30 p-4 shadow-xl flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#7C3AED] shrink-0 flex items-center justify-center border border-white/15">
                {showArt ? (
                  <img
                    src={currentTrack.artworkUrl}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc3 className="w-7 h-7 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                  MaxPlay Music • Active
                </span>
                <p className="text-sm font-extrabold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-zinc-300 truncate">{currentTrack.artist}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={playPreviousTrack}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="p-2.5 rounded-full bg-white text-black cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={playNextTrack}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                NativeBridgeService.requestBackgroundDownloadAndNotificationPermissions();
                NativeBridgeService.updateMusicNotificationNative({
                  title: currentTrack.title,
                  artist: currentTrack.artist,
                  album: currentTrack.album,
                  isPlaying,
                  artworkUrl: currentTrack.artworkUrl,
                  durationSec: effectiveDuration,
                  positionSec: currentTime,
                });
                showToast('Notification & Lock-Screen Widget synced!');
                setActiveModal(null);
              }}
              className="w-full py-3 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition cursor-pointer"
            >
              Sync Android Notification & Lock-Screen Widget Now
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 6: UP NEXT QUEUE
      ======================================================================== */}
      {activeModal === 'queue' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[78vh] rounded-t-3xl bg-[#141418] border-t border-white/15 p-5 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-white">Playing Queue</h3>
                <p className="text-xs text-[#A0A0AB]">
                  {queue.length} songs • {activeQueueSourceLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearQueue();
                      setActiveModal(null);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-1.5 scrollbar-none">
              {queue.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => jumpToQueueIndex(idx)}
                    className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[#8E2DE2]/20 border-[#B517FF]/50'
                        : 'bg-[#1C1C22]/70 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-bold truncate ${
                          isCurrent ? 'text-[#B517FF]' : 'text-white'
                        }`}
                      >
                        {idx + 1}. {item.title}
                      </p>
                      <p className="text-[11px] text-[#A0A0AB] truncate">
                        {item.artist} • {formatMusicDuration(item.durationSec)}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {idx > 0 && (
                        <button
                          type="button"
                          aria-label="Move Up"
                          onClick={() => moveQueueItem(idx, idx - 1)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < queue.length - 1 && (
                        <button
                          type="button"
                          aria-label="Move Down"
                          onClick={() => moveQueueItem(idx, idx + 1)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Remove from Queue"
                        onClick={() => removeFromQueueIndex(idx)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 7: SLEEP TIMER
      ======================================================================== */}
      {activeModal === 'sleep_timer' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Sleep Timer</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {sleepOptions.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setSleepTimer(opt.mode);
                    setActiveModal(null);
                  }}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                    sleepTimerMode === opt.mode
                      ? 'bg-[#8E2DE2]/25 border-[#B517FF] text-white'
                      : 'bg-[#1C1C22] border-white/5 text-zinc-300 hover:border-white/15'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sleepTimerMode === opt.mode && <Check className="w-4 h-4 text-[#B517FF]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 8: PLAYBACK SPEED
      ======================================================================== */}
      {activeModal === 'speed' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Playback Speed</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {speedOptions.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setPlaybackSpeed(sp);
                    setActiveModal(null);
                  }}
                  className={`py-3 rounded-2xl border text-xs font-bold transition cursor-pointer tabular-nums ${
                    playbackSpeed === sp
                      ? 'bg-[#8E2DE2]/25 border-[#B517FF] text-white'
                      : 'bg-[#1C1C22] border-white/5 text-zinc-300 hover:border-white/15'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 9: ADD TO PLAYLIST
      ======================================================================== */}
      {activeModal === 'add_to_playlist' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Add to Playlist</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                placeholder="New playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-[#1C1C22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B517FF]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPlaylistName.trim()) return;
                  createPlaylist(newPlaylistName, [currentTrack.id]);
                  setNewPlaylistName('');
                  setActiveModal(null);
                  showToast('Added to new playlist!');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </button>
            </div>

            <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5 scrollbar-none">
              {playlists.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  No custom playlists yet. Create one above.
                </p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      addTracksToPlaylist(pl.id, [currentTrack.id]);
                      setActiveModal(null);
                      showToast(`Added to "${pl.name}"`);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#1C1C22] hover:bg-white/10 border border-white/5 text-left transition cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{pl.name}</p>
                      <p className="text-[10px] text-[#A0A0AB]">{pl.trackIds.length} songs</p>
                    </div>
                    {pl.trackIds.includes(currentTrack.id) && (
                      <Check className="w-4 h-4 text-[#B517FF]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 10: SONG TECHNICAL INFO
      ======================================================================== */}
      {activeModal === 'song_info' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Song Information</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Title</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.title}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Artist</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.artist}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Album</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.album}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Duration</span>
                <span className="text-white font-semibold tabular-nums">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Format & Size</span>
                <span className="text-white font-semibold tabular-nums">
                  {currentTrack.format} • {currentTrack.sizeMb} MB
                </span>
              </div>
              <div className="flex flex-col gap-1 py-1.5">
                <span className="text-[#A0A0AB]">Folder Path</span>
                <span className="text-zinc-300 font-mono text-[11px] break-all">
                  {currentTrack.folderPath}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

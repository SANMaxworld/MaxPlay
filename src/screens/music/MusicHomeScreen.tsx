import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckSquare,
  Clock,
  Disc,
  Disc3,
  EyeOff,
  Folder,
  FolderPlus,
  FolderX,
  Heart,
  Info,
  ListMusic,
  Loader2,
  Mic2,
  MoreVertical,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import {
  MusicAlbum,
  MusicArtist,
  MusicFolder,
  MusicPlaylist,
  MusicSortOption,
  MusicSubTab,
  MusicTrack,
} from '../../types/music';
import {
  formatMusicDuration,
  formatTotalLibraryDuration,
  searchLocalMusicLibrary,
} from '../../utils/musicUtils';

export const MusicHomeScreen: React.FC = () => {
  const {
    visibleTracks,
    sortedTracks,
    albums,
    artists,
    folders,
    playlists,
    discovery,
    isScanningMusic,
    sortBy,
    setSortBy,
    excludedFolders,
    hiddenSongIds,
    recentSearches,
    settings,
    updateSettings,
    currentTrack,
    isPlaying,
    setIsFullScreenPlayerOpen,
    scanDeviceMusic,
    importLocalAudioFiles,
    playTrack,
    playTrackList,
    togglePlayPause,
    playNextInQueue,
    addToQueueEnd,
    toggleFavorite,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTrack,
    excludeFolder,
    includeFolder,
    hideSongFromLibrary,
    restoreAllHiddenSongs,
    addRecentSearch,
    clearRecentSearches,
  } = useMusic();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [subTab, setSubTab] = useState<MusicSubTab>('home');
  const [selectedAlbum, setSelectedAlbum] = useState<MusicAlbum | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<MusicArtist | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<MusicFolder | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedSystemPlaylist, setSelectedSystemPlaylist] = useState<
    null | 'liked' | 'recent_played' | 'recent_added' | 'most_played' | 'unplayed' | 'longest'
  >(null);

  // Overlays & Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [activeSongMenuTrack, setActiveSongMenuTrack] = useState<MusicTrack | null>(null);
  const [songDetailsTrack, setSongDetailsTrack] = useState<MusicTrack | null>(null);
  const [folderInfoTarget, setFolderInfoTarget] = useState<MusicFolder | null>(null);
  const [playlistPickerTracks, setPlaylistPickerTracks] = useState<MusicTrack[] | null>(null);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renamingPlaylist, setRenamingPlaylist] = useState<MusicPlaylist | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showAddSongsToPlaylistId, setShowAddSongsToPlaylistId] = useState<string | null>(null);
  const [showExcludedFoldersModal, setShowExcludedFoldersModal] = useState(false);

  // Multi-select in Songs view
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [artFailedMap, setArtFailedMap] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const likedTracks = useMemo(
    () => visibleTracks.filter((t) => Boolean(t.isFavorite)),
    [visibleTracks]
  );

  const activeCustomPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const activeCustomPlaylistTracks = useMemo(() => {
    if (!activeCustomPlaylist) return [];
    const map = new Map(visibleTracks.map((t) => [t.id, t]));
    return activeCustomPlaylist.trackIds
      .map((id) => map.get(id))
      .filter((t): t is MusicTrack => Boolean(t));
  }, [activeCustomPlaylist, visibleTracks]);

  const activeSystemPlaylistData = useMemo(() => {
    switch (selectedSystemPlaylist) {
      case 'liked':
        return { title: 'Liked Songs', subtitle: 'Your favorite local tracks', tracks: likedTracks };
      case 'recent_played':
        return {
          title: 'Recently Played',
          subtitle: 'Tracks you listened to recently',
          tracks: discovery.recentlyPlayed,
        };
      case 'recent_added':
        return {
          title: 'Recently Added',
          subtitle: 'Latest audio files added to your device',
          tracks: discovery.recentlyAdded,
        };
      case 'most_played':
        return {
          title: 'Most Played',
          subtitle: 'Your top local tracks by play count',
          tracks: discovery.mostPlayed,
        };
      case 'unplayed':
        return {
          title: 'Unplayed Songs',
          subtitle: 'Tracks in your library waiting to be heard',
          tracks: discovery.unplayedSongs,
        };
      case 'longest':
        return {
          title: 'Longest Tracks',
          subtitle: 'Extended mixes, soundtracks & long audio',
          tracks: discovery.longestTracks,
        };
      default:
        return null;
    }
  }, [selectedSystemPlaylist, likedTracks, discovery]);

  const searchResults = useMemo(
    () =>
      searchLocalMusicLibrary(
        searchQuery,
        visibleTracks,
        albums,
        artists,
        folders,
        playlists
      ),
    [searchQuery, visibleTracks, albums, artists, folders, playlists]
  );

  const alphabetLetters = useMemo(() => {
    const letters = new Set<string>();
    sortedTracks.forEach((t) => {
      const first = (t.title || '#').trim().charAt(0).toUpperCase();
      letters.add(/[A-Z]/.test(first) ? first : '#');
    });
    return Array.from(letters).sort();
  }, [sortedTracks]);

  const clearDrilldowns = () => {
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSelectedFolder(null);
    setSelectedPlaylistId(null);
    setSelectedSystemPlaylist(null);
  };

  const handleSelectSubTab = (tab: MusicSubTab) => {
    clearDrilldowns();
    setIsMultiSelectMode(false);
    setSelectedTrackIds([]);
    setSubTab(tab);
  };

  const toggleMultiSelectTrack = (id: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImportFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const count = await importLocalAudioFiles(files);
    e.target.value = '';
    if (count > 0) {
      showToast(`Imported ${count} local audio file${count > 1 ? 's' : ''}`);
    } else {
      showToast('No supported audio files found in selection');
    }
  };

  const renderArtworkThumb = (track: MusicTrack, sizeClass = 'w-12 h-12 rounded-xl') => {
    const hasArt = Boolean(track.artworkUrl && !artFailedMap[track.id]);
    const isThisPlaying = currentTrack?.id === track.id;
    return (
      <div
        className={`relative ${sizeClass} overflow-hidden shrink-0 bg-gradient-to-br from-[#1C1C22] via-[#26143d] to-[#141418] border border-white/10 flex items-center justify-center`}
      >
        {hasArt ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={() =>
              setArtFailedMap((prev) => ({ ...prev, [track.id]: true }))
            }
          />
        ) : (
          <Music2 className="w-5 h-5 text-[#B517FF]" />
        )}
        {isThisPlaying && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            {isPlaying ? (
              <div className="flex items-end gap-0.5 h-3.5">
                <span className="w-0.5 h-2.5 bg-[#B517FF] rounded-full animate-pulse" />
                <span className="w-0.5 h-3.5 bg-white rounded-full animate-bounce" />
                <span className="w-0.5 h-2 bg-[#8E2DE2] rounded-full animate-pulse" />
              </div>
            ) : (
              <Play className="w-4 h-4 fill-white text-white" />
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSongRow = (
    track: MusicTrack,
    contextList: MusicTrack[],
    sourceLabel: string,
    indexBadge?: number
  ) => {
    const isActive = currentTrack?.id === track.id;
    const isChecked = selectedTrackIds.includes(track.id);

    return (
      <div
        key={track.id}
        id={`music-song-${track.title.charAt(0).toUpperCase()}`}
        onClick={() => {
          if (isMultiSelectMode) {
            toggleMultiSelectTrack(track.id);
            return;
          }
          if (isActive) {
            togglePlayPause();
            setIsFullScreenPlayerOpen(true);
          } else {
            playTrack(track, contextList, sourceLabel);
          }
        }}
        className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer ${
          isActive
            ? 'bg-gradient-to-r from-[#6A11CB]/25 via-[#8E2DE2]/15 to-[#141418] border-[#8E2DE2]/45 shadow-[0_4px_20px_rgba(106,17,203,0.25)]'
            : isChecked
            ? 'bg-[#6A11CB]/20 border-[#B517FF]/40'
            : 'bg-[#141418]/90 hover:bg-[#1C1C22] border-white/[0.06]'
        }`}
      >
        {isMultiSelectMode ? (
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center border ${
              isChecked
                ? 'bg-[#8E2DE2] border-[#B517FF] text-white'
                : 'border-white/25 bg-black/30'
            }`}
          >
            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        ) : indexBadge !== undefined ? (
          <span
            className={`w-5 text-center text-xs font-mono font-bold ${
              isActive ? 'text-[#B517FF]' : 'text-[#A1A1AA]'
            }`}
          >
            {indexBadge}
          </span>
        ) : null}

        {renderArtworkThumb(track)}

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate ${
              isActive ? 'text-[#B517FF]' : 'text-white'
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
            {track.artist}
            {track.album && track.album !== 'Unknown Album' ? ` • ${track.album}` : ''}
          </p>
          {settings.showFolderPathInList && (
            <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
              {track.folderPath}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono font-semibold text-[#A1A1AA]">
            {formatMusicDuration(track.durationSec)}
          </span>
          {!isMultiSelectMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSongMenuTrack(track);
              }}
              aria-label="Song Options"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const sortOptionsList: { id: MusicSortOption; label: string }[] = [
    { id: 'name', label: 'Song Name (A–Z)' },
    { id: 'artist', label: 'Artist Name' },
    { id: 'album', label: 'Album Name' },
    { id: 'duration', label: 'Duration (Longest)' },
    { id: 'recently_added', label: 'Recently Added' },
    { id: 'recently_played', label: 'Recently Played' },
    { id: 'most_played', label: 'Most Played' },
  ];

  return (
    <div className="min-h-[72vh] bg-[#0A0A0C] text-white pb-28 select-none">
      {/* Hidden File & Folder Audio Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus"
        multiple
        className="hidden"
        onChange={handleImportFilesChange}
      />
      <input
        ref={(el) => {
          folderInputRef.current = el;
          if (el) {
            el.setAttribute('webkitdirectory', '');
            el.setAttribute('directory', '');
          }
        }}
        type="file"
        multiple
        className="hidden"
        onChange={handleImportFilesChange}
      />

      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[140] bg-[#1C1C22] border border-[#8E2DE2]/60 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* 1. Music Top Header Bar */}
      <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] flex items-center justify-center shadow-[0_0_20px_rgba(142,45,226,0.45)] shrink-0">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-white">Musics</h2>
              <span className="px-2 py-0.5 rounded-md bg-[#6A11CB]/25 border border-[#8E2DE2]/40 text-[10px] font-extrabold uppercase tracking-wider text-purple-300">
                Offline Audio
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#A1A1AA] truncate">
              {visibleTracks.length} Songs • {albums.length} Albums • {artists.length} Artists
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search Local Music"
            className="w-9 h-9 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 flex items-center justify-center text-zinc-200 active:scale-90 transition-transform"
          >
            <Search className="w-4 h-4 text-[#B517FF]" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import Audio Files"
            className="px-2.5 h-9 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 flex items-center gap-1.5 text-xs font-bold text-zinc-200 active:scale-95 transition-transform"
          >
            <Upload className="w-3.5 h-3.5 text-[#B517FF]" />
            <span className="hidden sm:inline">Add Audio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              scanDeviceMusic(true);
              showToast('Scanning device storage for music...');
            }}
            aria-label="Rescan Device Audio"
            className="w-9 h-9 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 flex items-center justify-center text-zinc-200 active:scale-90 transition-transform"
          >
            {isScanningMusic ? (
              <Loader2 className="w-4 h-4 text-[#B517FF] animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-purple-300" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Music Settings"
            className="w-9 h-9 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 flex items-center justify-center text-zinc-200 active:scale-90 transition-transform"
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* 2. Music Category Sub-Navigation Bar */}
      <div className="px-4 pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'home', label: 'Home' },
            { id: 'songs', label: `Songs (${visibleTracks.length})` },
            { id: 'albums', label: `Albums (${albums.length})` },
            { id: 'artists', label: `Artists (${artists.length})` },
            { id: 'folders', label: `Folders (${folders.filter((f) => !f.isExcluded).length})` },
            { id: 'playlists', label: `Playlists (${playlists.length + 4})` },
          ] as { id: MusicSubTab; label: string }[]
        ).map((tab) => {
          const active =
            subTab === tab.id &&
            !selectedAlbum &&
            !selectedArtist &&
            !selectedFolder &&
            !selectedPlaylistId &&
            !selectedSystemPlaylist;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectSubTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-white border-[#B517FF]/50 shadow-[0_4px_14px_rgba(106,17,203,0.4)]'
                  : 'bg-[#141418] text-[#A1A1AA] border-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* DRILLDOWN 1: ALBUM DETAILS PAGE                                       */}
      {/* ===================================================================== */}
      {selectedAlbum ? (
        <div className="px-4 space-y-5 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Albums</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 bg-gradient-to-br from-[#1C1C22] via-[#141418] to-[#0A0A0C] p-5 rounded-3xl border border-white/10">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-gradient-to-br from-[#6A11CB] to-[#141418] border border-white/15 flex items-center justify-center shadow-2xl shrink-0">
              {selectedAlbum.artworkUrl ? (
                <img
                  src={selectedAlbum.artworkUrl}
                  alt={selectedAlbum.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3 className="w-16 h-16 text-white/90" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B517FF]">
                ALBUM
              </span>
              <h3 className="text-xl font-extrabold text-white mt-0.5 truncate">
                {selectedAlbum.name}
              </h3>
              <p className="text-sm font-semibold text-[#A1A1AA] mt-0.5">
                {selectedAlbum.artist}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {selectedAlbum.tracks.length} songs •{' '}
                {formatTotalLibraryDuration(selectedAlbum.totalDurationSec)}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() =>
                    playTrackList(
                      selectedAlbum.tracks,
                      false,
                      `Album • ${selectedAlbum.name}`
                    )
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-2 shadow-lg shadow-purple-900/40"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    playTrackList(
                      selectedAlbum.tracks,
                      true,
                      `Album • ${selectedAlbum.name}`
                    )
                  }
                  className="px-4 py-2.5 rounded-xl bg-[#1C1C22] border border-white/15 text-xs font-extrabold text-white flex items-center gap-2"
                >
                  <Shuffle className="w-4 h-4 text-[#B517FF]" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {selectedAlbum.tracks.map((track, idx) =>
              renderSongRow(track, selectedAlbum.tracks, selectedAlbum.name, idx + 1)
            )}
          </div>
        </div>
      ) : selectedArtist ? (
        /* ===================================================================== */
        /* DRILLDOWN 2: ARTIST DETAILS PAGE                                      */
        /* ===================================================================== */
        <div className="px-4 space-y-5 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setSelectedArtist(null)}
            className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Artists</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-5 bg-gradient-to-br from-[#1C1C22] via-[#141418] to-[#0A0A0C] p-5 rounded-3xl border border-white/10">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-gradient-to-tr from-[#6A11CB] to-[#B517FF] border-2 border-white/20 flex items-center justify-center shadow-2xl shrink-0">
              {selectedArtist.artworkUrl ? (
                <img
                  src={selectedArtist.artworkUrl}
                  alt={selectedArtist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Mic2 className="w-12 h-12 text-white" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B517FF]">
                ARTIST
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-0.5 truncate">
                {selectedArtist.name}
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-1">
                {selectedArtist.tracks.length} Songs • {selectedArtist.albums.length} Albums •{' '}
                {formatTotalLibraryDuration(selectedArtist.totalDurationSec)}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() =>
                    playTrackList(
                      selectedArtist.tracks,
                      false,
                      `Artist • ${selectedArtist.name}`
                    )
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    playTrackList(
                      selectedArtist.tracks,
                      true,
                      `Artist • ${selectedArtist.name}`
                    )
                  }
                  className="px-4 py-2.5 rounded-xl bg-[#1C1C22] border border-white/15 text-xs font-extrabold text-white flex items-center gap-2"
                >
                  <Shuffle className="w-4 h-4 text-[#B517FF]" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {selectedArtist.albums.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-sm font-extrabold text-white">
                Albums by {selectedArtist.name}
              </h4>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {selectedArtist.albums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => {
                      setSelectedArtist(null);
                      setSelectedAlbum(alb);
                    }}
                    className="w-32 shrink-0 bg-[#141418] border border-white/10 rounded-2xl p-2.5 cursor-pointer hover:border-[#8E2DE2]/50"
                  >
                    <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#6A11CB]/40 to-[#1C1C22] flex items-center justify-center mb-2 overflow-hidden">
                      {alb.artworkUrl ? (
                        <img
                          src={alb.artworkUrl}
                          alt={alb.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc className="w-8 h-8 text-[#B517FF]" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-white truncate">{alb.name}</p>
                    <p className="text-[10px] text-[#A1A1AA]">{alb.tracks.length} songs</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-extrabold text-white">All Songs</h4>
            {selectedArtist.tracks.map((track, idx) =>
              renderSongRow(track, selectedArtist.tracks, selectedArtist.name, idx + 1)
            )}
          </div>
        </div>
      ) : selectedFolder ? (
        /* ===================================================================== */
        /* DRILLDOWN 3: FOLDER DETAILS PAGE                                      */
        /* ===================================================================== */
        <div className="px-4 space-y-4 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Folders</span>
          </button>

          <div className="bg-[#141418] border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6A11CB] to-[#8E2DE2] flex items-center justify-center shrink-0 shadow-lg">
                  <Folder className="w-7 h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-white truncate">
                    {selectedFolder.name}
                  </h3>
                  <p className="text-xs font-mono text-[#A1A1AA] truncate">
                    {selectedFolder.path}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {selectedFolder.tracks.length} songs •{' '}
                    {formatTotalLibraryDuration(selectedFolder.totalDurationSec)} •{' '}
                    {selectedFolder.totalSizeMb} MB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFolderInfoTarget(selectedFolder)}
                aria-label="Folder Information"
                className="p-2.5 rounded-xl bg-[#1C1C22] border border-white/10 text-zinc-300 hover:text-white"
              >
                <Info className="w-4 h-4 text-[#B517FF]" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  playTrackList(
                    selectedFolder.tracks,
                    false,
                    `Folder • ${selectedFolder.name}`
                  )
                }
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play All</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  playTrackList(
                    selectedFolder.tracks,
                    true,
                    `Folder • ${selectedFolder.name}`
                  )
                }
                className="px-4 py-2 rounded-xl bg-[#1C1C22] border border-white/10 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#B517FF]" />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  scanDeviceMusic(false);
                  showToast(`Refreshed folder "${selectedFolder.name}"`);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#1C1C22] border border-white/10 text-xs font-bold text-zinc-200 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-300" />
                <span>Refresh Folder</span>
              </button>

              {selectedFolder.isExcluded ? (
                <button
                  type="button"
                  onClick={() => {
                    includeFolder(selectedFolder.path);
                    setSelectedFolder({ ...selectedFolder, isExcluded: false });
                    showToast(`Included "${selectedFolder.name}" back in Music Library`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Include Folder Again</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    excludeFolder(selectedFolder.path);
                    setSelectedFolder(null);
                    showToast(
                      `Hidden "${selectedFolder.name}" from Library (device files untouched)`
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-bold text-amber-300 flex items-center gap-1.5"
                >
                  <FolderX className="w-3.5 h-3.5" />
                  <span>Exclude Folder</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {selectedFolder.tracks.map((track, idx) =>
              renderSongRow(track, selectedFolder.tracks, selectedFolder.name, idx + 1)
            )}
          </div>
        </div>
      ) : activeCustomPlaylist || activeSystemPlaylistData ? (
        /* ===================================================================== */
        /* DRILLDOWN 4: PLAYLIST DETAILS PAGE (SYSTEM OR CUSTOM)                 */
        /* ===================================================================== */
        <div className="px-4 space-y-4 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => {
              setSelectedPlaylistId(null);
              setSelectedSystemPlaylist(null);
            }}
            className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {(() => {
            const title = activeCustomPlaylist
              ? activeCustomPlaylist.name
              : activeSystemPlaylistData!.title;
            const subtitle = activeCustomPlaylist
              ? 'Custom Local Playlist'
              : activeSystemPlaylistData!.subtitle;
            const tracks = activeCustomPlaylist
              ? activeCustomPlaylistTracks
              : activeSystemPlaylistData!.tracks;
            const totalDur = tracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);

            return (
              <>
                <div className="bg-gradient-to-br from-[#1C1C22] via-[#141418] to-[#0A0A0C] border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B517FF]">
                        PLAYLIST
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-0.5">{title}</h3>
                      <p className="text-xs text-[#A1A1AA] mt-0.5">{subtitle}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {tracks.length} songs • {formatTotalLibraryDuration(totalDur)}
                      </p>
                    </div>

                    {activeCustomPlaylist && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setShowAddSongsToPlaylistId(activeCustomPlaylist.id)
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#6A11CB]/30 border border-[#8E2DE2]/50 text-xs font-bold text-purple-200 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Songs</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingPlaylist(activeCustomPlaylist);
                            setRenameText(activeCustomPlaylist.name);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#1C1C22] border border-white/10 text-xs font-bold text-zinc-300"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deletePlaylist(activeCustomPlaylist.id);
                            setSelectedPlaylistId(null);
                            showToast('Playlist deleted');
                          }}
                          className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {tracks.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => playTrackList(tracks, false, title)}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Play All</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => playTrackList(tracks, true, title)}
                        className="px-4 py-2.5 rounded-xl bg-[#1C1C22] border border-white/15 text-xs font-extrabold text-white flex items-center gap-2"
                      >
                        <Shuffle className="w-4 h-4 text-[#B517FF]" />
                        <span>Shuffle</span>
                      </button>
                    </div>
                  )}
                </div>

                {tracks.length === 0 ? (
                  <div className="bg-[#141418] border border-white/10 rounded-3xl p-8 text-center space-y-3">
                    <ListMusic className="w-10 h-10 text-[#8E2DE2] mx-auto" />
                    <p className="text-sm font-bold text-white">No songs in this playlist yet</p>
                    {activeCustomPlaylist && (
                      <button
                        type="button"
                        onClick={() => setShowAddSongsToPlaylistId(activeCustomPlaylist.id)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white"
                      >
                        Add Songs from Library
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tracks.map((track, idx) => (
                      <div key={`${track.id}_${idx}`} className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          {renderSongRow(track, tracks, title, idx + 1)}
                        </div>
                        {activeCustomPlaylist && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                reorderPlaylistTrack(activeCustomPlaylist.id, idx, idx - 1)
                              }
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-25"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === tracks.length - 1}
                              onClick={() =>
                                reorderPlaylistTrack(activeCustomPlaylist.id, idx, idx + 1)
                              }
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-25"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                removeTrackFromPlaylist(activeCustomPlaylist.id, track.id)
                              }
                              className="p-1 text-zinc-500 hover:text-red-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : visibleTracks.length === 0 && subTab !== 'folders' ? (
        /* ===================================================================== */
        /* EMPTY MUSIC LIBRARY STATE                                             */
        /* ===================================================================== */
        <div className="px-4 py-8">
          <div className="bg-gradient-to-b from-[#141418] to-[#0A0A0C] border border-[#8E2DE2]/30 rounded-3xl p-8 text-center max-w-md mx-auto space-y-5 shadow-[0_16px_50px_rgba(106,17,203,0.2)]">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(181,23,255,0.45)]">
              <Music className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-white">No Music Found on Device</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Scan your phone storage for MP3, M4A, AAC, WAV, FLAC, and OGG songs or select
                music folders directly to build your offline MaxPlay Music Library.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => scanDeviceMusic(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] text-xs font-extrabold text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scan Device for Music</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#1C1C22] hover:bg-white/10 border border-white/15 text-xs font-extrabold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Upload className="w-4 h-4 text-[#B517FF]" />
                <span>Select Audio Files</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="text-xs font-bold text-purple-300 hover:text-white underline underline-offset-4"
            >
              Or Select a Music Folder
            </button>

            {(excludedFolders.length > 0 || hiddenSongIds.length > 0) && (
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
                {excludedFolders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowExcludedFoldersModal(true)}
                    className="text-xs font-bold text-amber-300"
                  >
                    Restore {excludedFolders.length} Excluded Folder(s)
                  </button>
                )}
                {hiddenSongIds.length > 0 && (
                  <button
                    type="button"
                    onClick={restoreAllHiddenSongs}
                    className="text-xs font-bold text-emerald-300"
                  >
                    Restore {hiddenSongIds.length} Hidden Song(s)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'home' ? (
        /* ===================================================================== */
        /* TAB 1: MUSIC HOME SCREEN DASHBOARD                                    */
        /* ===================================================================== */
        <div className="px-4 space-y-6 animate-in fade-in duration-200">
          {/* Section 1: Recently Played Horizontal Carousel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#B517FF]" />
                <span>Recently Played</span>
              </h3>
              {discovery.recentlyPlayed.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSystemPlaylist('recent_played')}
                  className="text-xs font-bold text-purple-300 hover:text-white"
                >
                  See All
                </button>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {(discovery.recentlyPlayed.length > 0
                ? discovery.recentlyPlayed.slice(0, 10)
                : discovery.recentlyAdded.slice(0, 8)
              ).map((track) => {
                const isThisPlaying = currentTrack?.id === track.id;
                const hasArt = Boolean(track.artworkUrl && !artFailedMap[track.id]);
                return (
                  <div
                    key={track.id}
                    onClick={() =>
                      playTrack(
                        track,
                        discovery.recentlyPlayed.length > 0
                          ? discovery.recentlyPlayed
                          : discovery.recentlyAdded,
                        'Recently Played'
                      )
                    }
                    className="w-32 shrink-0 bg-[#141418] hover:bg-[#1C1C22] border border-white/10 rounded-2xl p-2.5 cursor-pointer transition-all group"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-[#6A11CB]/40 via-[#1C1C22] to-[#0A0A0C] mb-2 flex items-center justify-center">
                      {hasArt ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          onError={() =>
                            setArtFailedMap((prev) => ({ ...prev, [track.id]: true }))
                          }
                        />
                      ) : (
                        <Music2 className="w-9 h-9 text-[#B517FF]" />
                      )}
                      <div className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] flex items-center justify-center shadow-lg">
                        {isThisPlaying && isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-white text-white" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{track.title}</p>
                    <p className="text-[10px] text-[#A1A1AA] truncate mt-0.5">
                      {track.artist}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Quick Access (4 Main Shortcuts) */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-extrabold tracking-tight text-white">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectSubTab('songs')}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left transition-all active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                  <Music2 className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white">All Songs</p>
                  <p className="text-[11px] text-[#A1A1AA]">{visibleTracks.length} tracks</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSubTab('albums')}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left transition-all active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                  <Disc className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white">Albums</p>
                  <p className="text-[11px] text-[#A1A1AA]">{albums.length} albums</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSubTab('artists')}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left transition-all active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                  <Mic2 className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white">Artists</p>
                  <p className="text-[11px] text-[#A1A1AA]">{artists.length} artists</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSubTab('folders')}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left transition-all active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white">Folders</p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {folders.filter((f) => !f.isExcluded).length} folders
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 3: Your Playlists */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-[#B517FF]" />
                <span>Your Playlists</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatePlaylistModalOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-[#B517FF] hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Playlist</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSystemPlaylist('liked')}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-[#6A11CB]/35 via-[#141418] to-[#141418] border border-[#8E2DE2]/40 text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6A11CB] to-[#B517FF] flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 fill-white text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">Liked Songs</p>
                  <p className="text-[11px] text-[#A1A1AA]">{likedTracks.length} songs</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSystemPlaylist('recent_played')}
                className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1C1C22] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">Recently Played</p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {discovery.recentlyPlayed.length} songs
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSystemPlaylist('recent_added')}
                className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1C1C22] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">Recently Added</p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {discovery.recentlyAdded.length} songs
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSystemPlaylist('most_played')}
                className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1C1C22] flex items-center justify-center shrink-0">
                  <Disc3 className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">Most Played</p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {discovery.mostPlayed.length} songs
                  </p>
                </div>
              </button>

              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/35 flex items-center justify-center shrink-0">
                    <ListMusic className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-white truncate">{pl.name}</p>
                    <p className="text-[11px] text-[#A1A1AA]">{pl.trackIds.length} songs</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Discover Your Library (100% Local Library Based) */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B517FF]" />
              <span>Discover Your Library</span>
            </h3>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {[
                {
                  id: 'most_played' as const,
                  title: 'Most Played',
                  desc: `${discovery.mostPlayed.length} top tracks`,
                },
                {
                  id: 'recent_added' as const,
                  title: 'Recently Added',
                  desc: `${discovery.recentlyAdded.length} newest files`,
                },
                {
                  id: 'recent_played' as const,
                  title: 'Recently Played',
                  desc: `${discovery.recentlyPlayed.length} recent sessions`,
                },
                {
                  id: 'unplayed' as const,
                  title: 'Unplayed Songs',
                  desc: `${discovery.unplayedSongs.length} fresh tracks`,
                },
                {
                  id: 'longest' as const,
                  title: 'Longest Tracks',
                  desc: `${discovery.longestTracks.length} extended tracks`,
                },
              ].map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedSystemPlaylist(card.id)}
                  className="w-40 shrink-0 p-4 rounded-2xl bg-gradient-to-br from-[#1C1C22] via-[#141418] to-[#0A0A0C] border border-white/10 hover:border-[#8E2DE2]/50 text-left space-y-1.5"
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#B517FF]">
                    LOCAL MIX
                  </span>
                  <p className="text-sm font-extrabold text-white">{card.title}</p>
                  <p className="text-[11px] text-[#A1A1AA]">{card.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : subTab === 'songs' ? (
        /* ===================================================================== */
        /* TAB 2: ALL SONGS VIEW (SORT, PLAY ALL, SHUFFLE, MULTI-SELECT, A-Z)    */
        /* ===================================================================== */
        <div className="px-4 space-y-3 relative animate-in fade-in duration-200">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#141418] border border-white/10 rounded-2xl p-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playTrackList(sortedTracks, false, 'All Songs')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play All</span>
              </button>
              <button
                type="button"
                onClick={() => playTrackList(sortedTracks, true, 'All Songs (Shuffle)')}
                className="px-3.5 py-2 rounded-xl bg-[#1C1C22] border border-white/10 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#B517FF]" />
                <span>Shuffle</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSortSheet(true)}
                className="px-3 py-2 rounded-xl bg-[#1C1C22] border border-white/10 text-xs font-bold text-zinc-200 flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#B517FF]" />
                <span>Sort</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMultiSelectMode((prev) => !prev);
                  setSelectedTrackIds([]);
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  isMultiSelectMode
                    ? 'bg-[#6A11CB]/30 border-[#B517FF] text-white'
                    : 'bg-[#1C1C22] border-white/10 text-zinc-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#B517FF]" />
                <span>{isMultiSelectMode ? 'Done' : 'Select'}</span>
              </button>
            </div>
          </div>

          {/* Multi-select batch action bar */}
          {isMultiSelectMode && selectedTrackIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1C1C22] border border-[#8E2DE2]/50 rounded-2xl p-3">
              <span className="text-xs font-extrabold text-white">
                {selectedTrackIds.length} selected
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const chosen = sortedTracks.filter((t) =>
                      selectedTrackIds.includes(t.id)
                    );
                    addToQueueEnd(chosen);
                    setIsMultiSelectMode(false);
                    setSelectedTrackIds([]);
                    showToast(`Added ${chosen.length} songs to Queue`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#6A11CB] text-xs font-bold text-white"
                >
                  Add to Queue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const chosen = sortedTracks.filter((t) =>
                      selectedTrackIds.includes(t.id)
                    );
                    setPlaylistPickerTracks(chosen);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-white"
                >
                  Add to Playlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectedTrackIds.forEach((id) => hideSongFromLibrary(id));
                    setIsMultiSelectMode(false);
                    setSelectedTrackIds([]);
                    showToast('Hidden selected songs from Library');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-xs font-bold text-amber-300"
                >
                  Remove from Library
                </button>
              </div>
            </div>
          )}

          {/* Song List + Right Alphabet Fast Jumper */}
          <div className="relative flex gap-2">
            <div className="flex-1 space-y-2 min-w-0">
              {sortedTracks.map((track) =>
                renderSongRow(track, sortedTracks, 'All Songs')
              )}
            </div>

            {sortBy === 'name' && alphabetLetters.length > 2 && (
              <div className="sticky top-24 self-start flex flex-col items-center py-2 px-1 rounded-full bg-[#141418] border border-white/10 text-[10px] font-extrabold text-[#A1A1AA] gap-1">
                {alphabetLetters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`music-song-${letter}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-4 h-4 flex items-center justify-center hover:text-[#B517FF]"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'albums' ? (
        /* ===================================================================== */
        /* TAB 3: ALBUMS GRID                                                    */
        /* ===================================================================== */
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 animate-in fade-in duration-200">
          {albums.map((alb) => (
            <div
              key={alb.id}
              onClick={() => setSelectedAlbum(alb)}
              className="bg-[#141418] hover:bg-[#1C1C22] border border-white/10 rounded-2xl p-3 cursor-pointer transition-all group"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-[#6A11CB]/40 via-[#1C1C22] to-[#0A0A0C] mb-2.5 flex items-center justify-center">
                {alb.artworkUrl ? (
                  <img
                    src={alb.artworkUrl}
                    alt={alb.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc3 className="w-11 h-11 text-[#B517FF]" />
                )}
              </div>
              <p className="text-xs font-extrabold text-white truncate">{alb.name}</p>
              <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{alb.artist}</p>
              <p className="text-[10px] text-zinc-500 mt-1">{alb.tracks.length} songs</p>
            </div>
          ))}
        </div>
      ) : subTab === 'artists' ? (
        /* ===================================================================== */
        /* TAB 4: ARTISTS LIST                                                   */
        /* ===================================================================== */
        <div className="px-4 space-y-2.5 animate-in fade-in duration-200">
          {artists.map((art) => (
            <div
              key={art.id}
              onClick={() => setSelectedArtist(art)}
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-[#6A11CB] to-[#8E2DE2] flex items-center justify-center shrink-0">
                  {art.artworkUrl ? (
                    <img
                      src={art.artworkUrl}
                      alt={art.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Mic2 className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-white truncate">{art.name}</p>
                  <p className="text-xs text-[#A1A1AA]">
                    {art.tracks.length} songs • {art.albums.length} albums
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playTrackList(art.tracks, false, `Artist • ${art.name}`);
                }}
                className="w-9 h-9 rounded-full bg-[#6A11CB]/30 border border-[#8E2DE2]/50 flex items-center justify-center text-white"
              >
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      ) : subTab === 'folders' ? (
        /* ===================================================================== */
        /* TAB 5: FOLDER MANAGEMENT & HIERARCHY                                  */
        /* ===================================================================== */
        <div className="px-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#141418] border border-white/10 rounded-2xl p-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white">Device Audio Folders</p>
              <p className="text-[11px] text-[#A1A1AA]">
                Internal Storage • {folders.filter((f) => !f.isExcluded).length} active folders
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-bold text-white flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add Folder</span>
              </button>
              {excludedFolders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExcludedFoldersModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-bold text-amber-300"
                >
                  Excluded ({excludedFolders.length})
                </button>
              )}
            </div>
          </div>

          {folders.filter((f) => !f.isExcluded).length === 0 ? (
            <div className="bg-[#141418] border border-white/10 rounded-3xl p-8 text-center space-y-3">
              <Folder className="w-10 h-10 text-[#B517FF] mx-auto" />
              <p className="text-sm font-bold text-white">No Active Music Folders</p>
              <p className="text-xs text-[#A1A1AA]">
                Scan your device or add a folder from Internal Storage to browse music by folder.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {folders
                .filter((f) => !f.isExcluded)
                .map((folder) => (
                  <div
                    key={folder.path}
                    onClick={() => setSelectedFolder(folder)}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                        <Folder className="w-5 h-5 text-[#B517FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-white truncate">
                          {folder.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#A1A1AA] truncate">
                          {folder.path}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {folder.tracks.length} songs •{' '}
                          {formatTotalLibraryDuration(folder.totalDurationSec)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          playTrackList(
                            folder.tracks,
                            false,
                            `Folder • ${folder.name}`
                          )
                        }
                        aria-label={`Play folder ${folder.name}`}
                        className="w-9 h-9 rounded-full bg-[#6A11CB]/30 border border-[#8E2DE2]/50 flex items-center justify-center text-white"
                      >
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          excludeFolder(folder.path);
                          showToast(`Excluded folder "${folder.name}" from Music Library`);
                        }}
                        title="Exclude Folder from Music Library"
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-amber-500/20 flex items-center justify-center text-zinc-400 hover:text-amber-300"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* TAB 6: PLAYLISTS VIEW                                                 */
        /* ===================================================================== */
        <div className="px-4 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Default & Custom Playlists</h3>
            <button
              type="button"
              onClick={() => setIsCreatePlaylistModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Playlist</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              onClick={() => setSelectedSystemPlaylist('liked')}
              className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#6A11CB]/35 to-[#141418] border border-[#8E2DE2]/45 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#6A11CB] to-[#B517FF] flex items-center justify-center">
                  <Heart className="w-5 h-5 fill-white text-white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">Liked Songs</p>
                  <p className="text-xs text-[#A1A1AA]">{likedTracks.length} songs</p>
                </div>
              </div>
              <Play className="w-4 h-4 text-purple-300" />
            </div>

            <div
              onClick={() => setSelectedSystemPlaylist('recent_played')}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#141418] border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1C1C22] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">Recently Played</p>
                  <p className="text-xs text-[#A1A1AA]">
                    {discovery.recentlyPlayed.length} songs
                  </p>
                </div>
              </div>
              <Play className="w-4 h-4 text-zinc-400" />
            </div>

            <div
              onClick={() => setSelectedSystemPlaylist('recent_added')}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#141418] border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1C1C22] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">Recently Added</p>
                  <p className="text-xs text-[#A1A1AA]">
                    {discovery.recentlyAdded.length} songs
                  </p>
                </div>
              </div>
              <Play className="w-4 h-4 text-zinc-400" />
            </div>

            <div
              onClick={() => setSelectedSystemPlaylist('most_played')}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#141418] border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1C1C22] flex items-center justify-center">
                  <Disc3 className="w-5 h-5 text-[#B517FF]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">Most Played</p>
                  <p className="text-xs text-[#A1A1AA]">
                    {discovery.mostPlayed.length} songs
                  </p>
                </div>
              </div>
              <Play className="w-4 h-4 text-zinc-400" />
            </div>

            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylistId(pl.id)}
                className="flex items-center justify-between p-4 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-white/10 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#6A11CB]/25 border border-[#8E2DE2]/40 flex items-center justify-center shrink-0">
                    <ListMusic className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{pl.name}</p>
                    <p className="text-xs text-[#A1A1AA]">{pl.trackIds.length} songs</p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      deletePlaylist(pl.id);
                      showToast(`Deleted "${pl.name}"`);
                    }}
                    className="p-2 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SONG 3-DOT OPTIONS MENU                                      */}
      {/* ===================================================================== */}
      {activeSongMenuTrack && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setActiveSongMenuTrack(null)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                {renderArtworkThumb(activeSongMenuTrack, 'w-11 h-11 rounded-xl')}
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-white truncate">
                    {activeSongMenuTrack.title}
                  </p>
                  <p className="text-xs text-[#A1A1AA] truncate">
                    {activeSongMenuTrack.artist} • {activeSongMenuTrack.album}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSongMenuTrack(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playNextInQueue(activeSongMenuTrack);
                setActiveSongMenuTrack(null);
                showToast(`Playing "${activeSongMenuTrack.title}" next`);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Play className="w-4 h-4 text-[#B517FF]" />
              <span>Play Next</span>
            </button>

            <button
              type="button"
              onClick={() => {
                addToQueueEnd(activeSongMenuTrack);
                setActiveSongMenuTrack(null);
                showToast(`Added "${activeSongMenuTrack.title}" to Queue`);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <ListMusic className="w-4 h-4 text-[#B517FF]" />
              <span>Add to Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const track = activeSongMenuTrack;
                setActiveSongMenuTrack(null);
                setPlaylistPickerTracks([track]);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Plus className="w-4 h-4 text-[#B517FF]" />
              <span>Add to Playlist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleFavorite(activeSongMenuTrack.id);
                setActiveSongMenuTrack(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Heart className="w-4 h-4 text-[#B517FF]" />
              <span>
                {activeSongMenuTrack.isFavorite
                  ? 'Remove from Favorites'
                  : 'Add to Favorites'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const alb = albums.find(
                  (a) =>
                    a.name.toLowerCase() ===
                    (activeSongMenuTrack.album || '').toLowerCase()
                );
                setActiveSongMenuTrack(null);
                if (alb) {
                  clearDrilldowns();
                  setSelectedAlbum(alb);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Disc className="w-4 h-4 text-[#B517FF]" />
              <span>View Album</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const art = artists.find(
                  (a) =>
                    a.name.toLowerCase() ===
                    (activeSongMenuTrack.artist || '').toLowerCase()
                );
                setActiveSongMenuTrack(null);
                if (art) {
                  clearDrilldowns();
                  setSelectedArtist(art);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Mic2 className="w-4 h-4 text-[#B517FF]" />
              <span>View Artist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = activeSongMenuTrack;
                setActiveSongMenuTrack(null);
                setSongDetailsTrack(t);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs font-bold text-white"
            >
              <Info className="w-4 h-4 text-[#B517FF]" />
              <span>Song Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hideSongFromLibrary(activeSongMenuTrack.id);
                setActiveSongMenuTrack(null);
                showToast('Removed from Music Library (device file kept safe)');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 text-xs font-bold text-amber-300"
            >
              <EyeOff className="w-4 h-4" />
              <span>Remove from Library (Keep File on Device)</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SORT SONGS SHEET                                             */}
      {/* ===================================================================== */}
      {showSortSheet && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setShowSortSheet(false)}
        >
          <div
            className="w-full bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Sort Songs By</h3>
              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sortOptionsList.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSortBy(opt.id);
                  setShowSortSheet(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold ${
                  sortBy === opt.id
                    ? 'bg-[#6A11CB]/30 border border-[#B517FF]/50 text-white'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span>{opt.label}</span>
                {sortBy === opt.id && <Check className="w-4 h-4 text-[#B517FF]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: SONG INFORMATION DIALOG                                      */}
      {/* ===================================================================== */}
      {songDetailsTrack && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setSongDetailsTrack(null)}
        >
          <div
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Song Information</h3>
              <button
                type="button"
                onClick={() => setSongDetailsTrack(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Song Name</span>
                <span className="font-bold text-white text-right">
                  {songDetailsTrack.title}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Artist</span>
                <span className="font-bold text-white text-right">
                  {songDetailsTrack.artist}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Album</span>
                <span className="font-bold text-white text-right">
                  {songDetailsTrack.album}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Duration</span>
                <span className="font-bold text-white">
                  {formatMusicDuration(songDetailsTrack.durationSec)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Format</span>
                <span className="font-bold text-[#B517FF]">{songDetailsTrack.format}</span>
              </div>
              <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">File Size</span>
                <span className="font-bold text-white">{songDetailsTrack.sizeMb} MB</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[#A1A1AA]">File Path</span>
                <span className="font-mono text-[11px] bg-[#1C1C22] p-2.5 rounded-xl text-zinc-300 break-all">
                  {songDetailsTrack.folderPath}/{songDetailsTrack.fileName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: FOLDER INFORMATION DIALOG                                    */}
      {/* ===================================================================== */}
      {folderInfoTarget && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setFolderInfoTarget(null)}
        >
          <div
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Folder Information</h3>
              <button
                type="button"
                onClick={() => setFolderInfoTarget(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Folder Name</span>
                <span className="font-bold text-white">{folderInfoTarget.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Total Songs</span>
                <span className="font-bold text-white">{folderInfoTarget.tracks.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Total Duration</span>
                <span className="font-bold text-white">
                  {formatTotalLibraryDuration(folderInfoTarget.totalDurationSec)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-[#A1A1AA]">Total Size</span>
                <span className="font-bold text-white">{folderInfoTarget.totalSizeMb} MB</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[#A1A1AA]">Storage Path</span>
                <span className="font-mono text-[11px] bg-[#1C1C22] p-2.5 rounded-xl text-zinc-300 break-all">
                  {folderInfoTarget.path}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: CREATE / RENAME / PICK PLAYLIST                              */}
      {/* ===================================================================== */}
      {(isCreatePlaylistModalOpen || playlistPickerTracks) && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => {
            setIsCreatePlaylistModalOpen(false);
            setPlaylistPickerTracks(null);
          }}
        >
          <div
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                {playlistPickerTracks ? 'Add to Playlist' : 'Create New Playlist'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreatePlaylistModalOpen(false);
                  setPlaylistPickerTracks(null);
                }}
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
                placeholder="Enter playlist name..."
                className="flex-1 bg-[#1C1C22] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B517FF]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPlaylistName.trim()) return;
                  const ids = playlistPickerTracks
                    ? playlistPickerTracks.map((t) => t.id)
                    : [];
                  const pl = createPlaylist(newPlaylistName, ids);
                  setNewPlaylistName('');
                  setIsCreatePlaylistModalOpen(false);
                  setPlaylistPickerTracks(null);
                  setIsMultiSelectMode(false);
                  setSelectedTrackIds([]);
                  showToast(`Created playlist "${pl.name}"`);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-extrabold text-white"
              >
                Create
              </button>
            </div>

            {playlistPickerTracks && playlists.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      addTracksToPlaylist(
                        pl.id,
                        playlistPickerTracks.map((t) => t.id)
                      );
                      setPlaylistPickerTracks(null);
                      setIsMultiSelectMode(false);
                      setSelectedTrackIds([]);
                      showToast(`Added to "${pl.name}"`);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1C1C22] hover:bg-white/10 text-left"
                  >
                    <span className="text-sm font-bold text-white">{pl.name}</span>
                    <span className="text-xs text-[#A1A1AA]">
                      {pl.trackIds.length} songs
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename Playlist Modal */}
      {renamingPlaylist && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setRenamingPlaylist(null)}
        >
          <div
            className="w-full max-w-sm bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-white">Rename Playlist</h3>
            <input
              type="text"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              className="w-full bg-[#1C1C22] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  renamePlaylist(renamingPlaylist.id, renameText);
                  setRenamingPlaylist(null);
                  showToast('Playlist renamed');
                }}
                className="px-4 py-2 rounded-xl bg-[#6A11CB] text-xs font-extrabold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Songs to Specific Playlist Modal */}
      {showAddSongsToPlaylistId && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setShowAddSongsToPlaylistId(null)}
        >
          <div
            className="w-full max-h-[80vh] bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">
                Tap Songs to Add to Playlist
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSongsToPlaylistId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#6A11CB] text-xs font-extrabold text-white"
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-3">
              {visibleTracks.map((t) => {
                const targetPl = playlists.find((p) => p.id === showAddSongsToPlaylistId);
                const alreadyIn = Boolean(targetPl?.trackIds.includes(t.id));
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (!alreadyIn) {
                        addTracksToPlaylist(showAddSongsToPlaylistId, [t.id]);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#1C1C22] hover:bg-white/10 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-[#A1A1AA] truncate">{t.artist}</p>
                    </div>
                    {alreadyIn ? (
                      <span className="text-[10px] font-bold text-emerald-400">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-[#B517FF]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: EXCLUDED FOLDERS MANAGER                                     */}
      {/* ===================================================================== */}
      {showExcludedFoldersModal && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setShowExcludedFoldersModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Excluded Folders</h3>
                <p className="text-xs text-[#A1A1AA]">
                  Songs in these folders are hidden from your library without deleting files
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExcludedFoldersModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {excludedFolders.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">
                No folders are currently excluded.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {excludedFolders.map((path) => (
                  <div
                    key={path}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1C1C22] border border-white/10"
                  >
                    <span className="text-xs font-mono text-zinc-200 truncate">{path}</span>
                    <button
                      type="button"
                      onClick={() => {
                        includeFolder(path);
                        showToast('Folder restored to Music Library');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-300 shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 7: MUSIC SEARCH OVERLAY                                         */}
      {/* ===================================================================== */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[135] bg-[#0A0A0C] flex flex-col p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="w-10 h-10 rounded-xl bg-[#141418] border border-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#B517FF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addRecentSearch(searchQuery);
                  }
                }}
                placeholder="Search songs, artists, albums, folders, playlists..."
                className="w-full bg-[#141418] border border-white/15 rounded-2xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B517FF]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!searchQuery.trim() ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#A1A1AA]">
                  Recent Music Searches
                </span>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="text-xs font-bold text-red-400"
                  >
                    Clear History
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  Type above to search across your entire local audio library.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSearchQuery(q)}
                      className="px-3.5 py-1.5 rounded-full bg-[#141418] border border-white/10 text-xs font-semibold text-zinc-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5 pb-20">
              {searchResults.songs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                    Songs ({searchResults.songs.length})
                  </h4>
                  {searchResults.songs.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => addRecentSearch(searchQuery)}
                    >
                      {renderSongRow(track, searchResults.songs, `Search • "${searchQuery}"`)}
                    </div>
                  ))}
                </div>
              )}

              {searchResults.albums.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                    Albums ({searchResults.albums.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {searchResults.albums.map((alb) => (
                      <button
                        key={alb.id}
                        type="button"
                        onClick={() => {
                          addRecentSearch(searchQuery);
                          setIsSearchOpen(false);
                          clearDrilldowns();
                          setSelectedAlbum(alb);
                        }}
                        className="p-3 rounded-2xl bg-[#141418] border border-white/10 text-left"
                      >
                        <p className="text-xs font-bold text-white truncate">{alb.name}</p>
                        <p className="text-[11px] text-[#A1A1AA] truncate">{alb.artist}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.artists.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                    Artists ({searchResults.artists.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {searchResults.artists.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => {
                          addRecentSearch(searchQuery);
                          setIsSearchOpen(false);
                          clearDrilldowns();
                          setSelectedArtist(art);
                        }}
                        className="p-3 rounded-2xl bg-[#141418] border border-white/10 text-left"
                      >
                        <p className="text-xs font-bold text-white truncate">{art.name}</p>
                        <p className="text-[11px] text-[#A1A1AA]">
                          {art.tracks.length} songs
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.folders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                    Folders ({searchResults.folders.length})
                  </h4>
                  {searchResults.folders.map((fld) => (
                    <button
                      key={fld.path}
                      type="button"
                      onClick={() => {
                        addRecentSearch(searchQuery);
                        setIsSearchOpen(false);
                        clearDrilldowns();
                        setSelectedFolder(fld);
                      }}
                      className="w-full p-3 rounded-2xl bg-[#141418] border border-white/10 text-left flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-white">{fld.name}</span>
                      <span className="text-[11px] text-[#A1A1AA]">
                        {fld.tracks.length} songs
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.songs.length === 0 &&
                searchResults.albums.length === 0 &&
                searchResults.artists.length === 0 &&
                searchResults.folders.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-12">
                    No matching songs, artists, albums, or folders found for "{searchQuery}".
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 8: MUSIC SETTINGS DRAWER                                        */}
      {/* ===================================================================== */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-h-[86vh] bg-[#141418] border-t border-white/15 rounded-t-3xl p-5 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#B517FF]" />
                <h3 className="text-base font-extrabold text-white">MaxPlay Music Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pt-4 pr-1">
              {/* 1. Library Settings */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                  Library Settings
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      scanDeviceMusic(true);
                      showToast('Scanning device for music...');
                    }}
                    className="p-3 rounded-xl bg-[#1C1C22] border border-white/10 text-left text-xs font-bold text-white"
                  >
                    Scan Device for Music
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      folderInputRef.current?.click();
                    }}
                    className="p-3 rounded-xl bg-[#1C1C22] border border-white/10 text-left text-xs font-bold text-white"
                  >
                    Select Music Folders
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setShowExcludedFoldersModal(true);
                    }}
                    className="p-3 rounded-xl bg-[#1C1C22] border border-white/10 text-left text-xs font-bold text-white"
                  >
                    Excluded Folders ({excludedFolders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      restoreAllHiddenSongs();
                      scanDeviceMusic(false);
                      showToast('Library refreshed & hidden songs restored');
                    }}
                    className="p-3 rounded-xl bg-[#1C1C22] border border-white/10 text-left text-xs font-bold text-white"
                  >
                    Refresh Library
                  </button>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#1C1C22] border border-white/10 cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-white">
                      Hide Short Audio Clips (under 30 seconds)
                    </p>
                    <p className="text-[10px] text-[#A1A1AA]">
                      Skips ringtones, WhatsApp voice notes & notification sounds
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.hideShortClipsUnder30s}
                    onChange={(e) =>
                      updateSettings({ hideShortClipsUnder30s: e.target.checked })
                    }
                    className="accent-[#8E2DE2] w-4 h-4"
                  />
                </label>
              </div>

              {/* 2. Playback Settings */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                  Playback Settings
                </h4>
                {[
                  {
                    key: 'gaplessPlayback' as const,
                    label: 'Gapless Playback',
                    desc: 'Seamless transitions between album tracks',
                  },
                  {
                    key: 'resumeOnLaunch' as const,
                    label: 'Resume Playback on App Launch',
                    desc: 'Restore your last active song queue',
                  },
                  {
                    key: 'autoPlayFolder' as const,
                    label: 'Auto Play Similar Folder / Queue',
                    desc: 'Continue playing next tracks in folder automatically',
                  },
                  {
                    key: 'rememberPosition' as const,
                    label: 'Remember Playback Position',
                    desc: 'Save timestamp on long mixes & audiobooks',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1C1C22] border border-white/10 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[item.key])}
                      onChange={(e) => updateSettings({ [item.key]: e.target.checked })}
                      className="accent-[#8E2DE2] w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              {/* 3. Appearance Settings */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B517FF]">
                  Appearance Settings
                </h4>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C1C22] border border-white/10">
                  <span className="text-xs font-bold text-white">Now Playing Artwork Style</span>
                  <div className="flex gap-1.5">
                    {(['rounded', 'square'] as const).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => updateSettings({ artworkRounded: shape })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold capitalize ${
                          settings.artworkRounded === shape
                            ? 'bg-[#6A11CB] text-white'
                            : 'bg-white/5 text-zinc-400'
                        }`}
                      >
                        {shape}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#1C1C22] border border-white/10 cursor-pointer">
                  <span className="text-xs font-bold text-white">
                    Show Folder Path in Song List
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.showFolderPathInList}
                    onChange={(e) =>
                      updateSettings({ showFolderPathInList: e.target.checked })
                    }
                    className="accent-[#8E2DE2] w-4 h-4"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

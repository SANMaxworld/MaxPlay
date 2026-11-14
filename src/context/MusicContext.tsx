import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MusicAlbum,
  MusicArtist,
  MusicFolder,
  MusicPlaylist,
  MusicSettingsState,
  MusicSortOption,
  MusicTrack,
  RepeatMode,
  SleepTimerMode,
} from '../types/music';
import {
  computeLibraryDiscovery,
  computeNextQueueIndex,
  filterVisibleLibrarySongs,
  groupTracksByAlbum,
  groupTracksByArtist,
  groupTracksByFolder,
  insertPlayNextInQueue,
  parseMetadataFromFilename,
  sortMusicTracks,
} from '../utils/musicUtils';
import { NativeBridgeService } from '../services/nativeBridgeService';

const MUSIC_STORAGE_KEYS = {
  FAVORITES: 'maxplay_music_favorites_v1',
  PLAY_STATS: 'maxplay_music_play_stats_v1',
  PLAYLISTS: 'maxplay_music_playlists_v1',
  EXCLUDED_FOLDERS: 'maxplay_music_excluded_folders_v1',
  HIDDEN_SONGS: 'maxplay_music_hidden_songs_v1',
  RECENT_SEARCHES: 'maxplay_music_recent_searches_v1',
  SETTINGS: 'maxplay_music_settings_v1',
  SORT_BY: 'maxplay_music_sort_by_v1',
  LAST_QUEUE_STATE: 'maxplay_music_last_queue_v1',
};

const DEFAULT_MUSIC_SETTINGS: MusicSettingsState = {
  hideShortClipsUnder30s: true,
  gaplessPlayback: true,
  crossfadeSec: 0,
  resumeOnLaunch: false,
  autoPlayFolder: true,
  rememberPosition: true,
  accentColor: '#8E2DE2',
  artworkRounded: 'rounded',
  showFolderPathInList: false,
  backgroundPlayback: true,
  notificationControls: true,
  lockScreenControls: true,
  headphoneControls: true,
  pauseOnDisconnect: true,
  audioFocusHandling: true,
};

// IndexedDB helper for persisting user-imported local audio files in Web/PWA & Android
const IDB_NAME = 'maxplay_local_music_vault_v1';
const IDB_STORE = 'audio_files';

interface StoredAudioRecord {
  id: string;
  title: string;
  fileName: string;
  artist: string;
  album: string;
  durationSec: number;
  sizeMb: number;
  sizeBytes: number;
  folderName: string;
  folderPath: string;
  format: string;
  mimeType: string;
  dateAdded: number;
  dateModified: number;
  blob: Blob;
}

function openMusicIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadImportedAudioFromIdb(): Promise<MusicTrack[]> {
  try {
    const db = await openMusicIdb();
    return await new Promise<MusicTrack[]>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as StoredAudioRecord[];
        const tracks: MusicTrack[] = records
          .filter((r) => r && r.blob instanceof Blob)
          .map((r) => ({
            id: r.id,
            title: r.title,
            fileName: r.fileName,
            artist: r.artist,
            album: r.album,
            durationSec: r.durationSec || 0,
            sizeMb: r.sizeMb || 0,
            sizeBytes: r.sizeBytes || r.blob.size,
            folderName: r.folderName || 'Imported Music',
            folderPath: r.folderPath || 'Internal Storage/Music',
            format: r.format || 'MP3',
            mimeType: r.mimeType || 'audio/mpeg',
            dateAdded: r.dateAdded || Date.now(),
            dateModified: r.dateModified || Date.now(),
            playbackUrl: URL.createObjectURL(r.blob),
          }));
        resolve(tracks);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function saveImportedAudioToIdb(record: StoredAudioRecord): Promise<void> {
  try {
    const db = await openMusicIdb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

function probeAudioBlobDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const tempAudio = document.createElement('audio');
    tempAudio.preload = 'metadata';
    const cleanup = () => {
      tempAudio.removeAttribute('src');
      tempAudio.load();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 3500);
    tempAudio.onloadedmetadata = () => {
      clearTimeout(timer);
      const dur = Number.isFinite(tempAudio.duration) ? Math.round(tempAudio.duration) : 0;
      cleanup();
      resolve(dur);
    };
    tempAudio.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(0);
    };
    tempAudio.src = blobUrl;
  });
}

interface MusicContextValue {
  // Library state
  allRawTracks: MusicTrack[];
  visibleTracks: MusicTrack[];
  sortedTracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  folders: MusicFolder[];
  playlists: MusicPlaylist[];
  discovery: {
    mostPlayed: MusicTrack[];
    recentlyAdded: MusicTrack[];
    recentlyPlayed: MusicTrack[];
    unplayedSongs: MusicTrack[];
    longestTracks: MusicTrack[];
  };
  isScanningMusic: boolean;
  sortBy: MusicSortOption;
  setSortBy: (opt: MusicSortOption) => void;
  excludedFolders: string[];
  hiddenSongIds: string[];
  recentSearches: string[];
  settings: MusicSettingsState;
  updateSettings: (partial: Partial<MusicSettingsState>) => void;

  // Playback state
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFullScreenPlayerOpen: boolean;
  setIsFullScreenPlayerOpen: (open: boolean) => void;
  sleepTimerMode: SleepTimerMode;
  sleepTimerRemainingSec: number | null;
  activeQueueSourceLabel: string;

  // Actions
  scanDeviceMusic: (requestPerm?: boolean) => Promise<void>;
  importLocalAudioFiles: (fileList: FileList | File[], customFolderName?: string) => Promise<number>;
  playTrack: (track: MusicTrack, contextQueue?: MusicTrack[], sourceLabel?: string) => void;
  playTrackList: (tracks: MusicTrack[], shuffleStart?: boolean, sourceLabel?: string) => void;
  togglePlayPause: () => void;
  pauseMusic: () => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  seekTo: (seconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  setSleepTimer: (mode: SleepTimerMode) => void;

  // Queue Management
  playNextInQueue: (track: MusicTrack) => void;
  addToQueueEnd: (track: MusicTrack | MusicTrack[]) => void;
  removeFromQueueIndex: (idx: number) => void;
  moveQueueItem: (fromIdx: number, toIdx: number) => void;
  clearQueue: () => void;
  jumpToQueueIndex: (idx: number) => void;

  // Favorites, Playlists & Folders
  toggleFavorite: (trackId: string) => void;
  createPlaylist: (name: string, initialTrackIds?: string[]) => MusicPlaylist;
  renamePlaylist: (playlistId: string, newName: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTrack: (playlistId: string, fromIdx: number, toIdx: number) => void;
  excludeFolder: (folderPath: string) => void;
  includeFolder: (folderPath: string) => void;
  hideSongFromLibrary: (trackId: string) => void;
  restoreAllHiddenSongs: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [nativeTracks, setNativeTracks] = useState<MusicTrack[]>([]);
  const [importedTracks, setImportedTracks] = useState<MusicTrack[]>([]);
  const [isScanningMusic, setIsScanningMusic] = useState<boolean>(false);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [playStats, setPlayStats] = useState<
    Record<string, { playCount: number; lastPlayedAt: number }>
  >(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.PLAY_STATS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.PLAYLISTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [excludedFolders, setExcludedFolders] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.EXCLUDED_FOLDERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [hiddenSongIds, setHiddenSongIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.HIDDEN_SONGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.RECENT_SEARCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<MusicSettingsState>(() => {
    try {
      const raw = localStorage.getItem(MUSIC_STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_MUSIC_SETTINGS, ...JSON.parse(raw) } : DEFAULT_MUSIC_SETTINGS;
    } catch {
      return DEFAULT_MUSIC_SETTINGS;
    }
  });

  const [sortBy, setSortByState] = useState<MusicSortOption>(() => {
    try {
      return (localStorage.getItem(MUSIC_STORAGE_KEYS.SORT_BY) as MusicSortOption) || 'recently_added';
    } catch {
      return 'recently_added';
    }
  });

  // Playback state
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState<boolean>(false);
  const [sleepTimerMode, setSleepTimerMode] = useState<SleepTimerMode>('off');
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [activeQueueSourceLabel, setActiveQueueSourceLabel] = useState<string>('Library');

  // Persist user preferences
  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.FAVORITES, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.PLAY_STATS, JSON.stringify(playStats));
    } catch {}
  }, [playStats]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch {}
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.EXCLUDED_FOLDERS, JSON.stringify(excludedFolders));
    } catch {}
  }, [excludedFolders]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.HIDDEN_SONGS, JSON.stringify(hiddenSongIds));
    } catch {}
  }, [hiddenSongIds]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recentSearches));
    } catch {}
  }, [recentSearches]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const setSortBy = useCallback((opt: MusicSortOption) => {
    setSortByState(opt);
    try {
      localStorage.setItem(MUSIC_STORAGE_KEYS.SORT_BY, opt);
    } catch {}
  }, []);

  const updateSettings = useCallback((partial: Partial<MusicSettingsState>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Load imported IndexedDB songs and scan Native Android MediaStore on startup
  const scanDeviceMusic = useCallback(async (requestPerm = false) => {
    setIsScanningMusic(true);
    try {
      const idbTracks = await loadImportedAudioFromIdb();
      setImportedTracks(idbTracks);

      const scanned = NativeBridgeService.scanDeviceLocalAudio(requestPerm);
      if (Array.isArray(scanned) && scanned.length > 0) {
        const mapped: MusicTrack[] = scanned.map((item) => ({
          id: item.id,
          mediaId: item.mediaId,
          title: item.title || 'Unknown Track',
          fileName: item.fileName || `${item.title}.mp3`,
          artist: item.artist || 'Unknown Artist',
          album: item.album || 'Unknown Album',
          albumId: item.albumId,
          durationSec: Number(item.durationSec) || 0,
          sizeMb: Number(item.sizeMb) || 0,
          sizeBytes: item.sizeBytes,
          folderName: item.folderName || 'Music',
          folderPath: item.folderPath || `Internal Storage/${item.folderName || 'Music'}`,
          format: item.format || 'MP3',
          mimeType: item.mimeType || 'audio/mpeg',
          dateAdded: Number(item.dateAdded) || Date.now(),
          dateModified: Number(item.dateModified) || Date.now(),
          playbackUrl: item.playbackUrl,
          artworkUrl: item.artworkUrl,
        }));
        setNativeTracks(mapped);
      }
    } finally {
      setIsScanningMusic(false);
    }
  }, []);

  useEffect(() => {
    scanDeviceMusic(false);
  }, [scanDeviceMusic]);

  // Import local audio files from <input type="file" /> or folder picker
  const importLocalAudioFiles = useCallback(
    async (fileList: FileList | File[], customFolderName?: string): Promise<number> => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return 0;
      setIsScanningMusic(true);
      let addedCount = 0;
      const newTracks: MusicTrack[] = [];

      try {
        for (const file of files) {
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          const isAudio =
            file.type.startsWith('audio/') ||
            ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus'].includes(ext);
          if (!isAudio) continue;

          const parsedMeta = parseMetadataFromFilename(file.name);
          const relPath = (file as any).webkitRelativePath || '';
          const relFolder = relPath ? relPath.split('/').slice(0, -1).join('/') : '';
          const folderName =
            customFolderName ||
            (relFolder ? relFolder.split('/').pop() || 'Imported Music' : 'Phone Audio');
          const folderPath = relFolder
            ? `Internal Storage/${relFolder}`
            : `Internal Storage/${folderName}`;

          const blobUrl = URL.createObjectURL(file);
          const durSec = await probeAudioBlobDuration(blobUrl);
          const sizeMb = Math.round((file.size / (1024 * 1024)) * 100) / 100;
          const id = `local_aud_${file.name.replace(/[^a-z0-9]/gi, '_')}_${file.size}`;

          const record: StoredAudioRecord = {
            id,
            title: parsedMeta.title,
            fileName: file.name,
            artist: parsedMeta.artist,
            album: folderName !== 'Phone Audio' ? folderName : 'Local Audio',
            durationSec: durSec,
            sizeMb,
            sizeBytes: file.size,
            folderName,
            folderPath,
            format: parsedMeta.format,
            mimeType: file.type || 'audio/mpeg',
            dateAdded: Math.floor(Date.now() / 1000),
            dateModified: Math.floor((file.lastModified || Date.now()) / 1000),
            blob: file,
          };

          await saveImportedAudioToIdb(record);
          newTracks.push({
            id: record.id,
            title: record.title,
            fileName: record.fileName,
            artist: record.artist,
            album: record.album,
            durationSec: record.durationSec,
            sizeMb: record.sizeMb,
            sizeBytes: record.sizeBytes,
            folderName: record.folderName,
            folderPath: record.folderPath,
            format: record.format,
            mimeType: record.mimeType,
            dateAdded: record.dateAdded,
            dateModified: record.dateModified,
            playbackUrl: blobUrl,
          });
          addedCount++;
        }

        if (newTracks.length > 0) {
          setImportedTracks((prev) => {
            const existingMap = new Map(prev.map((t) => [t.id, t]));
            for (const nt of newTracks) {
              existingMap.set(nt.id, nt);
            }
            return Array.from(existingMap.values());
          });
        }
      } finally {
        setIsScanningMusic(false);
      }
      return addedCount;
    },
    []
  );

  // Merge native + imported tracks with user favorites & play stats
  const allRawTracks = useMemo(() => {
    const favSet = new Set(favoriteIds);
    const mergedMap = new Map<string, MusicTrack>();
    for (const t of [...nativeTracks, ...importedTracks]) {
      const stats = playStats[t.id];
      mergedMap.set(t.id, {
        ...t,
        isFavorite: favSet.has(t.id),
        playCount: stats?.playCount || 0,
        lastPlayedAt: stats?.lastPlayedAt || 0,
      });
    }
    return Array.from(mergedMap.values());
  }, [nativeTracks, importedTracks, favoriteIds, playStats]);

  const visibleTracks = useMemo(
    () =>
      filterVisibleLibrarySongs(
        allRawTracks,
        excludedFolders,
        hiddenSongIds,
        settings.hideShortClipsUnder30s
      ),
    [allRawTracks, excludedFolders, hiddenSongIds, settings.hideShortClipsUnder30s]
  );

  const sortedTracks = useMemo(
    () => sortMusicTracks(visibleTracks, sortBy),
    [visibleTracks, sortBy]
  );

  const albums = useMemo(() => groupTracksByAlbum(visibleTracks), [visibleTracks]);
  const artists = useMemo(() => groupTracksByArtist(visibleTracks), [visibleTracks]);
  const folders = useMemo(
    () => groupTracksByFolder(allRawTracks, excludedFolders, hiddenSongIds),
    [allRawTracks, excludedFolders, hiddenSongIds]
  );
  const discovery = useMemo(() => computeLibraryDiscovery(visibleTracks), [visibleTracks]);

  // Keep currentTrack enriched with latest favorite/stats flags
  const currentTrack = useMemo(() => {
    const raw = queue[currentIndex] || null;
    if (!raw) return null;
    return allRawTracks.find((t) => t.id === raw.id) || raw;
  }, [queue, currentIndex, allRawTracks]);

  // Initialize hidden <audio> element once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      // Pause any playing video when music starts
      try {
        document.querySelectorAll('video').forEach((v) => {
          if (!v.paused) v.pause();
        });
      } catch {}
    };
    const onPause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    // Pause music automatically whenever a video starts playing in MaxPlay
    const handleVideoPlaying = () => {
      if (!audio.paused) {
        audio.pause();
      }
    };
    window.addEventListener('MAXPLAY_VIDEO_PLAYING', handleVideoPlaying);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      window.removeEventListener('MAXPLAY_VIDEO_PLAYING', handleVideoPlaying);
    };
  }, []);

  const recordTrackPlayed = useCallback((trackId: string) => {
    setPlayStats((prev) => {
      const existing = prev[trackId] || { playCount: 0, lastPlayedAt: 0 };
      return {
        ...prev,
        [trackId]: {
          playCount: existing.playCount + 1,
          lastPlayedAt: Date.now(),
        },
      };
    });
  }, []);

  const loadAndPlayTrackAtIndex = useCallback(
    (targetQueue: MusicTrack[], idx: number, autoStart = true) => {
      const track = targetQueue[idx];
      const audio = audioRef.current;
      if (!track || !audio) return;

      setCurrentIndex(idx);
      setCurrentTime(0);
      setDuration(track.durationSec || 0);

      if (audio.src !== track.playbackUrl) {
        audio.src = track.playbackUrl;
      }
      audio.playbackRate = playbackSpeed;
      audio.currentTime = 0;

      if (autoStart) {
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            recordTrackPlayed(track.id);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      }
    },
    [playbackSpeed, recordTrackPlayed]
  );

  // Handle track ended (respecting Sleep Timer 'end_of_song', RepeatMode, and Shuffle)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (sleepTimerMode === 'end_of_song') {
        setSleepTimerMode('off');
        setSleepTimerRemainingSec(null);
        setIsPlaying(false);
        return;
      }
      const nextIdx = computeNextQueueIndex(currentIndex, queue.length, repeatMode, isShuffle);
      if (nextIdx >= 0 && nextIdx < queue.length) {
        loadAndPlayTrackAtIndex(queue, nextIdx, true);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [currentIndex, queue, repeatMode, isShuffle, sleepTimerMode, loadAndPlayTrackAtIndex]);

  // Sleep Timer countdown effect
  useEffect(() => {
    if (sleepTimerMode === 'off' || sleepTimerMode === 'end_of_song') {
      if (sleepTimerMode === 'off') setSleepTimerRemainingSec(null);
      return;
    }
    const interval = setInterval(() => {
      setSleepTimerRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setSleepTimerMode('off');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMode]);

  const setSleepTimer = useCallback((mode: SleepTimerMode) => {
    setSleepTimerMode(mode);
    if (mode === 'off' || mode === 'end_of_song') {
      setSleepTimerRemainingSec(null);
    } else {
      const mins = parseInt(mode, 10) || 15;
      setSleepTimerRemainingSec(mins * 60);
    }
  }, []);

  const playTrack = useCallback(
    (track: MusicTrack, contextQueue?: MusicTrack[], sourceLabel = 'Library') => {
      const targetQueue = contextQueue && contextQueue.length > 0 ? contextQueue : sortedTracks;
      const foundIdx = targetQueue.findIndex((t) => t.id === track.id);
      const finalQueue = foundIdx >= 0 ? targetQueue : [track, ...targetQueue];
      const finalIdx = foundIdx >= 0 ? foundIdx : 0;
      setQueue(finalQueue);
      setActiveQueueSourceLabel(sourceLabel);
      loadAndPlayTrackAtIndex(finalQueue, finalIdx, true);
    },
    [sortedTracks, loadAndPlayTrackAtIndex]
  );

  const playTrackList = useCallback(
    (tracks: MusicTrack[], shuffleStart = false, sourceLabel = 'Library') => {
      if (!tracks || tracks.length === 0) return;
      setIsShuffle(shuffleStart);
      setQueue(tracks);
      setActiveQueueSourceLabel(sourceLabel);
      const startIdx = shuffleStart ? Math.floor(Math.random() * tracks.length) : 0;
      loadAndPlayTrackAtIndex(tracks, startIdx, true);
    },
    [loadAndPlayTrackAtIndex]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const pauseMusic = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const playNextTrack = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = computeNextQueueIndex(
      currentIndex,
      queue.length,
      repeatMode === 'one' ? 'all' : repeatMode === 'off' ? 'all' : repeatMode,
      isShuffle
    );
    if (nextIdx >= 0) {
      loadAndPlayTrackAtIndex(queue, nextIdx, true);
    }
  }, [queue, currentIndex, repeatMode, isShuffle, loadAndPlayTrackAtIndex]);

  const playPreviousTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;
    if (audio.currentTime > 3.5) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    loadAndPlayTrackAtIndex(queue, prevIdx, true);
  }, [queue, currentIndex, loadAndPlayTrackAtIndex]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(duration || audio.duration || 0, seconds));
    try {
      audio.currentTime = clamped;
      setCurrentTime(clamped);
    } catch {}
  }, [duration]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    const clamped = Math.max(0.5, Math.min(2.5, speed));
    setPlaybackSpeedState(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  // Sync MediaSession API for Lock Screen, Notification & Headphone Controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: currentTrack.artworkUrl
          ? [{ src: currentTrack.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
      navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          seekTo(details.seekTime);
        }
      });
    } catch {}
  }, [currentTrack, togglePlayPause, playPreviousTrack, playNextTrack, seekTo]);

  // Queue operations
  const playNextInQueue = useCallback(
    (track: MusicTrack) => {
      if (queue.length === 0) {
        playTrack(track, [track], 'Queue');
        return;
      }
      const res = insertPlayNextInQueue(queue, currentIndex, track);
      setQueue(res.queue);
      setCurrentIndex(res.nextCurrentIndex);
    },
    [queue, currentIndex, playTrack]
  );

  const addToQueueEnd = useCallback(
    (trackOrTracks: MusicTrack | MusicTrack[]) => {
      const list = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
      if (list.length === 0) return;
      if (queue.length === 0) {
        playTrackList(list, false, 'Queue');
        return;
      }
      setQueue((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const toAdd = list.filter((t) => !existingIds.has(t.id));
        return [...prev, ...toAdd];
      });
    },
    [queue.length, playTrackList]
  );

  const removeFromQueueIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queue.length) return;
      if (queue.length === 1) {
        audioRef.current?.pause();
        setQueue([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
        return;
      }
      const nextQueue = queue.filter((_, i) => i !== idx);
      setQueue(nextQueue);
      if (idx < currentIndex) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (idx === currentIndex) {
        const targetIdx = Math.min(idx, nextQueue.length - 1);
        loadAndPlayTrackAtIndex(nextQueue, targetIdx, isPlaying);
      }
    },
    [queue, currentIndex, isPlaying, loadAndPlayTrackAtIndex]
  );

  const moveQueueItem = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= queue.length ||
        toIdx >= queue.length ||
        fromIdx === toIdx
      ) {
        return;
      }
      const copy = [...queue];
      const currentId = copy[currentIndex]?.id;
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      setQueue(copy);
      if (currentId) {
        const newCurIdx = copy.findIndex((t) => t.id === currentId);
        if (newCurIdx !== -1) setCurrentIndex(newCurIdx);
      }
    },
    [queue, currentIndex]
  );

  const clearQueue = useCallback(() => {
    audioRef.current?.pause();
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const jumpToQueueIndex = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < queue.length) {
        loadAndPlayTrackAtIndex(queue, idx, true);
      }
    },
    [queue, loadAndPlayTrackAtIndex]
  );

  // Favorites, Playlists & Folders
  const toggleFavorite = useCallback((trackId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [trackId, ...prev]
    );
  }, []);

  const createPlaylist = useCallback(
    (name: string, initialTrackIds: string[] = []): MusicPlaylist => {
      const cleanName = name.trim() || 'My Playlist';
      const now = Date.now();
      const newPl: MusicPlaylist = {
        id: `pl_${now}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        trackIds: Array.from(new Set(initialTrackIds)),
        createdAt: now,
        updatedAt: now,
      };
      setPlaylists((prev) => [newPl, ...prev]);
      return newPl;
    },
    []
  );

  const renamePlaylist = useCallback((playlistId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === playlistId ? { ...pl, name: clean, updatedAt: Date.now() } : pl))
    );
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
  }, []);

  const addTracksToPlaylist = useCallback((playlistId: string, trackIds: string[]) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const merged = Array.from(new Set([...pl.trackIds, ...trackIds]));
        return { ...pl, trackIds: merged, updatedAt: Date.now() };
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              trackIds: pl.trackIds.filter((id) => id !== trackId),
              updatedAt: Date.now(),
            }
          : pl
      )
    );
  }, []);

  const reorderPlaylistTrack = useCallback(
    (playlistId: string, fromIdx: number, toIdx: number) => {
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          if (
            fromIdx < 0 ||
            toIdx < 0 ||
            fromIdx >= pl.trackIds.length ||
            toIdx >= pl.trackIds.length
          ) {
            return pl;
          }
          const copy = [...pl.trackIds];
          const [moved] = copy.splice(fromIdx, 1);
          copy.splice(toIdx, 0, moved);
          return { ...pl, trackIds: copy, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  const excludeFolder = useCallback((folderPath: string) => {
    setExcludedFolders((prev) =>
      prev.some((p) => p.toLowerCase() === folderPath.toLowerCase())
        ? prev
        : [...prev, folderPath]
    );
  }, []);

  const includeFolder = useCallback((folderPath: string) => {
    setExcludedFolders((prev) =>
      prev.filter((p) => p.toLowerCase() !== folderPath.toLowerCase())
    );
  }, []);

  const hideSongFromLibrary = useCallback((trackId: string) => {
    setHiddenSongIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
  }, []);

  const restoreAllHiddenSongs = useCallback(() => {
    setHiddenSongIds([]);
  }, []);

  const addRecentSearch = useCallback((query: string) => {
    const clean = query.trim();
    if (!clean) return;
    setRecentSearches((prev) => [clean, ...prev.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, 12));
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  const value: MusicContextValue = {
    allRawTracks,
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
    scanDeviceMusic,
    importLocalAudioFiles,
    playTrack,
    playTrackList,
    togglePlayPause,
    pauseMusic,
    playNextTrack,
    playPreviousTrack,
    seekTo,
    setPlaybackSpeed,
    setRepeatMode,
    cycleRepeatMode,
    toggleShuffle,
    setSleepTimer,
    playNextInQueue,
    addToQueueEnd,
    removeFromQueueIndex,
    moveQueueItem,
    clearQueue,
    jumpToQueueIndex,
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
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return ctx;
}

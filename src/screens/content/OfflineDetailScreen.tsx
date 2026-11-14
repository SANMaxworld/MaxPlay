import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Check,
  Play,
  Film,
  Tv,
  ChevronRight,
  ChevronDown,
  Server,
  Download,
  Plus,
  Share2,
  HelpCircle,
  Globe,
  Sliders,
  Layers,
  X,
  Star,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadedFile, downloadManager } from '../../services/DownloadManager';
import { InlinePlayer } from '../../components/player/InlinePlayer';
import { NativeBanner } from '../../components/ads/NativeBanner';
import { ContentCard } from '../../components/common/ContentCard';
import { useContent } from '../../hooks/useContent';
import { useGeneralSettings } from '../../hooks/useGeneralSettings';
import { NativeBridgeService } from '../../services/nativeBridgeService';
import { ContentItem } from '../../types';

interface OfflineDetailScreenProps {
  initialFile: DownloadedFile;
  initialBlobUrl?: string;
  allDownloadedEpisodes?: DownloadedFile[];
  onBack: () => void;
  onSelectContent?: (content: ContentItem) => void;
}

export const OfflineDetailScreen: React.FC<OfflineDetailScreenProps> = ({
  initialFile,
  initialBlobUrl,
  allDownloadedEpisodes = [],
  onBack,
  onSelectContent,
}) => {
  const { contentList } = useContent();
  const { apkDownloadUrl, shareDownloadUrl } = useGeneralSettings();

  const [currentFile, setCurrentFile] = useState<DownloadedFile>(initialFile);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | undefined>(initialBlobUrl);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAllEpisodesDrawer, setShowAllEpisodesDrawer] = useState(false);
  const [showLanguageDrawer, setShowLanguageDrawer] = useState(false);
  const [showQualityDrawer, setShowQualityDrawer] = useState(false);
  const [showServerDrawer, setShowServerDrawer] = useState(false);
  const [showHelpConfirmTooltip, setShowHelpConfirmTooltip] = useState(false);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);
  const [recSeed, setRecSeed] = useState(1);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [savedInMyList, setSavedInMyList] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Match catalog content item if this offline download came from MaxPlay catalog
  const matchedCatalogItem = useMemo(() => {
    if (!contentList || contentList.length === 0) return null;
    if (currentFile.contentId && !currentFile.contentId.startsWith('dev_vid_')) {
      const byId = contentList.find((c) => c.id === currentFile.contentId);
      if (byId) return byId;
    }
    const cleanTitle = (currentFile.title || '').toLowerCase().trim();
    return contentList.find((c) => (c.title || '').toLowerCase().trim() === cleanTitle) || null;
  }, [contentList, currentFile]);

  useEffect(() => {
    // Pause any background video players in other tabs so Android hardware MediaCodec decoders are freed
    try {
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause();
        } catch {}
      });
    } catch {}
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const fetchUrl = async () => {
      try {
        if (currentFile.videoUrl && currentFile.videoUrl.includes('/device-video/')) {
          if (!isCancelled) {
            setCurrentBlobUrl(currentFile.videoUrl);
          }
          return;
        }
        const url = await downloadManager.getOfflineVideoUrl(
          currentFile.id,
          currentFile.episodeId,
          currentFile.episodeIndex
        );
        if (!isCancelled && url) {
          setCurrentBlobUrl(url);
        } else if (!isCancelled && currentFile.videoUrl) {
          setCurrentBlobUrl(currentFile.videoUrl);
        }
      } catch (err) {
        console.warn('Failed to load blobUrl in OfflineDetailScreen:', err);
      }
    };

    fetchUrl();

    return () => {
      isCancelled = true;
    };
  }, [currentFile]);

  // Determine if this item is a single movie vs multi-episode series / multi-video folder
  const isMovie = useMemo(() => {
    if (allDownloadedEpisodes && allDownloadedEpisodes.length > 1) {
      return false;
    }
    return (
      currentFile.category === 'movie' ||
      (!currentFile.episodeId && currentFile.episodeIndex === undefined)
    );
  }, [currentFile, allDownloadedEpisodes]);

  // Extract and sort downloaded episodes in ascending numeric order (1, 2, 3...)
  const sortedEpisodes = useMemo(() => {
    if (!allDownloadedEpisodes || allDownloadedEpisodes.length <= 1) {
      if (!isMovie && allDownloadedEpisodes.length === 1) return allDownloadedEpisodes;
      return [];
    }

    const getEpisodeNumber = (ep: DownloadedFile, idx: number): number => {
      if (ep.episodeIndex !== undefined) return ep.episodeIndex + 1;
      const numMatch = ep.episodeId?.match(/\d+/);
      if (numMatch) return parseInt(numMatch[0], 10);
      const titleMatch =
        ep.subtitle?.match(/episode\s*(\d+)/i) || ep.title?.match(/episode\s*(\d+)/i);
      if (titleMatch) return parseInt(titleMatch[1], 10);
      return idx + 1;
    };

    return [...allDownloadedEpisodes].sort((a, b) => {
      return getEpisodeNumber(a, 0) - getEpisodeNumber(b, 0);
    });
  }, [isMovie, allDownloadedEpisodes]);

  const currentEpIndex = useMemo(() => {
    if (sortedEpisodes.length === 0) return -1;
    return sortedEpisodes.findIndex(
      (e) => e.id === currentFile.id || (e.storageKey && e.storageKey === currentFile.storageKey)
    );
  }, [sortedEpisodes, currentFile]);

  const hasNextEpisode = currentEpIndex >= 0 && currentEpIndex < sortedEpisodes.length - 1;

  const handleSelectEpisode = async (ep: DownloadedFile) => {
    try {
      setCurrentFile(ep);
      if (ep.videoUrl && ep.videoUrl.includes('/device-video/')) {
        setCurrentBlobUrl(ep.videoUrl);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const url = await downloadManager.getOfflineVideoUrl(ep.id, ep.episodeId, ep.episodeIndex);
      if (url) {
        setCurrentBlobUrl(url);
      } else if (ep.videoUrl) {
        setCurrentBlobUrl(ep.videoUrl);
      }
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('Failed to switch offline episode:', err);
    }
  };

  const handleNextEpisode = () => {
    if (hasNextEpisode) {
      handleSelectEpisode(sortedEpisodes[currentEpIndex + 1]);
    }
  };

  const getEpLabel = (ep: DownloadedFile, idx?: number): string => {
    if (ep.episodeIndex !== undefined) {
      return (ep.episodeIndex + 1).toString().padStart(2, '0');
    }
    const numMatch = ep.episodeId?.match(/\d+/);
    if (numMatch) {
      return parseInt(numMatch[0], 10).toString().padStart(2, '0');
    }
    if (idx !== undefined) {
      return (idx + 1).toString().padStart(2, '0');
    }
    return '01';
  };

  const playerTitle = useMemo(() => {
    if (isMovie || sortedEpisodes.length <= 1) {
      return currentFile.title;
    }
    const epNum = getEpLabel(currentFile, currentEpIndex >= 0 ? currentEpIndex : 0);
    return `${currentFile.title} • Ep ${epNum}`;
  }, [isMovie, currentFile, sortedEpisodes.length, currentEpIndex]);

  // Real Recommendations from catalog for the "For you" section
  const recommendations = useMemo(() => {
    if (!contentList || contentList.length === 0) return [];
    const mockIds = new Set([
      'one-piece-egghead',
      'naruto-shippuden-classic',
      'avatar-way-of-water',
      'dune-part-two',
      'stranger-things-s5',
      'breaking-bad-remastered',
      'solo-leveling-arise',
    ]);
    const pool = contentList.filter(
      (c) =>
        c.id !== currentFile.contentId &&
        !mockIds.has(c.id) &&
        !(c.posterUrl && c.posterUrl.includes('images.unsplash.com'))
    );
    const list = pool.length > 0 ? [...pool] : [...contentList];
    let seed = Math.max(1, recSeed) * 9301 + 49297;
    for (let i = list.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, 12);
  }, [contentList, currentFile.contentId, recSeed]);

  const handleRefreshRecs = () => {
    setIsRefreshingRecs(true);
    setTimeout(() => {
      setRecSeed((prev) => prev + 1);
      setIsRefreshingRecs(false);
    }, 350);
  };

  useEffect(() => {
    try {
      const targetId = matchedCatalogItem?.id || currentFile.contentId || currentFile.id;
      const list = JSON.parse(localStorage.getItem('maxplay_my_list') || '[]');
      setSavedInMyList(Array.isArray(list) && list.some((item: any) => item?.id === targetId || item === targetId));
    } catch {
      setSavedInMyList(false);
    }
  }, [matchedCatalogItem, currentFile]);

  const handleToggleMyList = () => {
    try {
      const targetId = matchedCatalogItem?.id || currentFile.contentId || currentFile.id;
      const raw = JSON.parse(localStorage.getItem('maxplay_my_list') || '[]');
      const list = Array.isArray(raw) ? raw : [];
      const exists = list.some((item: any) => item?.id === targetId || item === targetId);
      if (exists) {
        const next = list.filter((item: any) => item?.id !== targetId && item !== targetId);
        localStorage.setItem('maxplay_my_list', JSON.stringify(next));
        setSavedInMyList(false);
      } else {
        const entry = matchedCatalogItem || {
          id: targetId,
          title: currentFile.title,
          posterUrl: currentFile.posterUrl,
          type: isMovie ? 'movie' : 'series',
        };
        localStorage.setItem('maxplay_my_list', JSON.stringify([entry, ...list]));
        setSavedInMyList(true);
      }
    } catch {}
  };

  const handleShare = async () => {
    const itemTitle = matchedCatalogItem?.title || currentFile.title || 'MaxPlay Video';
    const contentId = matchedCatalogItem?.id || currentFile.contentId || '';
    const adminDownloadUrl = (shareDownloadUrl || apkDownloadUrl || '').trim();
    const isRealCatalogContent = Boolean(contentId && !contentId.startsWith('dev_vid_'));

    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const isInternalOrLocalOrigin =
      !currentOrigin ||
      currentOrigin.includes('localhost') ||
      currentOrigin.includes('127.0.0.1') ||
      currentOrigin.includes('appassets.androidplatform.net');

    const publicBaseUrl = !isInternalOrLocalOrigin
      ? currentOrigin.replace(/\/+$/, '')
      : 'https://ais-pre-yzg6gpi5jxavdg2ivlhyef-775675507395.asia-southeast1.run.app';

    const lines: string[] = [`🎬 *${itemTitle}* — Watch Free in HD on MaxPlay`];
    if (isRealCatalogContent) {
      lines.push('');
      lines.push(`▶️ Content Link (Open in MaxPlay App):`);
      lines.push(`${publicBaseUrl}/open/${encodeURIComponent(contentId)}`);
    }
    if (adminDownloadUrl) {
      lines.push('');
      lines.push(`📲 Download MaxPlay Official App:`);
      lines.push(adminDownloadUrl);
    }

    const sharePayloadText = lines.join('\n');
    if (NativeBridgeService.shareContentNative(itemTitle, sharePayloadText, '')) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: itemTitle,
          text: sharePayloadText,
        });
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(sharePayloadText);
      setShareToast('Share link copied to clipboard!');
      setTimeout(() => setShareToast(null), 2500);
    } catch {}
  };

  const isLocalDeviceVideo = currentFile.category === 'local';
  const sizeFormatted =
    currentFile.fileSizeMb >= 1024
      ? `${(currentFile.fileSizeMb / 1024).toFixed(1)} GB`
      : `${Math.round(currentFile.fileSizeMb || 0)} MB`;
  const ratingValue = matchedCatalogItem?.rating || '8.8';
  const yearOrSize = matchedCatalogItem?.year || sizeFormatted;
  const countryOrFolder =
    matchedCatalogItem?.country ||
    (isLocalDeviceVideo ? currentFile.language || 'Phone Storage' : 'Offline Vault');
  const genresText =
    matchedCatalogItem?.genres && matchedCatalogItem.genres.length > 0
      ? matchedCatalogItem.genres.join(' / ')
      : isLocalDeviceVideo
      ? 'Local Video'
      : isMovie
      ? 'Movie'
      : 'Series';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#09090B] text-white overflow-hidden select-none">
      {/* 1. STICKY TOP VIDEO PLAYER SECTION (Identical to ContentDetailScreen) */}
      <div className="w-full bg-black shrink-0 relative z-30 shadow-2xl">
        <div className="w-full max-w-5xl mx-auto aspect-video max-h-[48vh] sm:max-h-[55vh]">
          <InlinePlayer
            title={playerTitle}
            posterUrl={
              matchedCatalogItem?.backdropUrl ||
              matchedCatalogItem?.posterUrl ||
              (currentFile.posterUrl && !currentFile.posterUrl.includes('/device-video-thumb/')
                ? currentFile.posterUrl
                : undefined)
            }
            videoUrl={currentBlobUrl || currentFile.videoUrl || ''}
            availableLanguages={currentFile.language ? [currentFile.language] : ['Default']}
            activeLanguage={currentFile.language || 'Default'}
            activeQuality={currentFile.quality || 'auto'}
            onBack={onBack}
            autoPlay={true}
            hasNextEpisode={hasNextEpisode}
            onNextEpisode={hasNextEpisode ? handleNextEpisode : undefined}
            streamKey={`offline_${currentFile.id}_${currentFile.storageKey || ''}`}
          />
        </div>
      </div>

      {/* 2. SCROLLABLE DETAILS CONTENT BELOW PLAYER (Unified with ContentDetailScreen) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-[#09090B] text-white font-sans scroll-smooth pb-24"
      >
        <div className="w-full max-w-5xl mx-auto px-4 pt-3 pb-6 space-y-3.5 text-left">
          {/* ROW 1: Title (left) & Info > Button (right) */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
              {matchedCatalogItem?.title || currentFile.title}
            </h1>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="flex items-center gap-0.5 text-xs font-medium text-white/60 hover:text-white shrink-0 transition cursor-pointer py-1"
            >
              <span>Info</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ROW 2: Single-Line Horizontal Metadata Scroll Row */}
          <div className="flex items-center gap-2 text-xs text-white/70 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5">
            <span className="flex items-center text-white/80 shrink-0">
              {isMovie ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
            </span>

            <span className="text-white/20">|</span>

            <span className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
              <span>★</span>
              <span>{ratingValue}</span>
            </span>

            {currentFile.quality && (
              <>
                <span className="text-white/20">|</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase shrink-0">
                  {currentFile.quality}
                </span>
              </>
            )}

            <span className="text-white/20">|</span>
            <span className="shrink-0">{yearOrSize}</span>

            <span className="text-white/20">|</span>
            <span className="shrink-0">{countryOrFolder}</span>

            <span className="text-white/20">|</span>
            <span className="text-white/60 shrink-0">{genresText}</span>
          </div>

          {/* ROW 3: 4-Button Horizontal Action Pill Bar (Server | Downloaded | My List | Share) */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {/* 1. Server Button */}
            <button
              type="button"
              onClick={() => setShowServerDrawer(true)}
              className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold transition cursor-pointer border bg-[#16161C] hover:bg-[#1E1E26] text-white/90 border-white/10"
            >
              <Server className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{isLocalDeviceVideo ? 'Local' : 'Vault'}</span>
            </button>

            {/* 2. Download Status Button */}
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Downloaded</span>
            </button>

            {/* 3. My List Button */}
            <button
              type="button"
              onClick={handleToggleMyList}
              className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                savedInMyList
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#16161C] hover:bg-[#1E1E26] text-white/90 border-white/10'
              }`}
            >
              {savedInMyList ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Saved</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-white/80 shrink-0" />
                  <span className="truncate">My List</span>
                </>
              )}
            </button>

            {/* 4. Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-[#16161C] hover:bg-[#1E1E26] text-white/90 border border-white/10 text-xs font-semibold transition cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">Share</span>
            </button>
          </div>

          {shareToast && (
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 text-center">
              {shareToast}
            </div>
          )}

          {/* ROW 4: Playback & Resources Section */}
          <div className="pt-2 space-y-2.5">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]" />
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Playback &amp; Resources
                </span>
              </div>
              <div className="relative flex items-center gap-1 text-[11px] text-white/50">
                <span>Uploaded by MaxPlay Admin</span>
                <button
                  type="button"
                  onClick={() => setShowHelpConfirmTooltip((prev) => !prev)}
                  className="p-0.5 text-white/50 hover:text-purple-400 transition cursor-pointer"
                  title="Need help or want to report an issue?"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>

                <AnimatePresence>
                  {showHelpConfirmTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 top-6 z-50 w-64 rounded-xl bg-[#181820] border border-purple-500/40 p-3 shadow-2xl text-left"
                    >
                      <p className="text-xs font-semibold text-white leading-snug">
                        Facing an issue with this video or audio?
                      </p>
                      <p className="text-[11px] text-white/60 mt-0.5">
                        Tap below to open Feedback &amp; Support and report it directly to Admin.
                      </p>
                      <div className="mt-2.5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHelpConfirmTooltip(false)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-white/70 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowHelpConfirmTooltip(false);
                            onBack();
                            window.dispatchEvent(new CustomEvent('MAXPLAY_OPEN_FEEDBACK_SCREEN'));
                          }}
                          className="px-3 py-1 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-[11px] font-bold text-white shadow-md shadow-purple-600/30 cursor-pointer"
                        >
                          Go to Feedback
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Selector Boxes Row: Language | Quality | Season (if series) */}
            <div
              className={`grid ${
                !isMovie && sortedEpisodes.length > 0 ? 'grid-cols-3' : 'grid-cols-2'
              } gap-2`}
            >
              {/* Language Selector Box */}
              <button
                type="button"
                onClick={() => setShowLanguageDrawer(true)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#141419] hover:bg-[#1B1B22] border border-white/10 text-left transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-white/45 font-medium flex items-center gap-1">
                    <Globe className="w-3 h-3 text-purple-400 shrink-0" />
                    <span>Language</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate mt-0.5">
                    {currentFile.language || 'Default'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0 ml-1" />
              </button>

              {/* Quality Selector Box */}
              <button
                type="button"
                onClick={() => setShowQualityDrawer(true)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#141419] hover:bg-[#1B1B22] border border-white/10 text-left transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-white/45 font-medium flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>Quality</span>
                  </div>
                  <div className="text-xs font-bold text-white uppercase truncate mt-0.5">
                    {currentFile.quality || 'HD'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0 ml-1" />
              </button>

              {/* Season / Folder Selector Box (Series or Multi-video Folder) */}
              {!isMovie && sortedEpisodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllEpisodesDrawer(true)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#141419] hover:bg-[#1B1B22] border border-white/10 text-left transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-white/45 font-medium flex items-center gap-1">
                      <Layers className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{isLocalDeviceVideo ? 'Folder' : 'Season'}</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      {isLocalDeviceVideo
                        ? `${sortedEpisodes.length} Videos`
                        : `Season ${(currentFile.seasonIndex ?? 0) + 1}`}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0 ml-1" />
                </button>
              )}
            </div>

            {/* Movie Title Bar OR Horizontal Episode Selector Row */}
            {isMovie || sortedEpisodes.length <= 1 ? (
              <button
                type="button"
                onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-bold text-xs sm:text-sm text-center truncate shadow-lg shadow-purple-900/30 cursor-pointer active:scale-[0.99] transition"
              >
                {currentFile.title}
              </button>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                {/* "All" Button on Left */}
                <button
                  type="button"
                  onClick={() => setShowAllEpisodesDrawer(true)}
                  className="h-11 px-3.5 rounded-xl bg-[#18181F] hover:bg-[#22222C] border border-white/10 text-xs font-bold text-white/90 shrink-0 flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <span>All</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                </button>

                {/* Horizontal Scrollable Row of Numbered Square Episode Boxes */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1">
                  {sortedEpisodes.map((ep, idx) => {
                    const isCurrent =
                      ep.id === currentFile.id ||
                      (ep.storageKey && ep.storageKey === currentFile.storageKey);
                    const epNum = getEpLabel(ep, idx);

                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => handleSelectEpisode(ep)}
                        className={`relative h-11 w-11 shrink-0 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer border ${
                          isCurrent
                            ? 'bg-[#8B5CF6] border-purple-400 text-white shadow-md shadow-purple-600/30'
                            : 'bg-[#141419] border-white/10 text-white/75 hover:bg-[#1E1E26] hover:text-white'
                        }`}
                      >
                        <span>{epNum}</span>
                        {isCurrent && (
                          <div className="flex items-end gap-0.5 h-2 mt-0.5">
                            <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="w-0.5 h-2 bg-white rounded-full" />
                            <span className="w-0.5 h-1 bg-white rounded-full animate-pulse" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* NATIVE BANNER AD */}
          <div className="pt-1 pb-1">
            <NativeBanner />
          </div>

          {/* FOR YOU SECTION (Identical to ContentDetailScreen) */}
          {recommendations.length > 0 && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">For you</span>
                <button
                  type="button"
                  onClick={handleRefreshRecs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-white/80 hover:text-white transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingRecs ? 'animate-spin text-purple-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {recommendations.map((recItem) => (
                  <ContentCard
                    key={recItem.id}
                    item={recItem}
                    onPress={(selected) => {
                      if (onSelectContent) {
                        onSelectContent(selected);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLIDE-UP MODAL 1: INFO SHEET */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-2xl bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Content Details</h3>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4">
                {matchedCatalogItem?.posterUrl || currentFile.posterUrl ? (
                  <img
                    src={matchedCatalogItem?.posterUrl || currentFile.posterUrl}
                    alt={currentFile.title}
                    className="w-24 h-36 object-cover rounded-xl border border-white/10 shrink-0 bg-black"
                  />
                ) : null}
                <div className="space-y-1.5 min-w-0">
                  <h4 className="text-base font-extrabold text-white">
                    {matchedCatalogItem?.title || currentFile.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {ratingValue}
                    </span>
                    <span>•</span>
                    <span>{yearOrSize}</span>
                    <span>•</span>
                    <span>{countryOrFolder}</span>
                    {currentFile.quality && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400 font-bold uppercase">{currentFile.quality}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(matchedCatalogItem?.genres || [genresText]).map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/80"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-white/50">Synopsis &amp; File Info</h5>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed whitespace-pre-line">
                  {matchedCatalogItem?.description ||
                    currentFile.subtitle ||
                    `Saved offline in your device storage (${sizeFormatted} • ${currentFile.quality || 'HD'} • ${currentFile.language || 'Default'}). Ready for instant zero-data playback.`}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP MODAL 2: LANGUAGE SELECTOR DRAWER */}
      <AnimatePresence>
        {showLanguageDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowLanguageDrawer(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 space-y-3 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">Select Audio Language</h3>
                <button
                  type="button"
                  onClick={() => setShowLanguageDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLanguageDrawer(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold border bg-purple-600/20 border-purple-500 text-purple-300 cursor-pointer"
                >
                  <span className="truncate">{currentFile.language || 'Default'}</span>
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP MODAL 3: QUALITY SELECTOR DRAWER */}
      <AnimatePresence>
        {showQualityDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowQualityDrawer(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 space-y-3 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">Offline Video Quality</h3>
                <button
                  type="button"
                  onClick={() => setShowQualityDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowQualityDrawer(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase border bg-purple-600/20 border-purple-500 text-purple-300 cursor-pointer"
                >
                  <span>{currentFile.quality || 'HD'} ({sizeFormatted})</span>
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP MODAL 4: SERVER SOURCE DRAWER */}
      <AnimatePresence>
        {showServerDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowServerDrawer(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 space-y-3 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">Playback Source</h3>
                <button
                  type="button"
                  onClick={() => setShowServerDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowServerDrawer(false)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold border bg-purple-600/20 border-purple-500 text-purple-300 cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-white">
                    {isLocalDeviceVideo ? 'Phone Local Storage' : 'MaxPlay Offline Vault'}
                  </span>
                  <span className="text-[11px] text-white/60 mt-0.5">
                    Zero internet data • Direct hardware playback ({sizeFormatted})
                  </span>
                </div>
                <Check className="w-4 h-4 text-purple-400 shrink-0" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP MODAL 5: ALL EPISODES DRAWER */}
      <AnimatePresence>
        {showAllEpisodesDrawer && sortedEpisodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAllEpisodesDrawer(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-2xl bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 max-h-[75vh] overflow-y-auto space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">
                  All Videos ({sortedEpisodes.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAllEpisodesDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
                {sortedEpisodes.map((ep, idx) => {
                  const isCurrent =
                    ep.id === currentFile.id ||
                    (ep.storageKey && ep.storageKey === currentFile.storageKey);
                  const epNum = getEpLabel(ep, idx);
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        handleSelectEpisode(ep);
                        setShowAllEpisodesDrawer(false);
                      }}
                      className={`h-11 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer border ${
                        isCurrent
                          ? 'bg-[#8B5CF6] border-purple-400 text-white shadow-md shadow-purple-600/30'
                          : 'bg-[#181820] border-white/10 text-white/80 hover:bg-[#22222C]'
                      }`}
                    >
                      <span>{epNum}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

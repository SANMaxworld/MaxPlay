import { MusicEqualizerState, VolumeBoostLevel } from '../types/music';

/**
 * Returns true only when audio effects actually alter the signal (non-zero EQ band,
 * bass boost, immersive boost, or >100% loudness amplification).
 * Avoiding unnecessary Web Audio / Android AudioEffect session-0 attachment when neutral
 * prevents hardware HAL and AudioContext suspension from muting normal music playback.
 */
export function hasActiveAudioEffects(
  equalizer: Pick<MusicEqualizerState, 'enabled' | 'bands' | 'bassLevel' | 'immersiveLevel'>,
  volumeBoostPct: VolumeBoostLevel | number
): boolean {
  if ((volumeBoostPct || 100) > 100) return true;
  if (!equalizer || !equalizer.enabled) return false;
  const hasNonFlatBand = Array.isArray(equalizer.bands) && equalizer.bands.some((db) => Math.abs(db || 0) > 0.05);
  return hasNonFlatBand || (equalizer.bassLevel || 0) > 0 || (equalizer.immersiveLevel || 0) > 0;
}

export function shouldResumeAudioContext(
  ctxState: string | undefined | null,
  isIntendedPlaying: boolean
): boolean {
  if (!isIntendedPlaying || !ctxState) return false;
  return ctxState !== 'running' && ctxState !== 'closed';
}

export function canRecoverAudioPlayback(
  isIntendedPlaying: boolean,
  attemptCount: number,
  maxAttempts: number = 2
): boolean {
  return isIntendedPlaying && attemptCount < maxAttempts;
}

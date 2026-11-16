import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRecoverAudioPlayback,
  hasActiveAudioEffects,
  shouldResumeAudioContext,
} from './musicPlaybackUtils.ts';

describe('musicPlaybackUtils', () => {
  it('detects when equalizer/volume boost actually modifies audio', () => {
    assert.equal(
      hasActiveAudioEffects(
        { enabled: true, bands: [0, 0, 0, 0, 0], bassLevel: 0, immersiveLevel: 0 },
        100
      ),
      false
    );
    assert.equal(
      hasActiveAudioEffects(
        { enabled: false, bands: [5, 0, 0, 0, 0], bassLevel: 50, immersiveLevel: 40 },
        100
      ),
      false
    );
    assert.equal(
      hasActiveAudioEffects(
        { enabled: false, bands: [0, 0, 0, 0, 0], bassLevel: 0, immersiveLevel: 0 },
        200
      ),
      true
    );
    assert.equal(
      hasActiveAudioEffects(
        { enabled: true, bands: [0, 2, 0, 0, 0], bassLevel: 0, immersiveLevel: 0 },
        100
      ),
      true
    );
    assert.equal(
      hasActiveAudioEffects(
        { enabled: true, bands: [0, 0, 0, 0, 0], bassLevel: 25, immersiveLevel: 0 },
        100
      ),
      true
    );
  });

  it('resumes AudioContext whenever suspended/interrupted during intended playback', () => {
    assert.equal(shouldResumeAudioContext('suspended', true), true);
    assert.equal(shouldResumeAudioContext('interrupted', true), true);
    assert.equal(shouldResumeAudioContext('running', true), false);
    assert.equal(shouldResumeAudioContext('closed', true), false);
    assert.equal(shouldResumeAudioContext('suspended', false), false);
  });

  it('bounds mid-song playback stall recovery attempts cleanly', () => {
    assert.equal(canRecoverAudioPlayback(true, 0, 2), true);
    assert.equal(canRecoverAudioPlayback(true, 1, 2), true);
    assert.equal(canRecoverAudioPlayback(true, 2, 2), false);
    assert.equal(canRecoverAudioPlayback(false, 0, 2), false);
  });
});

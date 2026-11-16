import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractValidQualityLinksMap,
  hasAnyValidLinkInSources,
  isValidStreamUrl,
  resolveServerWhenMissingOrCorrupt,
} from './serverSelection.ts';

describe('serverSelection', () => {
  it('validates clean stream URLs and rejects missing/corrupt placeholders', () => {
    assert.equal(isValidStreamUrl('https://streamtape.com/v/6kjz8WP38qT9AKg/test.mkv.mp4'), true);
    assert.equal(isValidStreamUrl('http://cdn.example.com/master.m3u8'), true);
    assert.equal(isValidStreamUrl('/api/stream-proxy?url=https%3A%2F%2Ftapecontent.net%2Fa.mp4'), true);
    assert.equal(isValidStreamUrl('blob:https://maxplay.local/12345'), true);

    assert.equal(isValidStreamUrl(''), false);
    assert.equal(isValidStreamUrl('   '), false);
    assert.equal(isValidStreamUrl(null), false);
    assert.equal(isValidStreamUrl(undefined), false);
    assert.equal(isValidStreamUrl('undefined'), false);
    assert.equal(isValidStreamUrl('null'), false);
    assert.equal(isValidStreamUrl('N/A'), false);
    assert.equal(isValidStreamUrl('corrupt'), false);
    assert.equal(isValidStreamUrl('http://'), false);
    assert.equal(isValidStreamUrl('https://bad host with spaces.com/video.mp4'), false);
    assert.equal(isValidStreamUrl('<html>404</html>'), false);
  });

  it('keeps desired server whenever its links are valid', () => {
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server3', { server1: true, server2: true, server3: true }),
      'server3'
    );
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server2', { server1: true, server2: true, server3: false }),
      'server2'
    );
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server1', { server1: true, server2: true, server3: true }),
      'server1'
    );
  });

  it('auto-selects an available server ONLY when desired server link is missing or corrupt', () => {
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server3', { server1: true, server2: true, server3: false }),
      'server1'
    );
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server1', { server1: false, server2: true, server3: true }),
      'server2'
    );
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server2', { server1: false, server2: false, server3: true }),
      'server3'
    );
    assert.equal(
      resolveServerWhenMissingOrCorrupt('server3', { server1: false, server2: false, server3: false }),
      'server3'
    );
  });

  it('filters out corrupt quality links and checks multi-audio videoSources cleanly', () => {
    const cleaned = extractValidQualityLinksMap({
      '1080p': 'corrupt',
      '720p': 'https://byseraguci.com/d/abc123',
      '480p': 'http://',
    });
    assert.deepEqual(cleaned, { '720p': 'https://byseraguci.com/d/abc123' });

    assert.equal(hasAnyValidLinkInSources({ Hindi: { '1080p': 'null' } }), false);
    assert.equal(hasAnyValidLinkInSources({ Hindi: { '720p': 'https://voe.sx/e/abc' } }), true);
  });
});

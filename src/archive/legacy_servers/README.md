# MaxPlay Archived Server Systems: Server 2 & Server 3

This directory contains the complete, battle-tested source code and extraction pipelines for:
- **Server 2 (Streamtape)**: Direct MP4 token extraction, tokenized CDN playback, mirror resolvers (`streamta.pe`, `strtape.tech`, `strcloud.link`), and Range-request concurrency management.
- **Server 3 (Byse / SprintCDN / Filemoon)**: Cryptographic Proof-of-Work (PoW) MurmurHash-like solver, multi-quality master playlist parsing, SprintCDN edge routing, and empty audio track sanitization.

---

## Why Were They Disabled?
As per user directive on 2026-11-20:
- MaxPlay transitioned to a **unified single-provider architecture** powered exclusively by **Server 1 (VOE.sx)** for both streaming and downloads.
- Server 1 provides instant playback, zero ISP-level DNS blocking, reliable multi-language audio streams, and maximum throughput.
- Server 2 and Server 3 codes are preserved here in full so they can be re-integrated at any time if additional redundancy is required.

---

## Archived Files
1. `streamtape_extractor_archive.ts`: Client-side & server-side Streamtape extraction algorithms.
2. `byse_filemoon_extractor_archive.ts`: Byse / Filemoon PoW algorithms, SprintCDN resolvers.
3. `StreamtapeExtractor_backup.kt`: Kotlin native implementation for Android.
4. `BysePoWExtractor_backup.kt`: Kotlin native Byse PoW implementation for Android.

# Stadion van de week

The Android app bundles the first approved De Kuip feature. The independent archive reads `editorial-media/stadium/current.json`; a failed request retains the last valid snapshot. The existing match lifecycle has priority over the stadium card. The permanent archive is available from **Meer → Stadion van de week** and the homepage.

## Publication contract

`registry.json` pins 18 Eredivisie and 20 KKD clubs to primary 2026/27 competition sources, checked on 1 November 2026. Jong AZ is corrected against its actual official fixture venue (AFAS Trainingscomplex), rather than the league profile's generic AFAS Stadion label. Venue IDs identify physical grounds; sponsor renaming must preserve IDs. Add future international and unusual grounds using priorities 2 and 3, after the Dutch queue. Recheck competition membership at each season boundary. No assumption of permanent membership.

The workflow runs Monday 07:00 and 08:00 UTC and checks `Europe/Amsterdam` local time before advancement. The first valid run after 09:00 advances at most once that Monday. GitHub scheduled jobs can be delayed; exact second delivery is not guaranteed. News mirror refreshes run six times daily. Concurrency and the contents API SHA prevent lost updates.

A candidate belongs in `candidates/<venueId>.json` and must meet the same schema as `articles/de-kuip.json`. It needs original 800–1200-word prose, at least five sourced facts, six sections, primary-source links, an approved matching photograph with the exact catalogue provenance, and an approval covering the current text and metadata. `seal()` computes hashes; it does not perform fact-checking or confer editorial approval. Never set approval automatically because a hash matches. Every source is requested again before publication; non-200, timeout, rejected candidate, missing rights or missing facts retain the previous portrait. Published portraits remain in the same atomic archive snapshot, with no duplicate venue IDs.

## Current operational limitation

Only De Kuip is fully researched and approved. The next queued venue is the Johan Cruijff ArenA. Its long feature and checked fact packet are not yet prepared. The scheduler therefore keeps De Kuip visible rather than fabricating an article. This implementation automates validation, scheduling, publication, archive and app synchronization, A bounded research/writing service is also included: `stadium-research.js` fetches only preconfigured primary domains, extracts exact source receipts, writes an original draft and performs a separate factual/originality model review. Unsupported claims, excessive source dependence, missing photos, unavailable credentials or fewer than six usable sources retain the previous feature. All 38 clubs have primary-domain research roots; the first target is the ArenA. Availability of six substantive primary pages and a matching approved photograph remains a publication gate. A generated, independently checked portrait is cached on the media branch until its Monday slot. The application never invents content to fill gaps. Model-assisted source checking remains fallible and is not a guarantee of historical correctness.

## Costs

No new image generation, YouTube API or paid sports data. A successful autonomous portrait uses up to three bounded Groq GPT-OSS-120B calls; only attempted for the next due weekly candidate. Bundled CC photography is reused with attribution. The publisher uses ordinary GitHub Actions minutes and GitHub storage/bandwidth. Existing backend and GitHub plan charges depend on the account and are not inspected by this workflow. No additional fixed monthly service is provisioned. At the Groq rates checked 1 November 2026 ($0.15/M input, $0.60/M output), a conservative 70k input + 27k output token budget is about $0.027 per attempted portrait; an occasional extra attempt can increase this. Currency conversion and account-specific billing are not verified.

## Checks

`node --test test/stadium-editorial.test.js`

`node scripts/browser/phase33.cjs`

`javac -d /tmp/deadline-test android-ui/java/DeadlineHttp.java scripts/DeadlineHttpTest.java && java -cp /tmp/deadline-test DeadlineHttpTest`

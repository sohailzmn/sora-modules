# Shirox Unified German Sources

Single Shirox module combining AniWorld German dub and SerienStream German dub. Bundles both first-party source scripts in isolated JS scopes and uses the native Shirox `fetchv2`/`networkFetch` bridges. No external service required.

Manifest: `https://raw.githubusercontent.com/sohailzmn/sora-modules/main/UnifiedGerman_v1.json`

Features: search both catalogues, route episode lookups back to originating catalogue, collect multiple verified hoster streams per episode (bounded), deduplicate stream URLs, keep a working catalogue if the other search fails. **Does not circumvent website verification.**

Tested with synthetic contract inputs in JS. Live stream availability, iOS playback and Cloudflare variability require device tests. The combined source is not an installation of upstream AniBridge; it implements the unified source goal locally to avoid a public proxy or cloud fees.

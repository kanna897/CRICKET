# KNOWN LIMITATIONS (v1.0.0)

While the CRICKPULSE Enterprise platform is 100% compliant with the v1.0 BRD, the following limitations should be acknowledged before launching a large-scale tournament:

## 1. Supabase Free Tier Constraints
If deploying to the free tier of Supabase, be aware of the following infrastructure limits:
- **Database Pausing:** The database will automatically pause after 7 days of zero activity. An admin must login to the Supabase dashboard to unpause it.
- **Connection Pooling:** The free tier restricts concurrent database connections. For massive concurrent public traffic (e.g., thousands of fans watching a live score), Supabase Realtime concurrent connection limits may be breached.
- **Storage Limits:** There is a strict 1GB storage limit. If thousands of Player Photos and High-Res Logos are uploaded, you may hit this ceiling. 
*Recommendation: Upgrade to the Supabase Pro plan for production tournaments.*

## 2. Match Summary JPG Generation (Safari Browser)
The Automatic Match Summary Poster heavily relies on the HTML-to-Image Canvas API. 
- **iOS/Safari:** Apple's strict Canvas Taint and CORS policies may occasionally block the rendering of remote Supabase images (e.g., Player of the Match photo) inside the generated JPG. 
*Workaround: Admins should generate and download the posters using Google Chrome or Microsoft Edge.*

## 3. Offline Synchronization Limits
The Offline Scoring Engine relies on the browser's `IndexedDB`.
- **Incognito/Private Mode:** If the umpire is scoring in Private Browsing Mode, IndexedDB may be highly restricted or entirely volatile (cleared immediately upon close). 
- **Storage Limits:** Mobile browsers aggressively clear cache when device storage is full.
*Recommendation: Always advise umpires to use a standard (non-private) Chrome/Safari tab, and ensure the device has at least 1GB of free storage.*

## 4. Multi-Language Translations
The `next-intl` scaffolding is fully in place, but the current `ta.json` and `si.json` dictionaries only contain top-level navigation terms. Complete dictionary mapping of every individual scoring term (e.g., "Leg Byes", "Wicket Keeper") requires manual translation review by a native speaker.

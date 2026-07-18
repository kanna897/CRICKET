# CRICKPULSE v1.0.0 – Official Release Notes 🏏

**Release Date:** July 18, 2026

We are thrilled to announce the official v1.0.0 production launch of **CRICKPULSE**, the most advanced Enterprise Cricket Tournament Management Platform ever built for web.

Designed for speed, reliability, and enterprise scale, CRICKPULSE completely eliminates the need for physical scorebooks and fragmented spreadsheets. Everything from automatic League Fixture generation to complex Net Run Rate (NRR) calculations is handled instantly, natively, and securely.

## What's Included in v1.0?

### 🚀 Digital Scorebook Engine
- **Ball-by-Ball Live Scoring:** Track Runs, Extras (Wides, No-Balls, Leg-Byes, Byes), and Wickets seamlessly.
- **Smart Strike Rotation:** Automatic striker rotation calculation for odd runs (1s, 3s) and Over completion.
- **Infinite Undo Stack:** Made a mistake? Hit undo and precisely roll back the match state without corrupting the database.

### 🛡️ Enterprise Security & Data Integrity
- **Soft Deletes:** Deleting a tournament or team no longer destroys your historical data. We've introduced a robust "Soft Delete" engine that hides data from the UI while preserving the historical integrity of player stats.
- **Audit Logs:** Major administrative actions are logged silently in the background, ensuring total accountability for tournament owners.

### 📊 Automated Statistics & Reporting
- **Instant Points Tables:** The moment a match ends, Points, NRR, and Standings are mathematically recalculated on the server.
- **Excel Exports:** Instantly dump your entire tournament roster to a cleanly formatted `.xlsx` file.
- **Printable Team Sheets:** Need a physical copy for the Umpires? Hit print, and our dedicated `@media print` CSS instantly renders a high-fidelity Team Declaration Sheet.

### 🌍 Next-Gen Accessibility
- **Multi-Language Support:** We now offer native `next-intl` localization for English, Tamil, and Sinhala.
- **Offline Reliability:** Network drop at the cricket ground? No problem. The scoring engine automatically caches to your browser's IndexedDB and syncs the moment your cellular connection returns.
- **Beautiful Dark Mode:** Switch between Light and Dark themes seamlessly to reduce glare when scoring day or night matches.

## Getting Started
Admins can simply deploy the provided Next.js codebase to Vercel, run the two Supabase SQL migrations, and begin registering players immediately!

*Thank you for choosing CRICKPULSE.*

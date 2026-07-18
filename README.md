# CRICKPULSE – Enterprise Cricket Tournament Management Platform

CRICKPULSE is a modern, fast, mobile-friendly web application that enables cricket tournament organizers to manage tournaments, teams, players, fixtures, digital scoring, statistics, and live score broadcasting in real-time.

## Features

- **Admin Dashboard**: Comprehensive overview of the tournament ecosystem.
- **Tournament & Team Management**: Full CRUD operations with Supabase Storage integration for logos.
- **Player Management**: Features bulk Excel/CSV import for rapid team building and automatic duplicate prevention based on phone numbers.
- **Digital Scoring Engine**: Live ball-by-ball scoring system with undo/edit support, extras calculation, and automatic strike rotation.
- **Live Public Score**: Real-time broadcast to the public website via Supabase Realtime without page refreshes.
- **Dynamic Poster Generator**: Automatically generates professional 1080x1080 Match Summary JPG posters for social media.
- **Calculation Engine**: Automatic handling of NRR, Points Table, Strike Rates, and Averages.
- **Progressive Web App (PWA)**: Installable on mobile devices with offline capabilities (configured for production).

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4 + classnames/tailwind-merge
- **UI Components**: Lucide React Icons
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Forms & Validation**: React Hook Form + Zod
- **Data Parsing**: SheetJS (XLSX) + PapaParse (CSV)
- **Image Generation**: html-to-image
- **Charts**: Recharts

## Installation Guide

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Supabase Project

### 1. Clone & Install
```bash
git clone <repository-url>
cd crickpulse
npm install
```

### 2. Environment Setup
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialization
Run the SQL script located in `supabase/migrations/00000000000000_initial_schema.sql` within your Supabase SQL Editor. This will:
- Create all necessary tables (`tournaments`, `teams`, `players`, `matches`, `innings`, `ball_by_ball`, `awards`)
- Configure Foreign Keys and Cascade Deletes
- Create Storage Buckets (`logos`, `player_photos`, `posters`)
- Setup Row Level Security (RLS) policies
- Enable Realtime subscriptions for matches and scoring tables.

### 4. Run Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000` for the public site, and `http://localhost:3000/admin` for the admin portal.

## Deployment Guide (Vercel)

CRICKPULSE is optimized for Vercel deployment.

1. Push your code to a GitHub/GitLab repository.
2. Go to [Vercel](https://vercel.com/) and create a New Project.
3. Import your repository.
4. Add the Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. Vercel will automatically detect the Next.js framework, compile the PWA, and deploy the application globally.

## Database Schema Documentation

- **tournaments**: Core entity. Tracks venue, dates, ball type, and overs.
- **teams**: Belongs to a tournament. Has an owner, captain, and logo.
- **players**: Global directory. Uniquely identified by `phone_number`. Links to `teams`.
- **matches**: Belongs to a tournament and references two teams. Tracks the toss, winner, and Player of the Match.
- **innings**: Tracks the high-level score (runs, wickets, overs, extras) per team per match.
- **ball_by_ball**: The granular scoring ledger. Tracks bowler, batsman, runs, extras, and dismissals per ball.

## Admin Manual

1. **Creating a Tournament**: Navigate to `Admin -> Tournaments -> New`. Set the base rules (Overs, Ball Type).
2. **Adding Teams**: Navigate to `Admin -> Teams -> Add`. Assign them to a tournament.
3. **Importing Players**: Navigate to `Admin -> Players`. Use the "Download Template" button to get the Excel format. Upload the filled Excel file to bulk-create players instantly.
4. **Scoring a Match**: Navigate to `Admin -> Matches`. Launch the scoring engine. Use the intuitive keypad to record runs, extras, and wickets. The engine auto-syncs to Supabase.
5. **Post-Match**: Generate the Match Summary Poster by clicking the download icon on the completed match view.

---
*Built for scale, speed, and real-time engagement.*

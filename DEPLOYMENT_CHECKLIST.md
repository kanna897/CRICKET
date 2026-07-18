# DEPLOYMENT CHECKLIST

Follow this sequential checklist to securely deploy the CRICKPULSE application to a production Vercel environment.

## Phase 1: Database Initialization (Supabase)
- [ ] Log in to your Supabase Dashboard.
- [ ] Create a new Project (or select your existing one).
- [ ] Navigate to the **SQL Editor**.
- [ ] Execute `01_initial_schema.sql`.
- [ ] Execute `02_sprint6_audit_logs.sql` (This applies the Soft Delete views and Audit Tracking).
- [ ] Verify that all required Storage Buckets (`tournament-logos`, `team-logos`, `player-photos`) exist and have public access enabled.

## Phase 2: Repository Preparation
- [ ] Ensure all local changes are committed to your Git repository (e.g., GitHub, GitLab).
- [ ] Verify that `package.json` contains the standard `build` script: `"build": "next build"`.
- [ ] Verify that `next.config.ts` has no lingering local development constraints.

## Phase 3: Vercel Deployment
- [ ] Log in to [Vercel](https://vercel.com).
- [ ] Click **Add New Project** and import your CRICKPULSE Git repository.
- [ ] Framework Preset should auto-detect as **Next.js**.
- [ ] Under **Environment Variables**, you MUST add the following EXACT keys:
  - `NEXT_PUBLIC_SUPABASE_URL` (Find this in Supabase -> Settings -> API -> Project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Find this in Supabase -> Settings -> API -> Project API Keys -> anon / public)
  - *(No other environment variables are required for the base application to function).*
- [ ] Click **Deploy**.

## Phase 4: Post-Deployment Verification
- [ ] Once the Vercel build succeeds, click the production URL.
- [ ] Attempt to Register the very first Admin account. *(Note: The first registered account is often handled as Super Admin depending on your RLS logic).*
- [ ] Create a dummy Tournament to verify Database Writes.
- [ ] Upload a dummy Logo to verify Storage Writes.

**Congratulations! Your CRICKPULSE Enterprise Platform is live!**

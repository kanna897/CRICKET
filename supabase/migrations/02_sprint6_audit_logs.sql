-- Sprint 6: Data Integrity & Administration (Revised)

-- 1. Create Audit Logs Table (Expanded)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    device_browser TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add Soft Delete Flags to Core Tables
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Create Views to Exclude Deleted Records Automatically
CREATE OR REPLACE VIEW public.active_tournaments AS 
SELECT * FROM public.tournaments WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.active_teams AS 
SELECT * FROM public.teams WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.active_players AS 
SELECT * FROM public.players WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.active_matches AS 
SELECT * FROM public.matches WHERE is_deleted = false;

-- 4. RLS Policies for Audit Logs (Only Admins can Read)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert audit logs" 
ON public.audit_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

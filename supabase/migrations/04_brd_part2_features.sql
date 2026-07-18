-- Migration: 04_brd_part2_features.sql
-- Description: Adds schema modifications required for BRD Part 2 Scope (v1.0.0)
-- Features: Match Lock System, Toss Management, Commentary Engine, Soft Delete.

-- 1. Soft Delete Fields
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Match Lock System & Toss Management
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS toss_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS toss_notes TEXT;

-- 3. Ball-by-Ball Commentary
ALTER TABLE public.ball_by_ball 
ADD COLUMN IF NOT EXISTS commentary TEXT;

-- ============================================================================
-- Overtime & TOIL Payout Schema Migration
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/sql/new
-- ============================================================================

-- Step 1: Add pay rates to staff_profiles if they do not exist
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10, 2) DEFAULT 0.00;

-- Step 2: Create staff_ot_claims table to store overtime and TOIL payout requests
CREATE TABLE IF NOT EXISTS staff_ot_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '17:00:00',
  end_time TIME,
  ot_hours NUMERIC(5, 2) DEFAULT 0.00,
  toil_payout BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_profile_date_claim UNIQUE (profile_id, date)
);

-- Step 3: Enable Row Level Security (RLS) on staff_ot_claims
ALTER TABLE staff_ot_claims ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own claims" ON staff_ot_claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON staff_ot_claims;
DROP POLICY IF EXISTS "Users/Admins can update claims" ON staff_ot_claims;
DROP POLICY IF EXISTS "Users/Admins can delete claims" ON staff_ot_claims;

-- Step 5: Create RLS Policies
-- Select policy: users can view their own claims, admins can view all
CREATE POLICY "Users can view own claims" ON staff_ot_claims FOR SELECT
USING (
  profile_id IN (SELECT id FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role IN ('super_admin', 'roster_manager'))
);

-- Insert policy: users can insert their own claims
CREATE POLICY "Users can insert own claims" ON staff_ot_claims FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())
);

-- Update policy: users can update their own pending claims, admins can update any claim (for approval/rejection)
CREATE POLICY "Users/Admins can update claims" ON staff_ot_claims FOR UPDATE
USING (
  (profile_id IN (SELECT id FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()) AND status = 'pending')
  OR EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role IN ('super_admin', 'roster_manager'))
);

-- Delete policy: users can delete their own pending claims, admins can delete any
CREATE POLICY "Users/Admins can delete claims" ON staff_ot_claims FOR DELETE
USING (
  (profile_id IN (SELECT id FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()) AND status = 'pending')
  OR EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role IN ('super_admin', 'roster_manager'))
);

-- Step 6: Verify migration
DO $$
BEGIN
  RAISE NOTICE 'OT & TOIL Claims migration schema applied successfully!';
END $$;

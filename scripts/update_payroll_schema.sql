-- ============================================================================
-- Overtime & TOIL Payroll Extension Schema Migration
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/sql/new
-- ============================================================================

-- Step 1: Add monthly_salary column to staff_profiles if it doesn't exist
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10, 2) DEFAULT 0.00;

-- Step 2: Add toil_dates column to staff_ot_claims if it doesn't exist
ALTER TABLE staff_ot_claims ADD COLUMN IF NOT EXISTS toil_dates JSONB DEFAULT '[]'::jsonb;

-- Step 3: Create staff_monthly_payroll table to persist monthly overrides/adjustments
CREATE TABLE IF NOT EXISTS staff_monthly_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  monthly_salary NUMERIC(10, 2) DEFAULT 0.00,
  manual_addition NUMERIC(10, 2) DEFAULT 0.00,
  manual_deduction NUMERIC(10, 2) DEFAULT 0.00,
  adjustment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_profile_month_payroll UNIQUE (profile_id, month)
);

-- Step 4: Enable Row Level Security (RLS) on staff_monthly_payroll
ALTER TABLE staff_monthly_payroll ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Admins can manage monthly payroll" ON staff_monthly_payroll;

-- Step 6: Create Admin management policy
CREATE POLICY "Admins can manage monthly payroll" ON staff_monthly_payroll FOR ALL
USING (
  EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role IN ('super_admin', 'roster_manager'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role IN ('super_admin', 'roster_manager'))
);

-- Step 7: Verify migration
DO $$
BEGIN
  RAISE NOTICE 'OT & TOIL Payroll Extensions schema applied successfully!';
END $$;

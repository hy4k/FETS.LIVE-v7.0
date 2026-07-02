-- Migration: Create Shift Handover and Checklist Questions tables
-- Target: public.handover_questions and public.shift_handovers

-- 1. Create handover_questions table
CREATE TABLE IF NOT EXISTS public.handover_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.handover_questions ENABLE ROW LEVEL SECURITY;

-- 2. Create shift_handovers table
CREATE TABLE IF NOT EXISTS public.shift_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  date DATE NOT NULL,
  handover_time TEXT NOT NULL,
  outgoing_staff TEXT[] NOT NULL,
  incoming_staff TEXT[] NOT NULL,
  currently_testing INTEGER,
  no_shows INTEGER,
  candidate_notes TEXT,
  checklist JSONB NOT NULL,
  pending_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  sig_out JSONB,
  sig_in JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Handover Questions Policies
DROP POLICY IF EXISTS "Allow read access for authenticated users on handover_questions" ON public.handover_questions;
CREATE POLICY "Allow read access for authenticated users on handover_questions"
  ON public.handover_questions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on handover_questions" ON public.handover_questions;
CREATE POLICY "Allow full access for authenticated users on handover_questions"
  ON public.handover_questions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Shift Handovers Policies
DROP POLICY IF EXISTS "Allow read access for authenticated users on shift_handovers" ON public.shift_handovers;
CREATE POLICY "Allow read access for authenticated users on shift_handovers"
  ON public.shift_handovers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert access for authenticated users on shift_handovers" ON public.shift_handovers;
CREATE POLICY "Allow insert access for authenticated users on shift_handovers"
  ON public.shift_handovers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access for authenticated users on shift_handovers" ON public.shift_handovers;
CREATE POLICY "Allow update access for authenticated users on shift_handovers"
  ON public.shift_handovers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Seed default handover questions
INSERT INTO public.handover_questions (label, is_active)
VALUES
  ('Workstations & servers', true),
  ('Internet & network', true),
  ('CCTV & recording', true),
  ('Power & AC', true),
  ('All candidates exited', true),
  ('Secure materials locked', true),
  ('Dashboards logged out', true)
ON CONFLICT (label) DO NOTHING;

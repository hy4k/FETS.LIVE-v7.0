-- ============================================================
-- Mithun Workbench: persistent cloud backup for private desk data
-- Stores the executive workbook, daily notes, to-do list, and
-- accounting scratchpad in Supabase with localStorage as UI fallback.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mithun_workbench_state (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_note TEXT NOT NULL DEFAULT '',
  todos       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ledger      JSONB NOT NULL DEFAULT '[]'::jsonb,
  pages       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mithun_workbench_updated_at
  ON public.mithun_workbench_state (updated_at DESC);

ALTER TABLE public.mithun_workbench_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mithun_workbench_select" ON public.mithun_workbench_state;
CREATE POLICY "mithun_workbench_select" ON public.mithun_workbench_state
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN ('mithun@fets.in', 'mithun@fets.live')
  );

DROP POLICY IF EXISTS "mithun_workbench_insert" ON public.mithun_workbench_state;
CREATE POLICY "mithun_workbench_insert" ON public.mithun_workbench_state
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN ('mithun@fets.in', 'mithun@fets.live')
  );

DROP POLICY IF EXISTS "mithun_workbench_update" ON public.mithun_workbench_state;
CREATE POLICY "mithun_workbench_update" ON public.mithun_workbench_state
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN ('mithun@fets.in', 'mithun@fets.live')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN ('mithun@fets.in', 'mithun@fets.live')
  );

CREATE OR REPLACE FUNCTION public.set_mithun_workbench_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mithun_workbench_updated_at ON public.mithun_workbench_state;
CREATE TRIGGER mithun_workbench_updated_at
  BEFORE UPDATE ON public.mithun_workbench_state
  FOR EACH ROW EXECUTE FUNCTION public.set_mithun_workbench_updated_at();

COMMENT ON TABLE public.mithun_workbench_state IS
  'Private Supabase-backed state for the Mithun-only My Desk executive workbook.';

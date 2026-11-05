import { supabase } from '../lib/supabase';
import type { PearsonCandidateBinding, PearsonCancellation, PearsonPreview, PearsonPreviewInput, PearsonReceipt, PearsonSessionBinding } from './types';

export async function previewPearsonRoster(input: PearsonPreviewInput): Promise<PearsonPreview> {
  const { data, error } = await supabase.rpc('preview_pearson_roster', {
    p_branch: input.branch, p_from: input.from, p_through: input.through,
    p_complete: input.complete, p_source_as_of: input.source_as_of,
    p_file_hash: input.file_hash, p_filename: input.filename, p_rows: input.rows,
  });
  if (error) throw error;
  return data as PearsonPreview;
}

export async function applyPearsonRoster(previewId: string, candidateBindings: PearsonCandidateBinding[], sessionBindings: PearsonSessionBinding[]): Promise<PearsonReceipt> {
  const { data, error } = await supabase.rpc('apply_pearson_roster', {
    p_preview_id: previewId, p_candidate_bindings: candidateBindings, p_session_bindings: sessionBindings,
  });
  if (error) throw error;
  return data as PearsonReceipt;
}

export async function listPearsonCancellationReviews(branch: string): Promise<PearsonCancellation[]> {
  const { data, error } = await supabase.rpc('list_pearson_cancellation_reviews', { p_branch: branch });
  if (error) throw error;
  return (data || []) as PearsonCancellation[];
}

export async function decidePearsonCancellation(review: PearsonCancellation, decision: 'keep' | 'cancel'): Promise<void> {
  const { error } = await supabase.rpc('decide_pearson_cancellation', {
    p_review_id: review.id, p_decision: decision, p_expected_updated_at: review.updated_at,
  });
  if (error) throw error;
}

export type PearsonRow = {
  source_row: number; date: string; start_time: string; end_time: string;
  full_name: string; email: string | null; phone: string | null;
  exam_owner: string; exam_code: string; exam_title: string;
};
export type PearsonParsedFile = {
  filename: string; file_hash: string; sheet: string; rows: PearsonRow[];
  issues: { source_row: number; level: 'warning' | 'error'; message: string }[];
};
export type PearsonCandidateChoice = { id: string; full_name: string; date: string; start_time: string | null; exam_code: string | null; email: string | null };
export type PearsonPreviewRow = PearsonRow & {
  candidate_id: string | null; match_kind: 'new' | 'exact' | 'review';
  possible_candidates: PearsonCandidateChoice[]; changes: string[];
};
export type PearsonPreviewSession = {
  group_key: string; date: string; exam_owner: string; start_time: string; end_time: string;
  candidate_count: number; calendar_id: number | null; match_kind: 'new' | 'exact' | 'review';
  possible_sessions: { id: number; date?: string; exam_name: string; start_time: string; end_time: string; candidate_count: number }[];
};
export type PearsonCancellation = {
  id: string; candidate_id: string; full_name: string; date: string; start_time: string | null;
  exam_code: string | null; status: string; updated_at: string; has_progress: boolean;
};
export type PearsonPreview = {
  preview_id: string; expires_at: string; branch: string; from: string; through: string;
  rows: PearsonPreviewRow[]; sessions: PearsonPreviewSession[]; missing: PearsonCancellation[];
  warnings: string[]; counts: { incoming: number; new: number; existing: number; review: number; sessions: number; missing: number };
  existing_receipt?: PearsonReceipt | null;
};
export type PearsonCandidateBinding = { source_row: number; candidate_id: string | null };
export type PearsonSessionBinding = { group_key: string; calendar_id: number | null };
export type PearsonReceipt = {
  import_id: string; saved: number; inserted: number; updated: number; sessions: number;
  cancellation_reviews: number; already_applied: boolean; file_hash: string;
};
export type PearsonPreviewInput = {
  branch: string; from: string; through: string; complete: boolean; source_as_of: string;
  filename: string; file_hash: string; rows: PearsonRow[];
};

export const PROVIDERS = ['PROMETRIC', 'PEARSON VUE', 'CELPIP', 'PSI', 'ITTS'] as const;
export type RosterRow = {
  source_row: number; roster_number: string; full_name: string; exam_name: string;
  exam_part: string | null; exam_start_time: string | null; phone: string | null;
  place?: string | null; roster_flag?: string | null;
};
export type RosterIssue = { source_row: number; level: 'error' | 'warning'; message: string };
export type RosterPreview = {
  filename: string; sheet_used?: string | null; header_row: number;
  columns: Record<string, string | null>; rows: RosterRow[]; issues: RosterIssue[];
  counts: { valid: number; warnings: number; errors: number; no_show: number; skipped: number };
  diagnostics?: { sheets: string[]; sheet_used: string | null; rows_found: number; columns_found: number; best_row: number; matched_fields: string[]; header_cells: string[] | null; understood: Record<string,string[]> };
};
export type CandidateRosterRecord = {
  id: string; full_name: string; phone: string | null; roster_number: string | null;
  client_name: string | null; exam_name: string | null; exam_start_time: string | null;
};

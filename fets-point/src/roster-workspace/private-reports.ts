export type PrivateReport = {
  id: string;
  recipient_profile_id: string;
  recipient_user_id: string;
  recipient_name: string;
  month: string;
  branch: string;
  title: string;
  summary: string;
  manager_notes: string;
  source_evidence: string;
  source_generated: string;
  source_count: number;
  status: "draft" | "shared";
  created_at: string;
  updated_at: string;
  shared_at: string | null;
  version: number;
};
export type NewReport = Pick<
  PrivateReport,
  | "recipient_profile_id"
  | "month"
  | "branch"
  | "title"
  | "summary"
  | "manager_notes"
  | "source_evidence"
  | "source_generated"
  | "source_count"
>;
export type ReportEdits = Pick<
  PrivateReport,
  "title" | "summary" | "manager_notes"
>;

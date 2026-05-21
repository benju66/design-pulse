export interface MatrixRow {
  cost_code: string;
  description: string;
  division: string; // first 2 chars of cost_code for grouping
  opportunity_id?: string;
  has_variance_comment?: boolean;
  [versionId: string]: string | number | boolean | undefined; // dynamic version amount keys/notes
}

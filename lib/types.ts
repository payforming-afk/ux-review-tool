export const ISSUE_TYPES = [
  "layout",
  "spacing",
  "typography",
  "color",
  "missing element",
  "overlap",
  "text overflow"
] as const;

export const SEVERITY_LEVELS = ["high", "medium", "low"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];
export type ImageType = "design" | "implementation" | "diff";

export interface Task {
  task_id: number;
  task_name: string;
  version: string;
  owner: string;
  created_at: string;
}

export interface ImageRecord {
  image_id: number;
  task_id: number;
  comparison_index: number;
  type: ImageType;
  url: string;
}

export interface Issue {
  issue_id: number;
  task_id: number;
  comparison_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: IssueType;
  severity: SeverityLevel;
  description: string;
  created_at: string;
}

export interface DiffRegion {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pixel_count: number;
}

export interface ComparisonReview {
  comparison_index: number;
  label: string;
  image_width: number;
  image_height: number;
  images: ImageRecord[];
  regions: DiffRegion[];
}

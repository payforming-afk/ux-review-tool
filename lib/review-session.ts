import type { DiffRegion, Task } from "@/lib/types";

export interface ReviewSessionComparison {
  comparison_index: number;
  designImage: string;
  implementationImage: string;
  diffImageBase64: string;
  regions: DiffRegion[];
  width: number;
  height: number;
  mismatch_pixels: number;
  detected_regions: number;
}

export interface ReviewSessionPayload {
  task?: Task | null;
  comparisons?: ReviewSessionComparison[];
}

export function reviewSessionKey(taskId: number): string {
  return `ux-review-task-${taskId}`;
}

import { NextResponse } from "next/server";
import { getTaskReviewData, loadComparisonRegions } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const taskId = Number(id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "任务 ID 不合法。" }, { status: 400 });
  }

  const data = getTaskReviewData(taskId);

  if (!data) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const comparisonIndexes = Array.from(new Set(data.images.map((image) => image.comparison_index))).sort(
    (a, b) => a - b
  );

  const regionsByComparison = loadComparisonRegions(taskId, comparisonIndexes);

  const comparisons = comparisonIndexes.map((comparisonIndex) => ({
    comparison_index: comparisonIndex,
    images: data.images.filter((image) => image.comparison_index === comparisonIndex),
    regions: regionsByComparison[comparisonIndex] ?? []
  }));

  return NextResponse.json({
    task: data.task,
    images: data.images,
    issues: data.issues,
    comparisons
  });
}

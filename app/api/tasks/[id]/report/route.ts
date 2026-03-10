import { NextResponse } from "next/server";
import {
  buildCsvReport,
  buildMarkdownReport,
  getTaskReviewData,
  loadComparisonRegions
} from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const taskId = Number(id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "任务 ID 不合法。" }, { status: 400 });
  }

  const reviewData = getTaskReviewData(taskId);

  if (!reviewData) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const comparisonIndexes = Array.from(
    new Set(reviewData.images.map((image) => image.comparison_index))
  ).sort((a, b) => a - b);

  const regionsByComparison = loadComparisonRegions(taskId, comparisonIndexes);

  const comparisons = comparisonIndexes.map((comparisonIndex) => ({
    comparison_index: comparisonIndex,
    images: reviewData.images.filter((image) => image.comparison_index === comparisonIndex),
    regions: regionsByComparison[comparisonIndex] ?? []
  }));

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const exportedAt = new Date().toISOString();

  if (format === "csv") {
    const csv = buildCsvReport(
      reviewData.task,
      comparisons.map((item) => ({
        comparison_index: item.comparison_index,
        regions: item.regions
      })),
      reviewData.issues
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="task-${taskId}-review-report.csv"`
      }
    });
  }

  if (format === "md" || format === "markdown") {
    const markdown = buildMarkdownReport(reviewData.task, comparisons, reviewData.issues, exportedAt);
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="task-${taskId}-review-report.md"`
      }
    });
  }

  return NextResponse.json(
    {
      task: reviewData.task,
      comparisons: comparisons.map((item) => ({
        comparison_index: item.comparison_index,
        images: item.images,
        detected_regions: item.regions
      })),
      issues: reviewData.issues,
      exported_at: exportedAt
    },
    {
      status: 200,
      headers: {
        "content-disposition": `attachment; filename="task-${taskId}-review-report.json"`
      }
    }
  );
}

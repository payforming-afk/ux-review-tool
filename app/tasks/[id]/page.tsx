import { notFound } from "next/navigation";
import path from "node:path";
import sharp from "sharp";
import { ReviewBoard } from "@/components/review-board";
import { getTaskReviewData } from "@/lib/repository";
import { loadComparisonRegions } from "@/lib/storage";
import type { ComparisonReview, ImageRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TaskReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskReviewPage({ params }: TaskReviewPageProps) {
  const { id } = await params;
  const taskId = Number(id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    notFound();
  }

  const data = getTaskReviewData(taskId);

  if (!data) {
    notFound();
  }

  const comparisonIndexes = Array.from(new Set(data.images.map((image) => image.comparison_index))).sort(
    (a, b) => a - b
  );

  const regionsByComparison = await loadComparisonRegions(taskId, comparisonIndexes);

  const comparisons: ComparisonReview[] = await Promise.all(
    comparisonIndexes.map(async (comparisonIndex) => {
      const comparisonImages = data.images.filter(
        (image) => image.comparison_index === comparisonIndex
      );
      const dimensions = await getComparisonDimensions(comparisonImages);

      return {
        comparison_index: comparisonIndex,
        label: `对比组 ${comparisonIndex + 1}`,
        image_width: dimensions.width,
        image_height: dimensions.height,
        images: comparisonImages,
        regions: regionsByComparison[comparisonIndex] ?? []
      };
    })
  );

  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">页面 3</p>
          <h2 className="section-title">比对结果</h2>
          <p className="section-subtitle">支持多图分组切换，逐组查看差异并标记问题。</p>
        </div>
      </div>

      <ReviewBoard task={data.task} comparisons={comparisons} initialIssues={data.issues} />
    </section>
  );
}

async function getComparisonDimensions(
  images: ImageRecord[]
): Promise<{ width: number; height: number }> {
  const preferred =
    images.find((image) => image.type === "diff") ??
    images.find((image) => image.type === "design") ??
    images.find((image) => image.type === "implementation") ??
    null;

  if (!preferred) {
    return { width: 1, height: 1 };
  }

  const relative = preferred.url.startsWith("/") ? preferred.url.slice(1) : preferred.url;
  const absolutePath = path.join(process.cwd(), "public", relative);

  try {
    const metadata = await sharp(absolutePath).metadata();
    return {
      width: metadata.width ?? 1,
      height: metadata.height ?? 1
    };
  } catch {
    return { width: 1, height: 1 };
  }
}

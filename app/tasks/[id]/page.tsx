import Link from "next/link";
import { ReviewBoard } from "@/components/review-board";
import { getTaskReviewData } from "@/lib/repository";
import { loadComparisonRegions } from "@/lib/repository";
import type { ComparisonReview, ImageRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TaskReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskReviewPage({ params }: TaskReviewPageProps) {
  const { id } = await params;
  const taskId = Number(id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return (
      <UnavailableState
        title="任务编号无效"
        description="当前链接中的任务编号不合法，请返回任务列表后重新进入。"
      />
    );
  }

  const data = getTaskReviewData(taskId);

  if (!data) {
    return (
      <UnavailableState
        title="任务结果暂不可用"
        description="当前运行环境没有找到该任务数据，请返回任务列表后重试，或重新创建任务。"
      />
    );
  }

  const comparisonIndexes = Array.from(new Set(data.images.map((image) => image.comparison_index))).sort(
    (a, b) => a - b
  );

  const regionsByComparison = loadComparisonRegions(taskId, comparisonIndexes);

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
  const persisted = images.find((image) => image.width > 0 && image.height > 0) ?? null;
  return {
    width: persisted?.width ?? 1,
    height: persisted?.height ?? 1
  };
}

function UnavailableState({ title, description }: { title: string; description: string }) {
  return (
    <section className="stack-lg">
      <article className="form-card stack-md">
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle">{description}</p>
        <div className="actions">
          <Link href="/tasks" className="button-link">
            返回任务列表
          </Link>
          <Link href="/create" className="button-link button-link-primary">
            新建任务
          </Link>
        </div>
      </article>
    </section>
  );
}

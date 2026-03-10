"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReviewBoard } from "@/components/review-board";
import { reviewSessionKey, type ReviewSessionPayload } from "@/lib/review-session";
import type { ComparisonReview, ImageRecord, Task } from "@/lib/types";

interface TaskReviewSessionFallbackProps {
  taskId: number;
}

type LoadState = "loading" | "ready" | "empty";

export function TaskReviewSessionFallback({ taskId }: TaskReviewSessionFallbackProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [task, setTask] = useState<Task | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonReview[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(reviewSessionKey(taskId));

    if (!raw) {
      setLoadState("empty");
      return;
    }

    try {
      const payload = JSON.parse(raw) as ReviewSessionPayload;
      const recoveredTask = payload.task ?? null;
      const recoveredComparisons = payload.comparisons ?? [];

      if (!recoveredTask || recoveredTask.task_id !== taskId) {
        setLoadState("empty");
        return;
      }

      const normalizedComparisons = recoveredComparisons.map((item) => {
        const width = item.width > 0 ? item.width : 1;
        const height = item.height > 0 ? item.height : 1;

        return {
          comparison_index: item.comparison_index,
          label: `对比组 ${item.comparison_index + 1}`,
          image_width: width,
          image_height: height,
          images: buildImageRecords(taskId, item),
          regions: item.regions ?? []
        } satisfies ComparisonReview;
      });

      setTask(recoveredTask);
      setComparisons(normalizedComparisons);
      setLoadState("ready");
    } catch {
      setLoadState("empty");
    }
  }, [taskId]);

  const hasComparisons = useMemo(() => comparisons.length > 0, [comparisons]);

  if (loadState === "loading") {
    return (
      <section className="stack-lg">
        <article className="form-card">
          <p className="empty-note">正在恢复任务结果，请稍候...</p>
        </article>
      </section>
    );
  }

  if (loadState !== "ready" || !task) {
    return (
      <section className="stack-lg">
        <article className="form-card stack-md">
          <h2 className="section-title">任务结果暂不可用</h2>
          <p className="section-subtitle">
            当前环境未找到该任务数据，且浏览器中也没有可恢复的创建结果，请重新创建任务。
          </p>
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

  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">页面 3</p>
          <h2 className="section-title">比对结果</h2>
          <p className="section-subtitle">
            {hasComparisons
              ? "已从创建结果恢复当前任务，支持继续标注问题与导出报告。"
              : "任务已创建，但当前没有可展示的 comparison 数据。"}
          </p>
        </div>
      </div>

      <ReviewBoard task={task} comparisons={comparisons} initialIssues={[]} />
    </section>
  );
}

function buildImageRecords(
  taskId: number,
  item: NonNullable<ReviewSessionPayload["comparisons"]>[number]
): ImageRecord[] {
  const width = item.width > 0 ? item.width : 1;
  const height = item.height > 0 ? item.height : 1;

  return [
    {
      image_id: item.comparison_index * 3 + 1,
      task_id: taskId,
      comparison_index: item.comparison_index,
      type: "design",
      width,
      height,
      url: item.designImage
    },
    {
      image_id: item.comparison_index * 3 + 2,
      task_id: taskId,
      comparison_index: item.comparison_index,
      type: "implementation",
      width,
      height,
      url: item.implementationImage
    },
    {
      image_id: item.comparison_index * 3 + 3,
      task_id: taskId,
      comparison_index: item.comparison_index,
      type: "diff",
      width,
      height,
      url: normalizeDiffUrl(item.diffImageBase64)
    }
  ];
}

function normalizeDiffUrl(value: string): string {
  if (value.startsWith("data:")) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

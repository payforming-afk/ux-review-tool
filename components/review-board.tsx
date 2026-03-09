"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ISSUE_TYPES,
  SEVERITY_LEVELS,
  type ComparisonReview,
  type ImageRecord,
  type Issue,
  type IssueType,
  type SeverityLevel,
  type Task
} from "@/lib/types";

interface ReviewBoardProps {
  task: Task;
  comparisons: ComparisonReview[];
  initialIssues: Issue[];
}

interface IssuePayload {
  issue: Issue;
}

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  layout: "布局",
  spacing: "间距",
  typography: "字体",
  color: "颜色",
  "missing element": "元素缺失",
  overlap: "重叠",
  "text overflow": "文本溢出"
};

const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  high: "高",
  medium: "中",
  low: "低"
};

export function ReviewBoard({ task, comparisons, initialIssues }: ReviewBoardProps) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [selectedComparisonIndex, setSelectedComparisonIndex] = useState<number>(
    comparisons[0]?.comparison_index ?? 0
  );
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("layout");
  const [severity, setSeverity] = useState<SeverityLevel>("medium");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentComparison = useMemo(
    () =>
      comparisons.find((comparison) => comparison.comparison_index === selectedComparisonIndex) ??
      comparisons[0] ??
      null,
    [comparisons, selectedComparisonIndex]
  );

  const imageByType = useMemo(() => {
    const comparisonImages = currentComparison?.images ?? [];
    return comparisonImages.reduce<Partial<Record<ImageRecord["type"], ImageRecord>>>((acc, image) => {
      acc[image.type] = image;
      return acc;
    }, {});
  }, [currentComparison]);

  const regions = currentComparison?.regions ?? [];
  const imageWidth = currentComparison?.image_width ?? 1;
  const imageHeight = currentComparison?.image_height ?? 1;
  const fittedStageWidth = buildFittedStageWidth(imageWidth, imageHeight);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId]
  );

  const currentIssues = useMemo(
    () => issues.filter((issue) => issue.comparison_index === selectedComparisonIndex),
    [issues, selectedComparisonIndex]
  );

  useEffect(() => {
    setSelectedRegionId(regions[0]?.id ?? null);
  }, [selectedComparisonIndex, regions]);

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedRegion) {
      setError("请先在差异图中选择一个区域。");
      return;
    }

    if (!description.trim()) {
      setError("请填写问题描述。");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/tasks/${task.task_id}/issues`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          comparison_index: selectedComparisonIndex,
          x: selectedRegion.x,
          y: selectedRegion.y,
          width: selectedRegion.width,
          height: selectedRegion.height,
          type: issueType,
          severity,
          description: description.trim()
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建问题失败。");
      }

      const payload = (await response.json()) as IssuePayload;
      setIssues((previous) => [payload.issue, ...previous]);
      setDescription("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建问题失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="task-meta">
        <div>
          <h3>{task.task_name}</h3>
          <p>
            <strong>版本：</strong>
            {task.version} | <strong>负责人：</strong>
            {task.owner}
          </p>
        </div>

        <div className="actions">
          <Link href="/tasks" className="button-link">
            返回任务列表
          </Link>
          <a href={`/api/tasks/${task.task_id}/report?format=md`} className="button-link" download>
            导出 Markdown
          </a>
          <a href={`/api/tasks/${task.task_id}/report?format=json`} className="button-link" download>
            导出 JSON
          </a>
          <a href={`/api/tasks/${task.task_id}/report?format=csv`} className="button-link" download>
            导出 CSV
          </a>
        </div>
      </div>

      {comparisons.length > 1 ? (
        <div className="comparison-tabs" role="tablist" aria-label="对比组切换">
          {comparisons.map((comparison) => (
            <button
              key={comparison.comparison_index}
              type="button"
              role="tab"
              className={`comparison-tab ${
                comparison.comparison_index === selectedComparisonIndex ? "active" : ""
              }`}
              onClick={() => setSelectedComparisonIndex(comparison.comparison_index)}
              aria-selected={comparison.comparison_index === selectedComparisonIndex}
            >
              {comparison.label}
            </button>
          ))}
        </div>
      ) : null}

      {!currentComparison ? (
        <article className="form-card">
          <p className="empty-note">当前任务下暂无可展示的比对图片。</p>
        </article>
      ) : (
        <>
          <div className="image-grid">
            <ImageCard title="设计稿" image={imageByType.design} width={imageWidth} height={imageHeight} />
            <ImageCard
              title="实现截图"
              image={imageByType.implementation}
              width={imageWidth}
              height={imageHeight}
            />

            <article className="image-card">
              <header>
                <h4>差异图</h4>
                <p>检测到 {regions.length} 个区域</p>
              </header>

              {!imageByType.diff ? (
                <p className="empty-note">暂无差异图。</p>
              ) : (
                <div className="image-frame image-frame-fit" role="img" aria-label="差异图与高亮区域">
                  <div
                    className="diff-stage"
                    style={{
                      width: fittedStageWidth,
                      aspectRatio: `${imageWidth} / ${imageHeight}`
                    }}
                  >
                    <img src={imageByType.diff.url} alt="差异图" className="image-stage-media" />

                    {regions.map((region) => (
                      <button
                        key={region.id}
                        type="button"
                        className={`diff-region ${region.id === selectedRegionId ? "active" : ""}`}
                        style={{
                          left: `${(region.x / imageWidth) * 100}%`,
                          top: `${(region.y / imageHeight) * 100}%`,
                          width: `${(region.width / imageWidth) * 100}%`,
                          height: `${(region.height / imageHeight) * 100}%`
                        }}
                        onClick={() => setSelectedRegionId(region.id)}
                        title={`区域 ${region.id}: ${region.width}x${region.height}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </article>
          </div>

          <div className="review-grid">
            <article className="form-card stack-md">
              <header>
                <h4>新建问题</h4>
                <p>点击差异图高亮区域后，填写问题信息并提交。</p>
              </header>

              <p className="region-preview">
                {selectedRegion
                  ? `已选区域 #${selectedRegion.id} (${selectedRegion.x}, ${selectedRegion.y}, ${selectedRegion.width}, ${selectedRegion.height})`
                  : "尚未选择区域"}
              </p>

              <form onSubmit={handleCreateIssue} className="stack-sm">
                <label className="field">
                  <span>问题类型</span>
                  <select value={issueType} onChange={(event) => setIssueType(event.target.value as IssueType)}>
                    {ISSUE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ISSUE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>严重级别</span>
                  <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value as SeverityLevel)}
                  >
                    {SEVERITY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {SEVERITY_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>问题描述</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="请描述视觉偏差和期望效果..."
                    rows={4}
                    required
                  />
                </label>

                {error ? <p className="form-error">{error}</p> : null}

                <button type="submit" className="button-link button-link-primary" disabled={isSubmitting}>
                  {isSubmitting ? "提交中..." : "保存问题"}
                </button>
              </form>
            </article>

            <article className="form-card stack-md">
              <header>
                <h4>问题列表（当前组 {currentIssues.length} 条）</h4>
                <p>仅展示当前对比组已记录的问题。</p>
              </header>

              {currentIssues.length === 0 ? (
                <p className="empty-note">当前对比组暂无问题。</p>
              ) : (
                <ul className="issue-list">
                  {currentIssues.map((issue) => (
                    <li key={issue.issue_id}>
                      <div className="issue-topline">
                        <span className="badge">#{issue.issue_id}</span>
                        <span className="badge badge-type">{ISSUE_TYPE_LABELS[issue.type]}</span>
                        <span className={`badge badge-severity badge-${issue.severity}`}>
                          {SEVERITY_LABELS[issue.severity]}
                        </span>
                      </div>
                      <p className="issue-desc">{issue.description}</p>
                      <p className="issue-meta">
                        ({issue.x}, {issue.y}, {issue.width}, {issue.height})
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </>
      )}
    </div>
  );
}

function ImageCard({
  title,
  image,
  width,
  height
}: {
  title: string;
  image?: ImageRecord;
  width: number;
  height: number;
}) {
  const fittedStageWidth = buildFittedStageWidth(width, height);

  return (
    <article className="image-card">
      <header>
        <h4>{title}</h4>
      </header>

      {!image ? (
        <p className="empty-note">暂无图片。</p>
      ) : (
        <div className="image-frame image-frame-fit">
          <div
            className="image-stage"
            style={{
              width: fittedStageWidth,
              aspectRatio: `${width} / ${height}`
            }}
          >
            <img src={image.url} alt={title} className="image-stage-media" />
          </div>
        </div>
      )}
    </article>
  );
}

function buildFittedStageWidth(width: number, height: number): string {
  const safeWidth = width > 0 ? width : 1;
  const safeHeight = height > 0 ? height : 1;
  return `min(100%, calc(70vh * ${safeWidth} / ${safeHeight}))`;
}

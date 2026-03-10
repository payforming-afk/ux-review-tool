import "server-only";

import db from "@/lib/db";
import type {
  DiffRegion,
  ImageRecord,
  ImageType,
  Issue,
  IssueType,
  SeverityLevel,
  Task
} from "@/lib/types";

interface TaskWithStats extends Task {
  issue_count: number;
  comparison_count: number;
}

interface ComparisonRegions {
  comparison_index: number;
  regions: DiffRegion[];
}

interface ComparisonMarkdownData {
  comparison_index: number;
  images: ImageRecord[];
  regions: DiffRegion[];
}

const listTasksStmt = db.prepare(`
  SELECT
    t.task_id,
    t.task_name,
    t.version,
    t.owner,
    t.created_at,
    COUNT(DISTINCT i.issue_id) AS issue_count,
    COUNT(DISTINCT m.comparison_index) AS comparison_count
  FROM tasks t
  LEFT JOIN issues i ON i.task_id = t.task_id
  LEFT JOIN images m ON m.task_id = t.task_id AND m.type = 'diff'
  GROUP BY t.task_id
  ORDER BY t.created_at DESC
`);

const getTaskStmt = db.prepare(
  `SELECT task_id, task_name, version, owner, created_at FROM tasks WHERE task_id = ?`
);

const insertTaskStmt = db.prepare(
  `INSERT INTO tasks (task_name, version, owner) VALUES (?, ?, ?)`
);

const insertImageStmt = db.prepare(
  `INSERT INTO images (task_id, comparison_index, type, width, height, url) VALUES (?, ?, ?, ?, ?, ?)`
);

const getImagesStmt = db.prepare(
  `SELECT image_id, task_id, comparison_index, type, width, height, url
   FROM images
   WHERE task_id = ?
   ORDER BY comparison_index ASC, image_id ASC`
);

const listIssuesStmt = db.prepare(
  `SELECT issue_id, task_id, comparison_index, x, y, width, height, type, severity, description, created_at
   FROM issues
   WHERE task_id = ?
   ORDER BY issue_id DESC`
);

const insertIssueStmt = db.prepare(
  `INSERT INTO issues (task_id, comparison_index, x, y, width, height, type, severity, description)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const getIssueStmt = db.prepare(
  `SELECT issue_id, task_id, comparison_index, x, y, width, height, type, severity, description, created_at
   FROM issues
   WHERE issue_id = ?`
);

const upsertComparisonRegionsStmt = db.prepare(`
  INSERT INTO comparison_regions (task_id, comparison_index, regions_json)
  VALUES (?, ?, ?)
  ON CONFLICT(task_id, comparison_index) DO UPDATE SET regions_json = excluded.regions_json
`);

const listComparisonRegionsStmt = db.prepare(
  `SELECT comparison_index, regions_json
   FROM comparison_regions
   WHERE task_id = ?
   ORDER BY comparison_index ASC`
);

export function listTasks(): TaskWithStats[] {
  return listTasksStmt.all() as TaskWithStats[];
}

export function getTask(taskId: number): Task | null {
  return (getTaskStmt.get(taskId) as Task | undefined) ?? null;
}

export function createTask(input: {
  task_name: string;
  version: string;
  owner: string;
}): number {
  const result = insertTaskStmt.run(input.task_name, input.version, input.owner);
  return Number(result.lastInsertRowid);
}

export function createImage(input: {
  task_id: number;
  comparison_index?: number;
  type: ImageType;
  width?: number;
  height?: number;
  url: string;
}): number {
  const result = insertImageStmt.run(
    input.task_id,
    input.comparison_index ?? 0,
    input.type,
    input.width ?? 0,
    input.height ?? 0,
    input.url
  );
  return Number(result.lastInsertRowid);
}

export function getImagesByTask(taskId: number): ImageRecord[] {
  return getImagesStmt.all(taskId) as ImageRecord[];
}

export function listIssuesByTask(taskId: number): Issue[] {
  return listIssuesStmt.all(taskId) as Issue[];
}

export function createIssue(input: {
  task_id: number;
  comparison_index?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: IssueType;
  severity: SeverityLevel;
  description: string;
}): Issue {
  const result = insertIssueStmt.run(
    input.task_id,
    input.comparison_index ?? 0,
    input.x,
    input.y,
    input.width,
    input.height,
    input.type,
    input.severity,
    input.description
  );

  return getIssueStmt.get(Number(result.lastInsertRowid)) as Issue;
}

export function getTaskReviewData(taskId: number): {
  task: Task;
  images: ImageRecord[];
  issues: Issue[];
} | null {
  const task = getTask(taskId);

  if (!task) {
    return null;
  }

  return {
    task,
    images: getImagesByTask(taskId),
    issues: listIssuesByTask(taskId)
  };
}

export function saveComparisonRegions(
  taskId: number,
  comparisonIndex: number,
  regions: DiffRegion[]
): void {
  upsertComparisonRegionsStmt.run(taskId, comparisonIndex, JSON.stringify(regions));
}

export function loadComparisonRegions(
  taskId: number,
  comparisonIndexes: number[]
): Record<number, DiffRegion[]> {
  const rows = listComparisonRegionsStmt.all(taskId) as Array<{
    comparison_index: number;
    regions_json: string;
  }>;
  const requested = new Set(comparisonIndexes);
  const result: Record<number, DiffRegion[]> = {};

  comparisonIndexes.forEach((comparisonIndex) => {
    result[comparisonIndex] = [];
  });

  rows.forEach((row) => {
    if (!requested.has(row.comparison_index)) {
      return;
    }

    try {
      const regions = JSON.parse(row.regions_json) as DiffRegion[];
      result[row.comparison_index] = Array.isArray(regions) ? regions : [];
    } catch {
      result[row.comparison_index] = [];
    }
  });

  return result;
}

export function buildCsvReport(
  task: Task,
  comparisonRegions: ComparisonRegions[],
  issues: Issue[]
): string {
  const section1 = [
    "Task ID,Task Name,Version,Owner,Created At",
    `${task.task_id},"${escapeCsv(task.task_name)}","${escapeCsv(task.version)}","${escapeCsv(
      task.owner
    )}","${task.created_at}"`
  ];

  const section2 = [
    "",
    "Detected Regions",
    "Comparison Index,Region ID,X,Y,Width,Height,Pixel Count",
    ...comparisonRegions.flatMap((item) =>
      item.regions.map(
        (region) =>
          `${item.comparison_index},${region.id},${region.x},${region.y},${region.width},${region.height},${region.pixel_count}`
      )
    )
  ];

  const section3 = [
    "",
    "Issues",
    "Issue ID,Comparison Index,X,Y,Width,Height,Type,Severity,Description,Created At",
    ...issues.map(
      (issue) =>
        `${issue.issue_id},${issue.comparison_index},${issue.x},${issue.y},${issue.width},${issue.height},"${escapeCsv(
          issue.type
        )}","${escapeCsv(issue.severity)}","${escapeCsv(issue.description)}","${issue.created_at}"`
    )
  ];

  return [...section1, ...section2, ...section3].join("\n");
}

export function buildMarkdownReport(
  task: Task,
  comparisons: ComparisonMarkdownData[],
  issues: Issue[],
  exportedAt?: string
): string {
  const reviewDate = formatReportDate(exportedAt, task.created_at);
  const totalRegions = comparisons.reduce((sum, comparison) => sum + comparison.regions.length, 0);
  const lines: string[] = [];

  lines.push("# 设计走查报告");
  lines.push("");
  lines.push("## 一、任务信息");
  lines.push("");
  lines.push(`- 任务名称：${task.task_name}`);
  lines.push(`- 版本：${task.version}`);
  lines.push(`- 负责人：${task.owner}`);
  lines.push(`- 创建时间：${reviewDate}`);
  lines.push("");
  lines.push("## 二、对比结果");
  lines.push("");

  if (comparisons.length === 0) {
    lines.push("- 当前任务未生成 comparison 数据。");
    lines.push("");
  } else {
    lines.push(`- 当前任务共 ${comparisons.length} 组 comparison。`);
    lines.push("");

    for (const comparison of comparisons) {
      const hasDiffImage = comparison.images.some((image) => image.type === "diff");
      lines.push(`### 对比组 ${comparison.comparison_index + 1}`);
      lines.push("");
      lines.push(`- comparison：${hasDiffImage ? "已生成" : "未生成"}`);
      lines.push(`- 差异区域数量：${comparison.regions.length}`);
      lines.push(`- 设计稿：${getImageDisplayName(comparison.images, "design")}`);
      lines.push(`- 实现图：${getImageDisplayName(comparison.images, "implementation")}`);
      lines.push(`- 差异图：${getImageDisplayName(comparison.images, "diff")}`);
      lines.push("");
    }
  }

  lines.push("## 三、问题列表");
  lines.push("");

  if (issues.length === 0) {
    lines.push("本次未记录人工确认的问题。");
    lines.push("");
  } else {
    lines.push("| 序号 | 类型 | 严重程度 | 问题描述 | 坐标 |");
    lines.push("|---|---|---|---|---|");

    issues.forEach((issue, index) => {
      lines.push(
        `| ${index + 1} | ${escapeMarkdownTableCell(mapIssueTypeZh(issue.type))} | ${escapeMarkdownTableCell(mapSeverityZh(issue.severity))} | ${escapeMarkdownTableCell(issue.description)} | ${escapeMarkdownTableCell(`(${issue.x}, ${issue.y}, ${issue.width}, ${issue.height})`)} |`
      );
    });
    lines.push("");
  }

  lines.push("## 四、结论");
  lines.push("");
  lines.push(`- comparison 总数：${comparisons.length}`);
  lines.push(`- 差异区域总数：${totalRegions}`);
  lines.push(`- 问题总数：${issues.length}`);
  lines.push(
    issues.length > 0
      ? "- 结论：存在已确认视觉问题，请按问题列表逐项修复。"
      : "- 结论：当前未记录人工确认问题。"
  );
  lines.push("");

  return `${lines.join("\n").trimEnd()}\n`;
}

function escapeCsv(value: string): string {
  return value.replaceAll('"', '""');
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br />");
}

function getImageDisplayName(images: ImageRecord[], imageType: ImageType): string {
  const target = images.find((image) => image.type === imageType);
  if (!target) {
    return "无";
  }

  if (target.url.startsWith("data:")) {
    return "内嵌图片数据";
  }

  const fileName = target.url.split("/").filter(Boolean).at(-1);
  return fileName ?? target.url;
}

function mapIssueTypeZh(type: string): string {
  const map: Record<string, string> = {
    layout: "布局",
    spacing: "间距",
    typography: "字体",
    color: "颜色",
    "missing element": "缺失元素",
    overlap: "遮挡",
    "text overflow": "文案截断"
  };

  return map[type] ?? type;
}

function mapIssueTypeEn(type: string): string {
  const map: Record<string, string> = {
    layout: "Layout",
    spacing: "Spacing",
    typography: "Typography",
    color: "Color",
    "missing element": "Missing Element",
    overlap: "Overlap",
    "text overflow": "Text Overflow"
  };

  return map[type] ?? type;
}

function mapSeverityZh(severity: string): string {
  const map: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低"
  };

  return map[severity] ?? severity;
}

function formatReportDate(exportedAt: string | undefined, fallback: string): string {
  const source = exportedAt && exportedAt.trim() ? exportedAt : fallback;
  const normalized = source.includes("T") ? source : source.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return fallback.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

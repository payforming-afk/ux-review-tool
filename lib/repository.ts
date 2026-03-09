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
  `INSERT INTO images (task_id, comparison_index, type, url) VALUES (?, ?, ?, ?)`
);

const getImagesStmt = db.prepare(
  `SELECT image_id, task_id, comparison_index, type, url
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
  url: string;
}): number {
  const result = insertImageStmt.run(
    input.task_id,
    input.comparison_index ?? 0,
    input.type,
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
  const lines: string[] = [];

  lines.push("# 设计走查报告");
  lines.push("");
  lines.push("## 一、任务信息");
  lines.push("");
  lines.push("| 项目 | 内容 |");
  lines.push("|---|---|");
  lines.push(`| 任务名称 | ${escapeMarkdownTableCell(task.task_name)} |`);
  lines.push(`| 版本 | ${escapeMarkdownTableCell(task.version)} |`);
  lines.push(`| 负责人 | ${escapeMarkdownTableCell(task.owner)} |`);
  lines.push(`| 走查时间 | ${reviewDate} |`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 二、页面对比");
  lines.push("");

  if (comparisons.length === 0) {
    lines.push("暂无页面对比数据。");
    lines.push("");
  } else {
    for (const comparison of comparisons) {
      lines.push(`### 对比组 ${comparison.comparison_index + 1}`);
      lines.push("");
      lines.push("| 设计稿 | 前端实现 | 差异图 |");
      lines.push("|---|---|---|");
      lines.push(
        `| ${escapeMarkdownTableCell(getImageDisplayName(comparison.images, "design"))} | ${escapeMarkdownTableCell(getImageDisplayName(comparison.images, "implementation"))} | ${escapeMarkdownTableCell(getImageDisplayName(comparison.images, "diff"))} |`
      );
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("## 三、问题列表");
  lines.push("");

  if (issues.length === 0) {
    lines.push("本次未记录人工确认的问题。");
    lines.push("");
  } else {
    lines.push(`本次共发现 ${issues.length} 个设计问题。`);
    lines.push("");
    lines.push("| 序号 | 类型 | 严重程度 | 问题描述 |");
    lines.push("|---|---|---|---|");

    issues.forEach((issue, index) => {
      lines.push(
        `| ${index + 1} | ${escapeMarkdownTableCell(mapIssueTypeZh(issue.type))} | ${escapeMarkdownTableCell(mapSeverityZh(issue.severity))} | ${escapeMarkdownTableCell(issue.description)} |`
      );
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## 四、问题详情");
  lines.push("");

  if (issues.length === 0) {
    lines.push("本次未记录人工确认的问题。");
    lines.push("");
  } else {
    issues.forEach((issue, index) => {
      const typeZh = mapIssueTypeZh(issue.type);
      const typeEn = mapIssueTypeEn(issue.type);

      lines.push(`### 问题 ${index + 1}：${typeZh}问题`);
      lines.push("");
      lines.push("**类型**");
      lines.push("");
      lines.push(`${typeZh}（${typeEn}）`);
      lines.push("");
      lines.push("**严重程度**");
      lines.push("");
      lines.push(mapSeverityZh(issue.severity));
      lines.push("");
      lines.push("**问题描述**");
      lines.push("");
      lines.push(issue.description.trim() || "（无描述）");
      lines.push("");
      lines.push("**所属对比组**");
      lines.push("");
      lines.push(`对比组 ${issue.comparison_index + 1}`);
      lines.push("");
      lines.push("**问题位置**");
      lines.push("");
      lines.push("```text");
      lines.push(`x:${issue.x}`);
      lines.push(`y:${issue.y}`);
      lines.push(`width:${issue.width}`);
      lines.push(`height:${issue.height}`);
      lines.push("```");
      lines.push("");
    });
  }

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

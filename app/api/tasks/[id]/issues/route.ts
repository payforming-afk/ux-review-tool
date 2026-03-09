import { NextResponse } from "next/server";
import { createIssue, getTask } from "@/lib/repository";
import {
  ISSUE_TYPES,
  SEVERITY_LEVELS,
  type IssueType,
  type SeverityLevel
} from "@/lib/types";

export const runtime = "nodejs";

interface IssuePayload {
  comparison_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: IssueType;
  severity: SeverityLevel;
  description: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const taskId = Number(id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "任务 ID 不合法。" }, { status: 400 });
  }

  if (!getTask(taskId)) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as Partial<IssuePayload>;

    if (
      !isNonNegativeInteger(payload.comparison_index) ||
      !isNonNegativeInteger(payload.x) ||
      !isNonNegativeInteger(payload.y) ||
      !isPositiveInteger(payload.width) ||
      !isPositiveInteger(payload.height) ||
      typeof payload.type !== "string" ||
      typeof payload.severity !== "string" ||
      typeof payload.description !== "string"
    ) {
      return NextResponse.json({ error: "问题参数不完整或格式错误。" }, { status: 400 });
    }

    if (!ISSUE_TYPES.includes(payload.type as IssueType)) {
      return NextResponse.json({ error: "问题类型不支持。" }, { status: 400 });
    }

    if (!SEVERITY_LEVELS.includes(payload.severity as SeverityLevel)) {
      return NextResponse.json({ error: "严重级别不支持。" }, { status: 400 });
    }

    const description = payload.description.trim();
    if (!description) {
      return NextResponse.json({ error: "请填写问题描述。" }, { status: 400 });
    }

    const issue = createIssue({
      task_id: taskId,
      comparison_index: payload.comparison_index,
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      type: payload.type,
      severity: payload.severity,
      description
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    console.error("Failed to create issue:", error);
    return NextResponse.json({ error: "创建问题失败，请稍后重试。" }, { status: 500 });
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

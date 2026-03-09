import { NextResponse } from "next/server";
import sharp from "sharp";
import { generateDiff } from "@/lib/diff";
import {
  createImage,
  createTask,
  getTask,
  listTasks as listTasksFromRepo
} from "@/lib/repository";
import { saveRegions, taskAssetUrl, writeTaskAsset } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PendingComparison {
  comparison_index: number;
  width: number;
  height: number;
  mismatch_pixels: number;
  detected_regions: number;
  design_png: Buffer;
  implementation_png: Buffer;
  diff_png: Buffer;
  regions: ReturnType<typeof generateDiff>["regions"];
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ tasks: listTasksFromRepo() });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const taskName = getText(formData.get("task_name"));
    const version = getText(formData.get("version"));
    const owner = getText(formData.get("owner"));

    if (!taskName || !version || !owner) {
      return NextResponse.json(
        { error: "任务名称、版本和负责人不能为空。" },
        { status: 400 }
      );
    }

    const designFiles = collectImageFiles(formData, "design_images", "design_image");
    const implementationFiles = collectImageFiles(
      formData,
      "implementation_images",
      "implementation_image"
    );

    if (designFiles.length === 0 || implementationFiles.length === 0) {
      return NextResponse.json(
        { error: "请至少上传 1 张设计稿和 1 张实现截图。" },
        { status: 400 }
      );
    }

    const pairing = buildPairs(designFiles, implementationFiles);

    if (typeof pairing === "string") {
      return NextResponse.json({ error: pairing }, { status: 400 });
    }

    const pendingComparisons: PendingComparison[] = [];

    for (let index = 0; index < pairing.length; index += 1) {
      const pair = pairing[index];
      const designRawBuffer = Buffer.from(await pair.design.arrayBuffer());
      const implementationRawBuffer = Buffer.from(await pair.implementation.arrayBuffer());

      const designPngBuffer = await sharp(designRawBuffer).png().toBuffer();
      const designMetadata = await sharp(designPngBuffer).metadata();

      if (!designMetadata.width || !designMetadata.height) {
        return NextResponse.json(
          { error: `第 ${index + 1} 组设计稿尺寸读取失败。` },
          { status: 400 }
        );
      }

      const implementationPngBuffer = await sharp(implementationRawBuffer)
        .resize(designMetadata.width, designMetadata.height, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      const diff = generateDiff(designPngBuffer, implementationPngBuffer);

      pendingComparisons.push({
        comparison_index: index,
        width: diff.width,
        height: diff.height,
        mismatch_pixels: diff.mismatch_pixels,
        detected_regions: diff.regions.length,
        design_png: designPngBuffer,
        implementation_png: implementationPngBuffer,
        diff_png: diff.diffBuffer,
        regions: diff.regions
      });
    }

    const taskId = createTask({
      task_name: taskName,
      version,
      owner
    });

    for (const comparison of pendingComparisons) {
      const suffix = String(comparison.comparison_index + 1).padStart(2, "0");
      const designFileName = `design-${suffix}.png`;
      const implementationFileName = `implementation-${suffix}.png`;
      const diffFileName = `diff-${suffix}.png`;

      await Promise.all([
        writeTaskAsset(taskId, designFileName, comparison.design_png),
        writeTaskAsset(taskId, implementationFileName, comparison.implementation_png),
        writeTaskAsset(taskId, diffFileName, comparison.diff_png),
        saveRegions(taskId, comparison.comparison_index, comparison.regions)
      ]);

      createImage({
        task_id: taskId,
        comparison_index: comparison.comparison_index,
        type: "design",
        url: taskAssetUrl(taskId, designFileName)
      });
      createImage({
        task_id: taskId,
        comparison_index: comparison.comparison_index,
        type: "implementation",
        url: taskAssetUrl(taskId, implementationFileName)
      });
      createImage({
        task_id: taskId,
        comparison_index: comparison.comparison_index,
        type: "diff",
        url: taskAssetUrl(taskId, diffFileName)
      });
    }

    return NextResponse.json(
      {
        task: getTask(taskId),
        comparisons: pendingComparisons.map((comparison) => ({
          comparison_index: comparison.comparison_index,
          width: comparison.width,
          height: comparison.height,
          mismatch_pixels: comparison.mismatch_pixels,
          detected_regions: comparison.detected_regions
        }))
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create review task:", error);
    return NextResponse.json(
      { error: "创建任务失败，请稍后重试。" },
      { status: 500 }
    );
  }
}

function collectImageFiles(
  formData: FormData,
  multiKey: string,
  singleKey: string
): File[] {
  const multipleFiles = formData
    .getAll(multiKey)
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (multipleFiles.length > 0) {
    return multipleFiles;
  }

  const single = formData.get(singleKey);

  if (single instanceof File && single.size > 0) {
    return [single];
  }

  return [];
}

function buildPairs(
  designFiles: File[],
  implementationFiles: File[]
): Array<{ design: File; implementation: File }> | string {
  if (designFiles.length === implementationFiles.length) {
    return designFiles.map((design, index) => ({
      design,
      implementation: implementationFiles[index]
    }));
  }

  if (designFiles.length === 1) {
    return implementationFiles.map((implementation) => ({
      design: designFiles[0],
      implementation
    }));
  }

  if (implementationFiles.length === 1) {
    return designFiles.map((design) => ({
      design,
      implementation: implementationFiles[0]
    }));
  }

  return "多图比对时，设计稿数量与实现图数量需相等；或任一侧仅上传 1 张作为基准图。";
}

function getText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

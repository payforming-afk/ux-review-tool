import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type { DiffRegion } from "@/lib/types";

declare global {
  var __memoryRegionsFallback: Map<string, DiffRegion[]> | undefined;
}

const useLocalFileStorage = shouldUseLocalFileStorage();
const memoryRegionsFallback = global.__memoryRegionsFallback ?? new Map<string, DiffRegion[]>();

if (!global.__memoryRegionsFallback) {
  global.__memoryRegionsFallback = memoryRegionsFallback;
}

function uploadsRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export function taskUploadDir(taskId: number): string {
  return path.join(uploadsRoot(), String(taskId));
}

export async function ensureTaskUploadDir(taskId: number): Promise<string> {
  const dir = taskUploadDir(taskId);
  if (!useLocalFileStorage) {
    return dir;
  }
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function taskAssetPath(taskId: number, fileName: string): string {
  return path.join(taskUploadDir(taskId), fileName);
}

export function taskAssetUrl(taskId: number, fileName: string): string {
  return `/uploads/${taskId}/${fileName}`;
}

export async function writeTaskAsset(
  taskId: number,
  fileName: string,
  content: Buffer | string
): Promise<string> {
  if (!useLocalFileStorage) {
    return taskAssetPath(taskId, fileName);
  }

  await ensureTaskUploadDir(taskId);
  const absolutePath = taskAssetPath(taskId, fileName);
  await fs.writeFile(absolutePath, content);
  return absolutePath;
}

export async function saveRegions(
  taskId: number,
  comparisonIndex: number,
  regions: DiffRegion[]
): Promise<void> {
  const memoryKey = buildMemoryRegionsKey(taskId, comparisonIndex);
  memoryRegionsFallback.set(memoryKey, regions);

  const serialized = JSON.stringify(regions, null, 2);
  const fileName = regionsFileName(comparisonIndex);

  if (!useLocalFileStorage) {
    return;
  }

  await writeTaskAsset(taskId, fileName, serialized);

  if (comparisonIndex === 0) {
    await writeTaskAsset(taskId, "regions.json", serialized);
  }
}

export async function loadRegions(
  taskId: number,
  comparisonIndex = 0
): Promise<DiffRegion[]> {
  if (!useLocalFileStorage) {
    return memoryRegionsFallback.get(buildMemoryRegionsKey(taskId, comparisonIndex)) ?? [];
  }

  const primaryPath = taskAssetPath(taskId, regionsFileName(comparisonIndex));

  try {
    const json = await fs.readFile(primaryPath, "utf-8");
    return JSON.parse(json) as DiffRegion[];
  } catch {
    if (comparisonIndex !== 0) {
      return [];
    }

    try {
      const legacyJson = await fs.readFile(taskAssetPath(taskId, "regions.json"), "utf-8");
      return JSON.parse(legacyJson) as DiffRegion[];
    } catch {
      return [];
    }
  }
}

export async function loadComparisonRegions(
  taskId: number,
  comparisonIndexes: number[]
): Promise<Record<number, DiffRegion[]>> {
  const entries = await Promise.all(
    comparisonIndexes.map(async (comparisonIndex) => {
      const regions = await loadRegions(taskId, comparisonIndex);
      return [comparisonIndex, regions] as const;
    })
  );

  return Object.fromEntries(entries);
}

function regionsFileName(comparisonIndex: number): string {
  return `regions-${String(comparisonIndex).padStart(2, "0")}.json`;
}

function shouldUseLocalFileStorage(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (process.env.VERCEL === "1") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function buildMemoryRegionsKey(taskId: number, comparisonIndex: number): string {
  return `${taskId}:${comparisonIndex}`;
}
